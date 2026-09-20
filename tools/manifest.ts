import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface HarnessManifestEntry {
  displayName: string;
  version: string;
  verifiedDate: string;
  install: { method: string; package?: string; url?: string };
}

// tools/ code runs from two layouts: source under vitest (__dirname =
// <repo>/tools) and compiled via build:tools (__dirname = <repo>/tools/dist).
// The manifest sits at the package root, so probe the candidates in order and
// use the first that exists (src/registry/versions.ts has the same two-up join
// and works in both layouts only because both of its dirs are two levels deep).
const MANIFEST_CANDIDATES = [
  join(__dirname, 'harness-versions.json'),
  join(__dirname, '..', 'harness-versions.json'),
  join(__dirname, '..', '..', 'harness-versions.json'),
];

const MANIFEST_PATH =
  MANIFEST_CANDIDATES.find((p) => existsSync(p)) ?? MANIFEST_CANDIDATES[MANIFEST_CANDIDATES.length - 1];

export function loadManifest(): Record<string, HarnessManifestEntry> {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Record<string, HarnessManifestEntry>;
}
