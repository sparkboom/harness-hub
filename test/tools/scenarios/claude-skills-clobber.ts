import { mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { Scenario } from './index';
import { validAgentsDoc, validSkill } from './shared';

export const claudeSkillsClobber: Scenario = {
  name: 'claude-skills-clobber',
  description: '.claude/skills is a symlink pointing outside the repo (clobber-risk → claude-skills-clobber).',
  assets: () => [validAgentsDoc(), validSkill()],
  actions: (target) => {
    mkdirSync(join(target, '.claude'), { recursive: true });
    symlinkSync('/somewhere/else', join(target, '.claude', 'skills'));
  },
};
