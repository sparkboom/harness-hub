import { skill } from '../primitives';
import type { Scenario } from './index';
import { validAgentsDoc } from './shared';

export const skillNameMismatch: Scenario = {
  name: 'skill-name-mismatch',
  description: 'Skill frontmatter `name` differs from its directory name (skill-frontmatter → skill-name-mismatch).',
  assets: () => [
    validAgentsDoc(),
    skill({
      name: 'writing-tests',
      location: '.agents/skills',
      frontmatter: { name: 'other', description: 'x' },
    }),
  ],
};
