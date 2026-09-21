import type { Scenario } from './index';
import { validAgentsDoc, validSkill } from './shared';

export const hermesTrust: Scenario = {
  name: 'hermes-trust',
  description: 'Valid canon, ready for `harness-hub enable hermes` (trust-gate → hermes-trust: trust before enabling).',
  assets: () => [validAgentsDoc(), validSkill()],
};
