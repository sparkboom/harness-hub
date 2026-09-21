import { raw } from '../primitives';
import type { Scenario } from './index';
import { validAgentsDoc, validSkill } from './shared';

export const skillMigrationCollision: Scenario = {
  name: 'skill-migration-collision',
  description: '.claude/skills copy differs from the canon skill of the same name (skill-migration → skill-migration-collision).',
  assets: () => [
    validAgentsDoc(),
    validSkill(),
    raw(
      '.claude/skills/writing-tests/SKILL.md',
      '---\nname: writing-tests\ndescription: x\n---\ndifferent\n',
    ),
  ],
};
