import { raw } from '../primitives';
import type { Scenario } from './index';
import { validAgentsDoc } from './shared';

export const configInvalidShape: Scenario = {
  name: 'config-invalid-shape',
  description: 'harness-hub.yaml has no `harnesses` array (config-validity → config-invalid-shape).',
  assets: () => [validAgentsDoc(), raw('harness-hub.yaml', 'foo: bar\n')],
};
