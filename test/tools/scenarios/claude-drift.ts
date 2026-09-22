import { mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { Scenario } from './index';
import { validAgentsDoc, validSkill } from './shared';

export const claudeDrift: Scenario = {
  name: 'claude-drift',
  description: 'Wired claude-code whose CLAUDE.md symlink is then removed (generated-file-drift → claude-drift).',
  assets: () => [validAgentsDoc(), validSkill()],
  actions: (target) => {
    symlinkSync('AGENTS.md', join(target, 'CLAUDE.md'));
    mkdirSync(join(target, '.claude'), { recursive: true });
    symlinkSync(join('..', '.agents', 'skills'), join(target, '.claude', 'skills'));
    rmSync(join(target, 'CLAUDE.md')); // introduce drift
  },
};
