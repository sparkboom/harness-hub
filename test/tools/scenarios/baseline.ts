import type { Scenario } from './index';
import { validAgentsDoc, validSkill } from './shared';

export const baseline: Scenario = {
  name: 'baseline',
  description: 'Valid canon (AGENTS.md + a valid skill), nothing wired — doctor finds nothing.',
  assets: () => [validAgentsDoc(), validSkill()],
};
