import { raw } from '../primitives';
import type { Scenario } from './index';
import { validAgentsDoc } from './shared';

export const skillMissingSkillMd: Scenario = {
  name: 'skill-missing-skill-md',
  description: 'A skill directory with no SKILL.md inside (skill-shape → skill-missing-skill-md).',
  assets: () => [validAgentsDoc(), raw('.agents/skills/empty/notes.txt', 'not a skill\n')],
};
