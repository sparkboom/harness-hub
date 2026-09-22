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
  // A bare wildcard range spec like "3.x", "1.2.x", or "1x" is a range spec,
  // not an installed version — coerce would fabricate e.g. 3.0.0, so treat it
  // as unparseable. Only this shape is rejected: version banners with prefixes
  // ("codex-cli 0.155.1") and prerelease strings ("1.2.3-x") must still parse.
  if (/^v?\d+(\.\d+)*(\.[xX*]|[xX*])$/.test(cleaned)) return null;
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
  const unrecognized = { harnessId, installedVersion, status: 'unrecognized' as const, profile: null, range: null };
  if (entry == null) return unrecognized;
  if (installedVersion == null) return unrecognized;
  const parsed = parseVersion(installedVersion);
  if (parsed === null) return unrecognized;
  const range = entry.ranges.find((r) => inRange(parsed, r.min, r.max));
  if (!range) return unrecognized;
  return { harnessId, installedVersion, status: range.status, profile: range.profile, range };
}

export function resolveHarnessStatus(harnessId: HarnessId, installedVersion: string | null): Resolution {
  return resolveVersion(harnessId, loadVersionsManifest()[harnessId], installedVersion);
}