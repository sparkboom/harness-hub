// src/commands/migrate.ts
import { copyDirRecursive } from '../fsutil';
import { planSkillMigration } from '../skills/skillMigrationPlan';
import { getHarnessEntry } from '../registry';
import type { HarnessId } from '../harnesses';

export interface MigrateCommandResult {
  output: string;
  exitCode: number;
}

export function migrateHarness(repoRoot: string, harnessId: HarnessId): MigrateCommandResult {
  const entry = getHarnessEntry(harnessId);
  if (entry.skills.mode !== 'migrate-symlink') {
    return {
      output: `harness-hub migrate: nothing to do for "${harnessId}" — it reads canon natively with no pre-existing content to adopt in this deliverable.`,
      exitCode: 1,
    };
  }

  const plan = planSkillMigration(repoRoot, entry);

  const collisions = plan.filter((e) => e.classification === 'collision');
  if (collisions.length > 0) {
    const lines = collisions.map(
      (e) => `  ${entry.skills.symlinkPath}/${e.name}/SKILL.md differs from .agents/skills/${e.name}/SKILL.md`
    );
    return {
      output: `harness-hub migrate: skill migration collision(s), fix by hand and re-run:\n${lines.join('\n')}`,
      exitCode: 1,
    };
  }

  const toCopy = plan.filter((e) => e.classification === 'new');
  if (toCopy.length === 0) {
    return { output: 'harness-hub migrate: nothing to migrate.', exitCode: 0 };
  }

  for (const planEntry of toCopy) {
    copyDirRecursive(planEntry.harnessSkillPath, planEntry.canonSkillPath);
  }

  return {
    output: `harness-hub migrate: adopted ${toCopy.length} skill(s) into canon: ${toCopy.map((e) => e.name).join(', ')}`,
    exitCode: 0,
  };
}
