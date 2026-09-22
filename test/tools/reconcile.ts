import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { gte, lt, valid, coerce } from 'semver';
import { loadVersionEntries, MANIFEST_PATH, type ManifestRange } from './manifest';

export function isCoveredByVerified(latest: string, ranges: ManifestRange[]): boolean {
  const v = valid(latest) ?? coerce(latest)?.version;
  if (!v) return false;
  return ranges.some((r) => r.status === 'verified' && gte(v, r.min) && (r.max === null || lt(v, r.max)));
}

export interface UpstreamResolver {
  latest(id: string): Promise<string | null>;
}

export const npmUpstream: UpstreamResolver = {
  latest(id: string) {
    const entry = loadVersionEntries()[id];
    const pkg = entry?.install.package;
    if (!pkg) return Promise.resolve(null);
    const r = spawnSync('npm', ['view', pkg, 'version'], { encoding: 'utf8', timeout: 30000 });
    const line = (r.stdout ?? '').split('\n')[0].trim();
    return Promise.resolve(line || null);
  },
};

export interface CheckRow {
  id: string;
  latest: string | null;
  covered: boolean;
}

export async function checkLatest(resolver: UpstreamResolver = npmUpstream): Promise<{ rows: CheckRow[]; exitCode: number }> {
  const entries = loadVersionEntries();
  const rows: CheckRow[] = [];
  for (const id of Object.keys(entries).sort()) {
    const latest = await resolver.latest(id);
    const covered = latest === null ? true : isCoveredByVerified(latest, entries[id].ranges);
    rows.push({ id, latest, covered });
  }
  const drift = rows.some((r) => !r.covered);
  return { rows, exitCode: drift ? 1 : 0 };
}

export function formatCheck(rows: CheckRow[]): string {
  const pad = (s: string, w: number) => (s.length >= w ? s : s + ' '.repeat(w - s.length));
  const lines = [pad('ID', 16) + pad('LATEST', 14) + 'COVERED'];
  for (const r of rows) lines.push(pad(r.id, 16) + pad(r.latest ?? '?', 14) + (r.covered ? 'yes' : 'NO'));
  return lines.join('\n');
}

// Only mutation path for config.json. Flips an unverified range to verified, or
// adds a new verified range when the version matches none.
export function recordReview(harness: string, version: string): { changed: boolean; message: string } {
  const path = MANIFEST_PATH;
  const raw = JSON.parse(readFileSync(path, 'utf8')) as { harness: { versions: Record<string, { ranges: ManifestRange[] }> } };
  const entry = raw.harness.versions[harness];
  if (!entry) throw new Error(`reconcile: unknown harness "${harness}"`);
  const v = valid(version) ?? coerce(version)?.version;
  if (!v) throw new Error(`reconcile: unparseable version "${version}"`);

  let changed = false;
  const existing = entry.ranges.find((r) => gte(v, r.min) && (r.max === null || lt(v, r.max)));
  if (existing) {
    if (existing.status === 'unverified') {
      existing.status = 'verified';
      existing.verifiedDate = new Date().toISOString().slice(0, 10);
      changed = true;
    }
  } else {
    // New range: insert after the last range whose min <= v, keeping order.
    entry.ranges.push({ profile: entry.ranges[entry.ranges.length - 1].profile, min: v, max: null, status: 'verified', verifiedDate: new Date().toISOString().slice(0, 10) });
    entry.ranges.sort((a, b) => (a.min < b.min ? -1 : 1));
    changed = true;
  }

  if (changed) {
    writeFileSync(path, JSON.stringify(raw, null, 2) + '\n', 'utf8');
    return { changed: true, message: `recorded ${harness} ${v} as verified` };
  }
  return { changed: false, message: `${harness} ${v} is already verified — no change` };
}

export async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (cmd === '--check') {
    const res = await checkLatest();
    console.log(formatCheck(res.rows));
    return res.exitCode;
  }
  if (cmd === '--record' && rest[0]) {
    try {
      const out = recordReview(rest[0], rest[1] ?? '');
      console.log(out.message);
      return 0;
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      return 1;
    }
  }
  console.error('usage: reconcile --check | reconcile --record <harness> <version>');
  return 1;
}