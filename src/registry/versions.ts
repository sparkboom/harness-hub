import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_HARNESS_IDS, type HarnessId } from '../harnesses';
import { getProfile } from './profiles';

export interface HarnessInstallManifest {
  method: 'npm' | 'fhs-wrapper';
  package?: string;
  url?: string;
}

export interface VersionRange {
  profile: string;
  min: string;
  max: string | null;
  status: 'verified' | 'unverified';
  verifiedDate?: string;
  caveat?: string;
  review?: 'automated' | 'manual';
}

export interface HarnessVersionEntry {
  displayName: string;
  install: HarnessInstallManifest;
  ranges: VersionRange[];
}

// Compiled to dist/registry/versions.js (__dirname = dist/registry) and run
// from src/registry under vitest; both are two levels below the repo root,
// where config/config.json ships (via the "files" array).
const MANIFEST_PATH = join(__dirname, '..', '..', 'config', 'config.json');

interface ManifestShape {
  harness: { versions: Record<string, HarnessVersionEntry> };
}

let cached: Record<HarnessId, HarnessVersionEntry> | undefined;

export function loadVersionsManifest(): Record<HarnessId, HarnessVersionEntry> {
  if (cached) return cached;
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ManifestShape;
  const versions = raw.harness.versions;
  for (const id of ALL_HARNESS_IDS) {
    if (!(id in versions)) throw new Error(`config/config.json is missing an entry for "${id}"`);
  }
  for (const id of ALL_HARNESS_IDS) {
    const entry = versions[id];
    if (!Array.isArray(entry.ranges) || entry.ranges.length === 0) {
      throw new Error(`config/config.json "${id}" has no ranges`);
    }
    for (const r of entry.ranges) {
      if (!getProfile(r.profile)) {
        throw new Error(`config/config.json "${id}" references unknown profile "${r.profile}"`);
      }
    }
  }
  cached = versions as Record<HarnessId, HarnessVersionEntry>;
  return cached;
}
