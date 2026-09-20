import { raw } from '../primitives';
import type { Scenario } from './index';
import { validAgentsDoc, validSkill } from './shared';

export const claudeMdClobber: Scenario = {
  name: 'claude-md-clobber',
  description: 'Hand-written CLAUDE.md blocks `enable claude-code` (clobber-risk → claude-md-clobber).',
  assets: () => [validAgentsDoc(), validSkill(), raw('CLAUDE.md', '# hand-written\n')],
};
