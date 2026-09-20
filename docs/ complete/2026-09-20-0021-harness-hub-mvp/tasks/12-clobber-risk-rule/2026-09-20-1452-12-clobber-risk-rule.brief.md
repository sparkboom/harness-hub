## Task 12: Clobber-risk rule (registry-driven)

**Files:**
- Create: `src/doctor/rules/clobberRisk.ts`
- Test: `src/doctor/rules/clobberRisk.test.ts`

**Interfaces:**
- Consumes: `isSymlinkTo`, `relativeSymlinkTarget` (Task 8), `skillsRootDir`, `AGENTS_MD_FILENAME` (Task 6), `ALL_HARNESS_IDS` (Task 3), `getHarnessEntry` (Task 4).
- Produces: `clobberRiskRule: DoctorRule`.

Loops over every registry entry with a symlink-based `agentsDoc` or `migrate-symlink` `skills` mode — today only `claude-code` qualifies, but nothing here hardcodes that id.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/doctor/rules/clobberRisk.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clobberRiskRule } from './clobberRisk';
import type { DoctorContext } from '../types';

function makeCtx(repoRoot: string, pendingHarnesses: DoctorContext['pendingHarnesses'] = []): DoctorContext {
  return { repoRoot, homeDir: '/home/user', config: { status: 'absent' }, configuredHarnesses: [], pendingHarnesses };
}

describe('clobberRiskRule', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-clobber-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('does not apply when claude-code is not configured or pending', () => {
    expect(clobberRiskRule.applies(makeCtx(repoRoot))).toBe(false);
  });

  it('applies when claude-code is pending', () => {
    expect(clobberRiskRule.applies(makeCtx(repoRoot, ['claude-code']))).toBe(true);
  });

  it('passes when CLAUDE.md is the expected symlink', () => {
    writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
    symlinkSync('AGENTS.md', join(repoRoot, 'CLAUDE.md'));
    expect(clobberRiskRule.check(makeCtx(repoRoot, ['claude-code']))).toEqual([]);
  });

  it('flags a hand-written CLAUDE.md', () => {
    writeFileSync(join(repoRoot, 'CLAUDE.md'), '# hand-written\n');
    const findings = clobberRiskRule.check(makeCtx(repoRoot, ['claude-code']));
    expect(findings.some((f) => f.message.includes('CLAUDE.md'))).toBe(true);
    expect(findings.every((f) => f.forceable)).toBe(true);
  });

  it('flags a .claude/skills symlink pointing elsewhere', () => {
    mkdirSync(join(repoRoot, '.claude'), { recursive: true });
    symlinkSync('/somewhere/else', join(repoRoot, '.claude', 'skills'));
    const findings = clobberRiskRule.check(makeCtx(repoRoot, ['claude-code']));
    expect(findings.some((f) => f.message.includes('.claude/skills'))).toBe(true);
  });

  it('does not flag .claude/skills when it is a real directory (handled by the skill-migration rule instead)', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills'), { recursive: true });
    expect(clobberRiskRule.check(makeCtx(repoRoot, ['claude-code']))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/doctor/rules/clobberRisk.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/doctor/rules/clobberRisk.ts
import { existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { isSymlinkTo, relativeSymlinkTarget } from '../../fsutil';
import { skillsRootDir, AGENTS_MD_FILENAME } from '../../canon';
import { ALL_HARNESS_IDS } from '../../harnesses';
import { getHarnessEntry } from '../../registry';
import type { DoctorRule, Finding } from '../types';

function isRelevant(ctx: Parameters<DoctorRule['check']>[0], id: (typeof ALL_HARNESS_IDS)[number]): boolean {
  return ctx.configuredHarnesses.includes(id) || ctx.pendingHarnesses.includes(id);
}

export const clobberRiskRule: DoctorRule = {
  id: 'clobber-risk',
  applies: (ctx) =>
    ALL_HARNESS_IDS.some((id) => {
      const entry = getHarnessEntry(id);
      return isRelevant(ctx, id) && (entry.agentsDoc.mode === 'symlink' || entry.skills.mode === 'migrate-symlink');
    }),
  check: (ctx) => {
    const findings: Finding[] = [];
    for (const id of ALL_HARNESS_IDS) {
      if (!isRelevant(ctx, id)) continue;
      const entry = getHarnessEntry(id);

      if (entry.agentsDoc.mode === 'symlink' && entry.agentsDoc.symlinkPath) {
        const linkPath = join(ctx.repoRoot, entry.agentsDoc.symlinkPath);
        const target = relativeSymlinkTarget(ctx.repoRoot, entry.agentsDoc.symlinkPath, join(ctx.repoRoot, AGENTS_MD_FILENAME));
        if (existsSync(linkPath) && !isSymlinkTo(linkPath, target)) {
          findings.push({
            ruleId: 'clobber-risk',
            severity: 'error',
            message: `${entry.agentsDoc.symlinkPath} exists and is not a symlink to AGENTS.md.`,
            remediation: `Remove or back up ${entry.agentsDoc.symlinkPath}, or re-run enable with --force to replace it.`,
            harnessId: id,
            forceable: true,
          });
        }
      }

      if (entry.skills.mode === 'migrate-symlink' && entry.skills.symlinkPath) {
        const linkPath = join(ctx.repoRoot, entry.skills.symlinkPath);
        const target = relativeSymlinkTarget(ctx.repoRoot, entry.skills.symlinkPath, skillsRootDir(ctx.repoRoot));
        if (existsSync(linkPath) && lstatSync(linkPath).isSymbolicLink() && !isSymlinkTo(linkPath, target)) {
          findings.push({
            ruleId: 'clobber-risk',
            severity: 'error',
            message: `${entry.skills.symlinkPath} is a symlink, but not to .agents/skills.`,
            remediation: `Remove the existing ${entry.skills.symlinkPath} symlink, or re-run enable with --force to replace it.`,
            harnessId: id,
            forceable: true,
          });
        }
      }
    }
    return findings;
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/doctor/rules/clobberRisk.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/doctor/rules/clobberRisk.ts src/doctor/rules/clobberRisk.test.ts
git commit -m "feat: clobber-risk doctor rule, driven by the harness registry"
```

---

