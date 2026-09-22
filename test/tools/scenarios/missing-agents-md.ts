import type { Scenario } from './index';
import { validSkill } from './shared';

export const missingAgentsMd: Scenario = {
  name: 'missing-agents-md',
  description: 'No AGENTS.md in the repo (canon-presence → missing-agents-md).',
  assets: () => [validSkill()],
};
