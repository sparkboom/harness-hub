import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface HarnessManifestEntry {
  displayName: string;
  verifiedVersion?: string;
  verifiedDate: string;
  install: { method: string; package?: string; url?: string };
}

// test/tools/ code runs from two layouts: source under vitest (__dirname =
// <repo>/test/tools) and compiled via build:tools (__dirname =
// <repo>/test/tools/dist). The config sits at the repo root
// (<repo>/config/config.json), so probe candidates in order and use the first
// that exists.
const MANIFEST_CANDIDATES = [
  join(__dirname, '..', '..', 'config', 'config.json'),       // source: test/tools → repo root
  join(__dirname, '..', '..', '..', 'config', 'config.json'), // compiled: test/tools/dist → repo root
];

const MANIFEST_PATH =
  MANIFEST_CANDIDATES.find((p) => existsSync(p)) ?? MANIFEST_CANDIDATES[MANIFEST_CANDIDATES.length - 1];

interface ManifestShape {
  harness: { versions: Record<string, HarnessManifestEntry> };
}

export function loadManifest(): Record<string, HarnessManifestEntry> {
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ManifestShape;
  return raw.harness.versions;
}
