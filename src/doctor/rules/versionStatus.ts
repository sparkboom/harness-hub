import { ALL_HARNESS_IDS, type HarnessId } from '../../harnesses';
import { resolveHarnessStatus } from '../../registry';
import type { DoctorContext, DoctorRule, Finding } from '../types';

function isRelevant(ctx: DoctorContext, id: HarnessId): boolean {
  return ctx.configuredHarnesses.includes(id) || ctx.pendingHarnesses.includes(id);
}

export const versionStatusRule: DoctorRule = {
  id: 'version-status',
  applies: (ctx) => ALL_HARNESS_IDS.some((id) => isRelevant(ctx, id)),
  check: (ctx) => {
    const findings: Finding[] = [];
    for (const id of ALL_HARNESS_IDS) {
      if (!isRelevant(ctx, id)) continue;
      const installed = ctx.installedVersions[id];
      const status = resolveHarnessStatus(id, installed).status;
      if (status === 'unrecognized') {
        findings.push({
          ruleId: 'version-unrecognized',
          severity: 'warning',
          message: `${id}: installed version ${installed ?? 'unknown'} matches no verified range.`,
          remediation: 'Run `reconcile --check`, then review the version (see scenarios.md).',
          harnessId: id,
          forceable: false,
        });
      } else if (status === 'unverified') {
        findings.push({
          ruleId: 'version-unverified',
          severity: 'warning',
          message: `${id}: installed version ${installed} is in an unverified range (upstream moved).`,
          remediation: 'Run `reconcile --check`, then review the version (see scenarios.md).',
          harnessId: id,
          forceable: false,
        });
      }
    }
    return findings;
  },
};
