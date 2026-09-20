// src/commands/migrate.ts
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { copyDirRecursive } from '../fsutil';
import { planSkillMigration } from '../skills/skillMigrationPlan';
import { validateSkillFrontmatter } from '../skills/validate';
import { getHarnessEntry } from '../registry';
import type { HarnessId } from '../harnesses';

export interface MigrateCommandResult {
  output: string;
  exitCode: number;
}

/**
 * Reads the frontmatter of a harness-side SKILL.md, mirroring canon's
 * readSkillFrontmatter semantics: malformed YAML degrades to
 * `frontmatter: undefined` and never throws.
 */
function readHarnessSkillFrontmatter(skillMdPath: string): { hasSkillMd: boolean; frontmatter?: Record<string, unknown> } {
  if (!existsSync(skillMdPath) || !statSync(skillMdPath).isFile()) {
    return { hasSkillMd: false };
  }
  try {
    const raw = readFileSync(skillMdPath, 'utf8');
    const parsed = matter(raw);
    return { hasSkillMd: true, frontmatter: parsed.data };
  } catch {
    return { hasSkillMd: true, frontmatter: undefined };
  }
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

  // Spec §6: validate every entry against the skill-shape/frontmatter contract
  // BEFORE adopting it — anything that fails is a clobber-risk error, because
  // adopting junk would poison every future enable with canon-wide errors.
  const invalid = toCopy.filter((e) => {
    const { hasSkillMd, frontmatter } = readHarnessSkillFrontmatter(join(e.harnessSkillPath, 'SKILL.md'));
    return !hasSkillMd || validateSkillFrontmatter(e.name, frontmatter).length > 0;
  });
  if (invalid.length > 0) {
    const lines = invalid.map(
      (e) => `  ${entry.skills.symlinkPath}/${e.name}/ fails the skill contract (missing or invalid SKILL.md frontmatter)`
    );
    return {
      output: `harness-hub migrate: clobber-risk — refusing to adopt invalid skill(s), fix by hand and re-run:\n${lines.join('\n')}`,
      exitCode: 1,
    };
  }

  for (const planEntry of toCopy) {
    copyDirRecursive(planEntry.harnessSkillPath, planEntry.canonSkillPath);
  }

  return {
    output: `harness-hub migrate: adopted ${toCopy.length} skill(s) into canon: ${toCopy.map((e) => e.name).join(', ')}`,
    exitCode: 0,
  };
}
