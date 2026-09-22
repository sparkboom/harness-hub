import { gte, lt, coerce, valid } from 'semver';
import type { HarnessId } from '../harnesses';
import { loadVersionsManifest, type HarnessVersionEntry, type VersionRange } from './versions';

export type ResolvedStatus = 'verified' | 'unverified' | 'unrecognized';

export interface Resolution {
  harnessId: HarnessId;
  installedVersion: string | null;
  status: ResolvedStatus;
  profile: string | null;
  range: VersionRange | null;
}

function parseVersion(raw: string): string | null {
  const cleaned = raw.trim();
  const exact = valid(cleaned);
  if (exact !== null) return exact;
  // A wildcard range like "3.x" or "1.2.x" is a range spec, not an installed
  // version — coerce would fabricate e.g. 3.0.0, so treat it as unparseable.
  if (/[xX*]/.test(cleaned)) return null;
  return coerce(cleaned)?.version ?? null;
}

function inRange(v: string, min: string, max: string | null): boolean {
  return gte(v, min) && (max === null || lt(v, max));
}

export function resolveVersion(
  harnessId: HarnessId,
  entry: HarnessVersionEntry,
  installedVersion: string | null
): Resolution {
  if (installedVersion == null) {
    return { harnessId, installedVersion, status: 'unrecognized', profile: null, range: null };
  }
  const parsed = parseVersion(installedVersion);
  if (parsed === null) {
    return { harnessId, installedVersion, status: 'unrecognized', profile: null, range: null };
  }
  const range = entry.ranges.find((r) => inRange(parsed, r.min, r.max));
  if (!range) {
    return { harnessId, installedVersion, status: 'unrecognized', profile: null, range: null };
  }
  return { harnessId, installedVersion, status: range.status, profile: range.profile, range };
}

export function resolveHarnessStatus(harnessId: HarnessId, installedVersion: string | null): Resolution {
  return resolveVersion(harnessId, loadVersionsManifest()[harnessId], installedVersion);
}