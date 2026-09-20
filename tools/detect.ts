import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadManifest } from './manifest';

export interface DetectRow {
  id: string;
  displayName: string;
  pin: string;
  installed: string | null;
}

// Detection targets the harness *binary*, not any same-name editor binary.
// Cursor is the headless `agent` CLI, NOT the `cursor` IDE (spec R3).
const BINARY_CANDIDATES: Record<string, string[]> = {
  'claude-code': ['claude'],
  // The standalone cursor-agent CLI installs itself at ~/.local/bin/agent,
  // which is frequently not on non-interactive PATHs.
  cursor: ['agent', join(homedir(), '.cursor', 'bin', 'agent'), join(homedir(), '.local', 'bin', 'agent')],
  opencode: ['opencode'],
  codex: ['codex'],
  hermes: ['hermes'],
  pi: ['pi'],
  deepseek: ['dsh'],
};

function which(bin: string): string | null {
  const r = spawnSync('sh', ['-c', `command -v "${bin}"`], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null;
}

export function resolveBinary(id: string): string | null {
  for (const cand of BINARY_CANDIDATES[id] ?? []) {
    if (cand.includes(homedir())) {
      if (existsSync(cand)) return cand;
    } else {
      const found = which(cand);
      if (found) return found;
    }
  }
  return null;
}

export type VersionRunner = (id: string) => string | null;

export function runVersion(id: string): string | null {
  const bin = resolveBinary(id);
  if (!bin) return null;
  const r = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 15000 });
  if (r.error || r.status !== 0) return null;
  const firstLine = (r.stdout ?? '').split('\n')[0].trim();
  return firstLine || null;
}

export function detectWith(runner: VersionRunner = runVersion): DetectRow[] {
  const manifest = loadManifest();
  return Object.keys(manifest)
    .sort()
    .map((id) => {
      // Normalize injected-runner output to runVersion's contract: trimmed,
      // non-empty, else null (runVersion already trims its own result).
      const v = runner(id);
      const installed = v === null ? null : v.trim() || null;
      return {
        id,
        displayName: manifest[id].displayName,
        pin: manifest[id].version,
        installed,
      };
    });
}

export function detectInstalled(): DetectRow[] {
  return detectWith(runVersion);
}

export function formatDetect(rows: DetectRow[]): string {
  const header = ['ID', 'NAME', 'PIN', 'INSTALLED'];
  const pad = (v: string, w: number) => (v.length >= w ? v : v + ' '.repeat(w - v.length));
  const lines = [header.map((h, i) => pad(h, [14, 18, 14, 40][i])).join('')];
  for (const r of rows) {
    lines.push([pad(r.id, 14), pad(r.displayName, 18), pad(r.pin, 14), r.installed ?? 'NOT INSTALLED'].join(''));
  }
  return lines.join('\n');
}

export async function main(_argv: string[]): Promise<number> {
  console.log(formatDetect(detectInstalled()));
  return 0;
}
