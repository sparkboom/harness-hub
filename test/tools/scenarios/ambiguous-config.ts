import { raw } from '../primitives';
import type { Scenario } from './index';
import { validAgentsDoc, validSkill, harnessConfig } from './shared';

export const ambiguousConfig: Scenario = {
  name: 'ambiguous-config',
  description: 'Both harness-hub.yaml and harness-hub.json present (config-validity → config-ambiguous).',
  assets: () => [
    validAgentsDoc(),
    validSkill(),
    harnessConfig([]),
    raw('harness-hub.json', '{"harnesses":[]}\n'),
  ],
};
