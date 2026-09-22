import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ALL_HARNESS_IDS, type HarnessId } from './harnesses';

const BINARY_CANDIDATES: Record<HarnessId, string[]> = {
  'claude-code': ['claude'],
  cursor: [], // IDE surface — no reliable headless version probe
  'cursor-cli': ['agent', join(homedir(), '.cursor', 'bin', 'agent'), join(homedir(), '.local', 'bin', 'agent')],
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

export function resolveBinary(id: HarnessId): string | null {
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

export type VersionRunner = (id: HarnessId) => string | null;

export function runVersion(id: HarnessId): string | null {
  const bin = resolveBinary(id);
  if (!bin) return null;
  const r = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 15000 });
  if (r.error || r.status !== 0) return null;
  const first = (r.stdout ?? '').split('\n')[0].trim();
  return first || null;
}

export function detectWith(runner: VersionRunner): Record<HarnessId, string | null> {
  return Object.fromEntries(
    ALL_HARNESS_IDS.map((id) => {
      const raw = runner(id);
      const first = (raw ?? '').split('\n')[0].trim();
      return [id, first || null];
    }),
  ) as Record<HarnessId, string | null>;
}

export function detectInstalledVersions(): Record<HarnessId, string | null> {
  return detectWith(runVersion);
}