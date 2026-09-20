import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_HARNESS_IDS, type HarnessId } from '../harnesses';

export interface HarnessInstallManifest {
  method: 'npm' | 'fhs-wrapper';
  package?: string;
  url?: string;
}

export interface HarnessVersionEntry {
  displayName: string;
  version: string;
  verifiedDate: string;
  install: HarnessInstallManifest;
}

// Compiled to dist/registry/versions.js, so __dirname is dist/registry and the
// manifest is two levels up at the repo root (and ships in the npm package via
// the "files" array).
const MANIFEST_PATH = join(__dirname, '..', '..', 'harness-versions.json');

export function loadVersionsManifest(): Record<HarnessId, HarnessVersionEntry> {
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Record<string, HarnessVersionEntry>;
  for (const id of ALL_HARNESS_IDS) {
    if (!(id in raw)) throw new Error(`harness-versions.json is missing an entry for "${id}"`);
  }
  return raw as Record<HarnessId, HarnessVersionEntry>;
}
