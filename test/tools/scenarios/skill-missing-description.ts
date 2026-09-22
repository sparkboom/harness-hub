import { skill } from '../primitives';
import type { Scenario } from './index';
import { validAgentsDoc } from './shared';

export const skillMissingDescription: Scenario = {
  name: 'skill-missing-description',
  description: 'Skill frontmatter missing `description` (skill-frontmatter → skill-missing-description).',
  assets: () => [
    validAgentsDoc(),
    skill({ name: 'writing-tests', location: '.agents/skills', frontmatter: { name: 'writing-tests' } }),
  ],
};
