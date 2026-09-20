## Task 13: Skill migration classification (registry-driven)

**Files:**
- Create: `src/skills/skillMigrationPlan.ts`
- Test: `src/skills/skillMigrationPlan.test.ts`

**Interfaces:**
- Consumes: `dirsByteIdentical` (Task 8), `skillsRootDir` (Task 6), `HarnessEntry` (Task 4).
- Produces: `SkillMigrationEntryPlan`, `listHarnessSkillDirNames(repoRoot, entry): string[]`, `planSkillMigration(repoRoot, entry): SkillMigrationEntryPlan[]`.

This classification is shared by the doctor rule (Task 14) and the `migrate` command (Task 21) — one function, two consumers, so they can never disagree about what counts as "new" vs "collision."

- [ ] **Step 1: Write the failing tests**

```typescript
// src/skills/skillMigrationPlan.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planSkillMigration } from './skillMigrationPlan';
import { getHarnessEntry } from '../registry';

describe('planSkillMigration', () => {
  let repoRoot: string;
  const claudeCode = getHarnessEntry('claude-code');

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-migplan-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('returns an empty plan when .claude/skills does not exist', () => {
    expect(planSkillMigration(repoRoot, claudeCode)).toEqual([]);
  });

  it('classifies a skill with no canon counterpart as new', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'body');
    const plan = planSkillMigration(repoRoot, claudeCode);
    expect(plan).toEqual([expect.objectContaining({ name: 'a', classification: 'new' })]);
  });

  it('classifies a byte-identical skill as identical', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'body');
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'body');
    expect(planSkillMigration(repoRoot, claudeCode)[0].classification).toBe('identical');
  });

  it('classifies a differing skill as a collision', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'body-one');
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'body-two');
    expect(planSkillMigration(repoRoot, claudeCode)[0].classification).toBe('collision');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/skills/skillMigrationPlan.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/skills/skillMigrationPlan.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/skills/skillMigrationPlan.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/skills/skillMigrationPlan.ts src/skills/skillMigrationPlan.test.ts
git commit -m "feat: registry-driven skill migration classification (new/identical/collision)"
```

---

