import { skill } from '../primitives';
import type { Scenario } from './index';
import { validAgentsDoc } from './shared';

export const skillMissingName: Scenario = {
  name: 'skill-missing-name',
  description: 'Skill frontmatter missing `name` (skill-frontmatter → skill-missing-name).',
  assets: () => [
    validAgentsDoc(),
    skill({ name: 'anon', location: '.agents/skills', frontmatter: { description: 'x' } }),
  ],
};
