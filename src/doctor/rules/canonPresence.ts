import { hasAgentsMd } from '../../canon';
import type { DoctorRule } from '../types';

export const canonPresenceRule: DoctorRule = {
  id: 'canon-presence',
  applies: () => true,
  check: (ctx) => {
    if (hasAgentsMd(ctx.repoRoot)) return [];
    return [
      {
        ruleId: 'canon-presence',
        severity: 'error',
        message: 'AGENTS.md is missing at the repo root.',
        remediation: 'Create AGENTS.md at the repo root — harness-hub never scaffolds it for you.',
        forceable: false,
      },
    ];
  },
};
