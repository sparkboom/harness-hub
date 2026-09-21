import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Asset } from './primitives';

export function writeAssets(target: string, assets: Asset[]): void {
  for (const a of assets) {
    const full = join(target, a.path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, a.content, 'utf8');
  }
}

/** Removes everything under `target` except `.git`, preserving a consumer repo's nested git. */
export function resetTarget(target: string): void {
  if (!existsSync(target)) {
    mkdirSync(target, { recursive: true });
    return;
  }
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    rmSync(join(target, entry.name), { recursive: true, force: true });
  }
}
