import type { DoctorRule } from '../types';

export const configValidityRule: DoctorRule = {
  id: 'config-validity',
  applies: () => true,
  check: (ctx) => {
    const { config } = ctx;
    switch (config.status) {
      case 'absent':
        return [];
      case 'ok':
        if (config.unknownIds.length === 0) return [];
        return [
          {
            ruleId: 'config-validity',
            severity: 'error',
            message: `${config.path} lists unrecognized harness id(s): ${config.unknownIds.join(', ')}`,
            remediation: 'Remove or fix the unrecognized id(s) in the "harnesses" list.',
            forceable: false,
          },
        ];
      case 'ambiguous':
        return [
          {
            ruleId: 'config-validity',
            severity: 'error',
            message: `Both ${config.yamlPath} and ${config.jsonPath} exist.`,
            remediation: 'Keep exactly one of harness-hub.yaml / harness-hub.json and delete the other.',
            forceable: false,
          },
        ];
      case 'parse-error':
        return [
          {
            ruleId: 'config-validity',
            severity: 'error',
            message: `${config.path} could not be parsed: ${config.error}`,
            remediation: `Fix the syntax error in ${config.path}.`,
            forceable: false,
          },
        ];
      case 'invalid-shape':
        return [
          {
            ruleId: 'config-validity',
            severity: 'error',
            message: `${config.path} is invalid: ${config.reason}`,
            remediation: `Fix ${config.path} so it has a top-level "harnesses" array.`,
            forceable: false,
          },
        ];
    }
  },
};
