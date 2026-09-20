import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { dirsByteIdentical } from '../fsutil';
import { skillsRootDir } from '../canon';
import type { HarnessEntry } from '../registry';

export interface SkillMigrationEntryPlan {
  name: string;
  harnessSkillPath: string;
  canonSkillPath: string;
  classification: 'new' | 'identical' | 'collision';
}

/** Directory names directly under a migrate-symlink harness's own skills dir. Empty if that dir is absent, or the harness isn't migrate-symlink. */
export function listHarnessSkillDirNames(repoRoot: string, entry: HarnessEntry): string[] {
  if (entry.skills.mode !== 'migrate-symlink' || !entry.skills.symlinkPath) return [];
  const dir = join(repoRoot, entry.skills.symlinkPath);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

/** Classifies every entry under a migrate-symlink harness's own skills dir against canon `.agents/skills/<name>/`. */
export function planSkillMigration(repoRoot: string, entry: HarnessEntry): SkillMigrationEntryPlan[] {
  if (!entry.skills.symlinkPath) return [];
  return listHarnessSkillDirNames(repoRoot, entry).map((name) => {
    const harnessSkillPath = join(repoRoot, entry.skills.symlinkPath as string, name);
    const canonSkillPath = join(skillsRootDir(repoRoot), name);
    let classification: SkillMigrationEntryPlan['classification'];
    if (!existsSync(canonSkillPath)) {
      classification = 'new';
    } else if (dirsByteIdentical(harnessSkillPath, canonSkillPath)) {
      classification = 'identical';
    } else {
      classification = 'collision';
    }
    return { name, harnessSkillPath, canonSkillPath, classification };
  });
}
