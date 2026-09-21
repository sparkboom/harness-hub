import type { Scenario } from './index';
import { validAgentsDoc, validSkill } from './shared';

export const multi: Scenario = {
  name: 'multi',
  description: 'Valid canon ready to enable several harnesses at once (composition; no single rule).',
  assets: () => [validAgentsDoc(), validSkill()],
};
