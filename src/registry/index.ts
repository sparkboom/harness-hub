import type { HarnessId } from '../harnesses';
import { HARNESS_REGISTRY } from './data';
import type { HarnessEntry } from './types';

export function getHarnessEntry(id: HarnessId): HarnessEntry {
  return HARNESS_REGISTRY[id];
}

export { HARNESS_REGISTRY };
export type { HarnessEntry, AgentsDocConvention, SkillsConvention, TrustGateConvention } from './types';
