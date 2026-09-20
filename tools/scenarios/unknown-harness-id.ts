import type { Scenario } from './index';
import { validAgentsDoc, validSkill, harnessConfig } from './shared';

export const unknownHarnessId: Scenario = {
  name: 'unknown-harness-id',
  description: 'harness-hub.yaml lists an unrecognized harness id (config-validity → config-unknown-harness-id).',
  assets: () => [validAgentsDoc(), validSkill(), harnessConfig(['bogus'])],
};
