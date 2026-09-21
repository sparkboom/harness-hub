## Task 11: Skill-shape + skill-frontmatter rules

**Files:**
- Create: `src/doctor/rules/skillShape.ts`
- Create: `src/doctor/rules/skillFrontmatter.ts`
- Test: `src/doctor/rules/skillShape.test.ts`
- Test: `src/doctor/rules/skillFrontmatter.test.ts`

**Interfaces:**
- Consumes: `listSkillDirNames`, `listSkillsRootNonDirEntries`, `readSkillFrontmatter` (Task 6), `validateSkillFrontmatter` (Task 7).
- Produces: `skillShapeRule: DoctorRule`, `skillFrontmatterRule: DoctorRule`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/doctor/rules/skillShape.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { skillShapeRule } from './skillShape';
import type { DoctorContext } from '../types';

function makeCtx(repoRoot: string): DoctorContext {
  return { repoRoot, homeDir: '/home/user', config: { status: 'absent' }, configuredHarnesses: [], pendingHarnesses: [] };
}

describe('skillShapeRule', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-skillshape-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('passes for a well-formed skill', () => {
    const dir = join(repoRoot, '.agents', 'skills', 'writing-tests');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: writing-tests\ndescription: x\n---\n');
    expect(skillShapeRule.check(makeCtx(repoRoot))).toEqual([]);
  });

  it('flags a skill directory with no SKILL.md', () => {
    mkdirSync(join(repoRoot, '.agents', 'skills', 'empty'), { recursive: true });
    const findings = skillShapeRule.check(makeCtx(repoRoot));
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('empty');
  });

  it('flags a flat .md file at the skills root', () => {
    mkdirSync(join(repoRoot, '.agents', 'skills'), { recursive: true });
    writeFileSync(join(repoRoot, '.agents', 'skills', 'stray.md'), '# stray');
    const findings = skillShapeRule.check(makeCtx(repoRoot));
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('stray.md');
  });
});
```

```typescript
// src/doctor/rules/skillFrontmatter.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { skillFrontmatterRule } from './skillFrontmatter';
import type { DoctorContext } from '../types';

function makeCtx(repoRoot: string): DoctorContext {
  return { repoRoot, homeDir: '/home/user', config: { status: 'absent' }, configuredHarnesses: [], pendingHarnesses: [] };
}

describe('skillFrontmatterRule', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-skillfm-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('passes for valid frontmatter', () => {
    const dir = join(repoRoot, '.agents', 'skills', 'writing-tests');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: writing-tests\ndescription: x\n---\n');
    expect(skillFrontmatterRule.check(makeCtx(repoRoot))).toEqual([]);
  });

  it('flags a name/directory mismatch', () => {
    const dir = join(repoRoot, '.agents', 'skills', 'writing-tests');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: other\ndescription: x\n---\n');
    expect(skillFrontmatterRule.check(makeCtx(repoRoot)).length).toBeGreaterThan(0);
  });

  it('skips directories with no SKILL.md (left to skill-shape rule)', () => {
    mkdirSync(join(repoRoot, '.agents', 'skills', 'empty'), { recursive: true });
    expect(skillFrontmatterRule.check(makeCtx(repoRoot))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/doctor/rules/skillShape.test.ts src/doctor/rules/skillFrontmatter.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `skillShapeRule`**

```typescript
// src/doctor/rules/skillShape.ts
import { listSkillDirNames, listSkillsRootNonDirEntries, readSkillFrontmatter } from '../../canon';
import type { DoctorRule, Finding } from '../types';

export const skillShapeRule: DoctorRule = {
  id: 'skill-shape',
  applies: () => true,
  check: (ctx) => {
    const findings: Finding[] = [];
    for (const entryName of listSkillsRootNonDirEntries(ctx.repoRoot)) {
      findings.push({
        ruleId: 'skill-shape',
        severity: 'error',
        message: `.agents/skills/${entryName} is not a directory — skills must be laid out as <name>/SKILL.md.`,
        remediation: `Move ${entryName} into its own <skill-name>/SKILL.md directory.`,
        forceable: false,
      });
    }
    for (const name of listSkillDirNames(ctx.repoRoot)) {
      const { hasSkillMd } = readSkillFrontmatter(ctx.repoRoot, name);
      if (!hasSkillMd) {
        findings.push({
          ruleId: 'skill-shape',
          severity: 'error',
          message: `.agents/skills/${name}/ has no SKILL.md.`,
          remediation: `Add .agents/skills/${name}/SKILL.md, or remove the directory if it isn't a skill.`,
          forceable: false,
        });
      }
    }
    return findings;
  },
};
```

- [ ] **Step 4: Implement `skillFrontmatterRule`**

```typescript
// src/doctor/rules/skillFrontmatter.ts
import { listSkillDirNames, readSkillFrontmatter } from '../../canon';
import { validateSkillFrontmatter } from '../../skills/validate';
import type { DoctorRule, Finding } from '../types';

export const skillFrontmatterRule: DoctorRule = {
  id: 'skill-frontmatter',
  applies: () => true,
  check: (ctx) => {
    const findings: Finding[] = [];
    for (const name of listSkillDirNames(ctx.repoRoot)) {
      const { hasSkillMd, frontmatter } = readSkillFrontmatter(ctx.repoRoot, name);
      if (!hasSkillMd) continue; // reported by skill-shape instead
      for (const issue of validateSkillFrontmatter(name, frontmatter)) {
        findings.push({
          ruleId: 'skill-frontmatter',
          severity: 'error',
          message: issue.message,
          remediation: `Fix the frontmatter in .agents/skills/${name}/SKILL.md.`,
          forceable: false,
        });
      }
    }
    return findings;
  },
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/doctor/rules/skillShape.test.ts src/doctor/rules/skillFrontmatter.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/doctor/rules/skillShape.ts src/doctor/rules/skillShape.test.ts src/doctor/rules/skillFrontmatter.ts src/doctor/rules/skillFrontmatter.test.ts
git commit -m "feat: skill-shape and skill-frontmatter doctor rules"
```

---

