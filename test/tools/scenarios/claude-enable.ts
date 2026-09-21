import type { Scenario } from './index';
import { validAgentsDoc, validSkill } from './shared';

export const claudeEnable: Scenario = {
  name: 'claude-enable',
  description: 'Valid canon, ready for `harness-hub enable claude-code` (CLAUDE.md + .claude/skills symlinks).',
  assets: () => [validAgentsDoc(), validSkill()],
};
