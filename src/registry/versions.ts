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

// Compiled to dist/registry/versions.js (__dirname = dist/registry) and run
// from src/registry under vitest; both are two levels below the repo root,
// where config/config.json ships (via the "files" array).
const MANIFEST_PATH = join(__dirname, '..', '..', 'config', 'config.json');

interface ManifestShape {
  harness: { versions: Record<string, HarnessVersionEntry> };
}

export function loadVersionsManifest(): Record<HarnessId, HarnessVersionEntry> {
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ManifestShape;
  const versions = raw.harness.versions;
  for (const id of ALL_HARNESS_IDS) {
    if (!(id in versions)) throw new Error(`config/config.json is missing an entry for "${id}"`);
  }
  return versions as Record<HarnessId, HarnessVersionEntry>;
}
