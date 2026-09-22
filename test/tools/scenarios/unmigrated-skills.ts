import { raw } from '../primitives';
import type { Scenario } from './index';
import { validAgentsDoc, validSkill } from './shared';

export const unmigratedSkills: Scenario = {
  name: 'unmigrated-skills',
  description: '.claude/skills contains a skill with no canon counterpart (skill-migration → unmigrated-skills).',
  assets: () => [validAgentsDoc(), validSkill(), raw('.claude/skills/a/SKILL.md', 'body\n')],
};
