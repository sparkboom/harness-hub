import { raw } from '../primitives';
import type { Scenario } from './index';
import { validAgentsDoc } from './shared';

export const configParseError: Scenario = {
  name: 'config-parse-error',
  description: 'harness-hub.yaml is malformed YAML (config-validity → config-parse-error).',
  assets: () => [validAgentsDoc(), raw('harness-hub.yaml', 'harnesses: [unclosed\n')],
};
