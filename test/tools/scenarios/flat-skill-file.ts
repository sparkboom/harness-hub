import { raw } from '../primitives';
import type { Scenario } from './index';
import { validAgentsDoc } from './shared';

export const flatSkillFile: Scenario = {
  name: 'flat-skill-file',
  description: 'A flat file .agents/skills/stray.md instead of stray/SKILL.md (skill-shape → skill-flat-file).',
  assets: () => [validAgentsDoc(), raw('.agents/skills/stray.md', '# stray\n')],
};
