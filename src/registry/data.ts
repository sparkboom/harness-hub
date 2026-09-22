import type { HarnessId } from '../harnesses';
import { ALL_HARNESS_IDS } from '../harnesses';
import type { HarnessEntry } from './types';
import { loadVersionsManifest, type HarnessVersionEntry, type VersionRange } from './versions';
import { getProfile } from './profiles';

const versions = loadVersionsManifest();

function newestVerified(ranges: VersionRange[]): VersionRange | undefined {
  return ranges.filter((r) => r.status === 'verified').at(-1);
}

// The profile the runtime should apply for wiring: the newest verified range's
// profile; if nothing is verified yet, the newest range (highest bounds).
function effectiveProfile(entry: HarnessVersionEntry) {
  const v = newestVerified(entry.ranges) ?? entry.ranges[entry.ranges.length - 1];
  const profile = getProfile(v.profile);
  if (!profile) throw new Error(`config/config.json "${entry.displayName}" references unknown profile "${v.profile}"`);
  return profile;
}

function build(id: HarnessId): HarnessEntry {
  const entry = versions[id];
  const verified = newestVerified(entry.ranges);
  const fallback = entry.ranges[entry.ranges.length - 1];
  const profile = effectiveProfile(entry);
  return {
    id,
    displayName: entry.displayName,
    verifiedVersion: verified ? (verified.max ?? verified.min) : (fallback.max ?? fallback.min),
    verifiedDate: verified?.verifiedDate ?? fallback.verifiedDate ?? '2026-01-01',
    agentsDoc: profile.agentsDoc,
    skills: profile.skills,
  };
}

export const HARNESS_REGISTRY = Object.fromEntries(
  ALL_HARNESS_IDS.map((id) => [id, build(id)])
) as Record<HarnessId, HarnessEntry>;