# Task 16 Brief: Generated-file-drift rule (registry-driven)

**Plan:** /Users/matt/Repos/ai/harness-hub/docs/current/2026-09-20-0021-harness-hub-mvp/harness-hub-mvp.plan.md (Task 16, plan lines 2512–2638)

**Repo:** /Users/matt/Repos/ai/harness-hub (branch `initial-harness-hub`) — work in the repo root directly; the current HEAD (4cfb564) already contains Tasks 1–15.

**Files:**
- Create: `src/doctor/rules/generatedFileDrift.ts`
- Test: `src/doctor/rules/generatedFileDrift.test.ts`

**Interfaces:**
- Consumes: `isSymlinkTo`, `relativeSymlinkTarget` (Task 8, `src/fsutil.ts`), `skillsRootDir`, `AGENTS_MD_FILENAME` (Task 6, `src/canon.ts`), `ALL_HARNESS_IDS` (Task 3, `src/harnesses.ts`), `getHarnessEntry` (Task 4, `src/registry`).
- Produces: `generatedFileDriftRule: DoctorRule`.

Unlike Task 12's clobber-risk rule, this only looks at `configuredHarnesses` (not `pendingHarnesses`) — it's about detecting drift for a harness that's *already* supposed to be wired, so it correctly stays silent during an in-progress `enable` (before the symlinks exist yet).

Context you can rely on (already merged): `src/doctor/types.ts` exports `DoctorContext`, `DoctorRule`, `Finding`. Registry entries expose `agentsDoc` (`mode: 'symlink'` with `symlinkPath`, or other modes) and `skills` (`mode: 'migrate-symlink'` with `symlinkPath`, or other modes).

## Step 1: Write the failing tests

```typescript
// src/doctor/rules/generatedFileDrift.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generatedFileDriftRule } from './generatedFileDrift';
import type { DoctorContext } from '../types';

function makeCtx(repoRoot: string, configuredHarnesses: DoctorContext['configuredHarnesses'] = ['claude-code']): DoctorContext {
  return { repoRoot, homeDir: '/home/user', config: { status: 'absent' }, configuredHarnesses, pendingHarnesses: [] };
}

describe('generatedFileDriftRule', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-drift-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('does not apply when claude-code is not configured', () => {
    expect(generatedFileDriftRule.applies(makeCtx(repoRoot, []))).toBe(false);
  });

  it('warns when the symlinks are missing', () => {
    expect(generatedFileDriftRule.check(makeCtx(repoRoot))).toEqual([
      expect.objectContaining({ ruleId: 'generated-file-drift', severity: 'warning', harnessId: 'claude-code' }),
    ]);
  });

  it('passes when both symlinks are correct', () => {
    writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
    symlinkSync('AGENTS.md', join(repoRoot, 'CLAUDE.md'));
    mkdirSync(join(repoRoot, '.agents', 'skills'), { recursive: true });
    mkdirSync(join(repoRoot, '.claude'), { recursive: true });
    symlinkSync(join('..', '.agents', 'skills'), join(repoRoot, '.claude', 'skills'));
    expect(generatedFileDriftRule.check(makeCtx(repoRoot))).toEqual([]);
  });
});
```

## Step 2: Run tests to verify they fail

Run: `npx vitest run src/doctor/rules/generatedFileDrift.test.ts`
Expected: FAIL — module not found.

## Step 3: Implement

```typescript
// src/doctor/rules/generatedFileDrift.ts
import { join } from 'node:path';
import { isSymlinkTo, relativeSymlinkTarget } from '../../fsutil';
import { skillsRootDir, AGENTS_MD_FILENAME } from '../../canon';
import { ALL_HARNESS_IDS } from '../../harnesses';
import { getHarnessEntry } from '../../registry';
import type { DoctorRule, Finding } from '../types';

export const generatedFileDriftRule: DoctorRule = {
  id: 'generated-file-drift',
  applies: (ctx) =>
    ALL_HARNESS_IDS.some((id) => {
      const entry = getHarnessEntry(id);
      return ctx.configuredHarnesses.includes(id) && (entry.agentsDoc.mode === 'symlink' || entry.skills.mode === 'migrate-symlink');
    }),
  check: (ctx) => {
    const findings: Finding[] = [];
    for (const id of ALL_HARNESS_IDS) {
      if (!ctx.configuredHarnesses.includes(id)) continue;
      const entry = getHarnessEntry(id);
      const problems: string[] = [];

      if (entry.agentsDoc.mode === 'symlink' && entry.agentsDoc.symlinkPath) {
        const linkPath = join(ctx.repoRoot, entry.agentsDoc.symlinkPath);
        const target = relativeSymlinkTarget(ctx.repoRoot, entry.agentsDoc.symlinkPath, join(ctx.repoRoot, AGENTS_MD_FILENAME));
        if (!isSymlinkTo(linkPath, target)) problems.push(entry.agentsDoc.symlinkPath);
      }
      if (entry.skills.mode === 'migrate-symlink' && entry.skills.symlinkPath) {
        const linkPath = join(ctx.repoRoot, entry.skills.symlinkPath);
        const target = relativeSymlinkTarget(ctx.repoRoot, entry.skills.symlinkPath, skillsRootDir(ctx.repoRoot));
        if (!isSymlinkTo(linkPath, target)) problems.push(entry.skills.symlinkPath);
      }

      if (problems.length > 0) {
        findings.push({
          ruleId: 'generated-file-drift',
          severity: 'warning',
          message: `${id} is enabled, but ${problems.join(' and ')} ${problems.length > 1 ? 'are' : 'is'} missing or not the expected symlink.`,
          remediation: `Re-run \`harness-hub enable ${id}\` to restore the expected symlink(s).`,
          harnessId: id,
          forceable: false,
        });
      }
    }
    return findings;
  },
};
```

## Step 4: Run tests to verify they pass

Run: `npx vitest run src/doctor/rules/generatedFileDrift.test.ts`
Expected: PASS (3 tests).

Also run the full suite and typecheck before committing:
- `npx vitest run` (all green)
- `npm run typecheck` (clean)

## Step 5: Commit

```bash
git add src/doctor/rules/generatedFileDrift.ts src/doctor/rules/generatedFileDrift.test.ts
git commit -m "feat: generated-file-drift doctor rule, driven by the harness registry"
```

## TDD discipline

Follow RED → GREEN exactly as in previous tasks: write the test file first, run it to see the failure (module not found), then implement, then run to green. Include the RED and GREEN command outputs in your report.

## Report

When done, write your implementation report to:
/Users/matt/Repos/ai/harness-hub/docs/current/2026-09-20-0021-harness-hub-mvp/tasks/16-generated-file-drift-rule/2026-09-20-1532-16-generated-file-drift-rule.report.md

The report must include: commits made (hashes), test evidence (RED + GREEN + full suite + typecheck), any deviations from the brief with rationale, and anything you noticed but did not change (deferred notes for the reviewer).
