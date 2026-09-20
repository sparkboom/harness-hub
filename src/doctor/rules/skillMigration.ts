import { ALL_HARNESS_IDS, type HarnessId } from '../../harnesses';
import { getHarnessEntry } from '../../registry';
import { planSkillMigration } from '../../skills/skillMigrationPlan';
import type { DoctorContext, DoctorRule, Finding } from '../types';

function migrateSymlinkHarnessIds(): HarnessId[] {
  return ALL_HARNESS_IDS.filter((id) => getHarnessEntry(id).skills.mode === 'migrate-symlink');
}

function isRelevant(ctx: DoctorContext, id: HarnessId): boolean {
  return ctx.configuredHarnesses.includes(id) || ctx.pendingHarnesses.includes(id);
}

export const skillMigrationRule: DoctorRule = {
  id: 'skill-migration',
  applies: (ctx) => migrateSymlinkHarnessIds().some((id) => isRelevant(ctx, id)),
  check: (ctx) => {
    const findings: Finding[] = [];
    for (const id of migrateSymlinkHarnessIds()) {
      if (!isRelevant(ctx, id)) continue;
      const entry = getHarnessEntry(id);
      for (const planEntry of planSkillMigration(ctx.repoRoot, entry)) {
        if (planEntry.classification === 'new') {
          findings.push({
            ruleId: 'unmigrated-skills',
            severity: 'error',
            message: `${entry.skills.symlinkPath}/${planEntry.name}/ has no counterpart yet in .agents/skills/${planEntry.name}/.`,
            remediation: `Run \`harness-hub migrate ${id}\` to adopt it into canon.`,
            harnessId: id,
            forceable: false,
          });
        } else if (planEntry.classification === 'collision') {
          findings.push({
            ruleId: 'skill-migration-collision',
            severity: 'error',
            message: `${entry.skills.symlinkPath}/${planEntry.name}/SKILL.md differs from .agents/skills/${planEntry.name}/SKILL.md.`,
            remediation: 'Reconcile by hand (rename one, merge manually, or delete the stale copy), then re-run migrate.',
            harnessId: id,
            forceable: false,
          });
        }
      }
    }
    return findings;
  },
};
