import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { gte, lt, valid, coerce } from 'semver';
import { loadVersionEntries, MANIFEST_PATH, type ManifestRange, type ManifestVersionEntry } from './manifest';

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
    // null means only "no package configured". A failed npm invocation is an
    // infrastructure error — throw so --check fails loudly instead of reading
    // the empty stdout as "no upstream version, therefore covered".
    if (r.error) throw new Error(`reconcile: npm view failed for ${pkg}: ${r.error.message}`);
    if (r.status !== 0) throw new Error(`reconcile: npm view failed for ${pkg}: ${(r.stderr ?? '').trim()}`);
    const line = (r.stdout ?? '').split('\n')[0].trim();
    return Promise.resolve(line || null);
  },
};

export interface CheckRow {
  id: string;
  latest: string | null;
  covered: boolean;
  error?: string;
}

export async function checkLatest(
  resolver: UpstreamResolver = npmUpstream,
  entries: Record<string, ManifestVersionEntry> = loadVersionEntries(),
): Promise<{ rows: CheckRow[]; exitCode: number }> {
  const rows: CheckRow[] = [];
  for (const id of Object.keys(entries).sort()) {
    let latest: string | null = null;
    let error: string | undefined;
    try {
      latest = await resolver.latest(id);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    // Missing/empty ranges: nothing is verified — honest answer is drift.
    let covered: boolean;
    if (error !== undefined) covered = false;
    else if (latest === null) covered = true; // no package configured — nothing to drift
    else covered = isCoveredByVerified(latest, entries[id].ranges ?? []);
    rows.push({ id, latest, covered, ...(error !== undefined ? { error } : {}) });
  }
  const errored = rows.some((r) => r.error !== undefined);
  if (errored) return { rows, exitCode: 2 };
  const drift = rows.some((r) => !r.covered);
  return { rows, exitCode: drift ? 1 : 0 };
}

export function formatCheck(rows: CheckRow[]): string {
  const pad = (s: string, w: number) => (s.length >= w ? s : s + ' '.repeat(w - s.length));
  const lines = [pad('ID', 16) + pad('LATEST', 14) + 'COVERED'];
  for (const r of rows) {
    lines.push(pad(r.id, 16) + pad(r.latest ?? '?', 14) + (r.error !== undefined ? 'ERR' : r.covered ? 'yes' : 'NO'));
  }
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
    if (entry.ranges.length === 0) {
      throw new Error(`reconcile: harness "${harness}" has no ranges to derive a profile from`);
    }
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
    try {
      const res = await checkLatest();
      console.log(formatCheck(res.rows));
      return res.exitCode;
    } catch (err) {
      console.error(`reconcile: upstream check failed: ${err instanceof Error ? err.message : String(err)}`);
      return 2;
    }
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