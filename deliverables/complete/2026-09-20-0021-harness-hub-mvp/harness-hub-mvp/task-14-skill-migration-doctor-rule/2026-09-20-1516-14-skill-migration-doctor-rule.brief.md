## Task 14: Skill-migration doctor rule

**Files:**
- Create: `src/doctor/rules/skillMigration.ts`
- Test: `src/doctor/rules/skillMigration.test.ts`

**Interfaces:**
- Consumes: `ALL_HARNESS_IDS` (Task 3), `getHarnessEntry` (Task 4), `planSkillMigration` (Task 13).
- Produces: `skillMigrationRule: DoctorRule` — emits `unmigrated-skills` findings for `'new'` entries and `skill-migration-collision` findings for `'collision'` entries (spec §9's two distinct checks, one rule module).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/doctor/rules/skillMigration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { skillMigrationRule } from './skillMigration';
import type { DoctorContext } from '../types';

function makeCtx(repoRoot: string, pendingHarnesses: DoctorContext['pendingHarnesses'] = ['claude-code']): DoctorContext {
  return { repoRoot, homeDir: '/home/user', config: { status: 'absent' }, configuredHarnesses: [], pendingHarnesses };
}

describe('skillMigrationRule', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-migrule-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('does not apply when claude-code is irrelevant', () => {
    expect(skillMigrationRule.applies(makeCtx(repoRoot, []))).toBe(false);
  });

  it('reports unmigrated-skills for a new entry', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'body');
    const findings = skillMigrationRule.check(makeCtx(repoRoot));
    expect(findings).toEqual([
      expect.objectContaining({ ruleId: 'unmigrated-skills', severity: 'error', harnessId: 'claude-code', forceable: false }),
    ]);
  });

  it('reports skill-migration-collision for a differing entry', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'one');
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'two');
    const findings = skillMigrationRule.check(makeCtx(repoRoot));
    expect(findings).toEqual([
      expect.objectContaining({ ruleId: 'skill-migration-collision', severity: 'error', forceable: false }),
    ]);
  });

  it('reports nothing for an already-identical entry', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'same');
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'same');
    expect(skillMigrationRule.check(makeCtx(repoRoot))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/doctor/rules/skillMigration.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/doctor/rules/skillMigration.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/doctor/rules/skillMigration.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/doctor/rules/skillMigration.ts src/doctor/rules/skillMigration.test.ts
git commit -m "feat: skill-migration doctor rule (unmigrated-skills + skill-migration-collision)"
```

---

