# Task 19 Brief: Generic migrate-symlink wiring

**Plan:** /Users/matt/Repos/ai/harness-hub/docs/current/2026-09-20-0021-harness-hub-mvp/harness-hub-mvp.plan.md (Task 19, plan lines 2871–2999)

**Repo:** /Users/matt/Repos/ai/harness-hub (branch `initial-harness-hub`) — work in the repo root directly; the current HEAD (95b4334) already contains Tasks 1–18.

**Files:**
- Create: `src/wiring/migrateSymlink.ts`
- Test: `src/wiring/migrateSymlink.test.ts`

**Interfaces:**
- Consumes: `ensureGitignoreEntries`, `isSymlinkTo`, `relativeSymlinkTarget` (Task 8, `src/fsutil.ts`), `skillsRootDir`, `AGENTS_MD_FILENAME` (Task 6, `src/canon.ts`), `HarnessEntry` (Task 4, `src/registry`).
- Produces: `wireMigrateSymlinkHarness(repoRoot, entry): void`.

This is the actual filesystem-mutating half of `enable` for any harness whose registry entry has a symlink-based `agentsDoc` or `migrate-symlink` `skills` mode. It assumes doctor's blocking checks have already passed (no unmigrated/collision entries remain) — that precondition is enforced by the `enable` command (Task 20), not here.

## Step 1: Write the failing tests

```typescript
// src/wiring/migrateSymlink.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, lstatSync, readlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wireMigrateSymlinkHarness } from './migrateSymlink';
import { getHarnessEntry } from '../registry';

describe('wireMigrateSymlinkHarness', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-wiring-'));
    writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('creates both symlinks from a clean repo', () => {
    wireMigrateSymlinkHarness(repoRoot, getHarnessEntry('claude-code'));
    expect(readlinkSync(join(repoRoot, 'CLAUDE.md'))).toBe('AGENTS.md');
    expect(readlinkSync(join(repoRoot, '.claude', 'skills'))).toBe(join('..', '.agents', 'skills'));
  });

  it('is idempotent when the symlinks already exist', () => {
    wireMigrateSymlinkHarness(repoRoot, getHarnessEntry('claude-code'));
    wireMigrateSymlinkHarness(repoRoot, getHarnessEntry('claude-code'));
    expect(lstatSync(join(repoRoot, 'CLAUDE.md')).isSymbolicLink()).toBe(true);
  });

  it('replaces a real .claude/skills directory that only contains already-migrated content', () => {
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'body');
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'body');

    wireMigrateSymlinkHarness(repoRoot, getHarnessEntry('claude-code'));

    expect(lstatSync(join(repoRoot, '.claude', 'skills')).isSymbolicLink()).toBe(true);
  });

  it('replaces a foreign CLAUDE.md (the --force path)', () => {
    writeFileSync(join(repoRoot, 'CLAUDE.md'), '# hand-written\n');
    wireMigrateSymlinkHarness(repoRoot, getHarnessEntry('claude-code'));
    expect(readlinkSync(join(repoRoot, 'CLAUDE.md'))).toBe('AGENTS.md');
  });

  it('adds both paths to .gitignore', () => {
    wireMigrateSymlinkHarness(repoRoot, getHarnessEntry('claude-code'));
    const gitignore = readFileSync(join(repoRoot, '.gitignore'), 'utf8');
    expect(gitignore).toContain('CLAUDE.md');
    expect(gitignore).toContain('.claude/skills');
  });
});
```

## Step 2: Run tests to verify they fail

Run: `npx vitest run src/wiring/migrateSymlink.test.ts`
Expected: FAIL — module not found.

## Step 3: Implement

```typescript
// src/wiring/migrateSymlink.ts
import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ensureGitignoreEntries, isSymlinkTo, relativeSymlinkTarget } from '../fsutil';
import { skillsRootDir, AGENTS_MD_FILENAME } from '../canon';
import type { HarnessEntry } from '../registry';

function ensureSymlink(repoRoot: string, linkRelPath: string, targetAbsPath: string): void {
  const linkAbsPath = join(repoRoot, linkRelPath);
  const target = relativeSymlinkTarget(repoRoot, linkRelPath, targetAbsPath);
  if (existsSync(linkAbsPath) && !isSymlinkTo(linkAbsPath, target)) {
    rmSync(linkAbsPath, { recursive: true, force: true });
  }
  if (!existsSync(linkAbsPath)) {
    mkdirSync(dirname(linkAbsPath), { recursive: true });
    symlinkSync(target, linkAbsPath);
  }
}

/**
 * Wires a harness's AGENTS.md symlink and/or skills symlink per its registry
 * entry. Assumes doctor's blocking checks (clobber-risk, unmigrated-skills,
 * skill-migration-collision) already passed for this harness.
 */
export function wireMigrateSymlinkHarness(repoRoot: string, entry: HarnessEntry): void {
  if (entry.skills.mode === 'migrate-symlink' && entry.skills.symlinkPath) {
    ensureSymlink(repoRoot, entry.skills.symlinkPath, skillsRootDir(repoRoot));
  }
  if (entry.agentsDoc.mode === 'symlink' && entry.agentsDoc.symlinkPath) {
    ensureSymlink(repoRoot, entry.agentsDoc.symlinkPath, join(repoRoot, AGENTS_MD_FILENAME));
  }
  const gitignoreEntries = [entry.agentsDoc.symlinkPath, entry.skills.symlinkPath].filter(
    (p): p is string => Boolean(p)
  );
  if (gitignoreEntries.length > 0) {
    ensureGitignoreEntries(repoRoot, gitignoreEntries);
  }
}
```

## Step 4: Run tests to verify they pass

Run: `npx vitest run src/wiring/migrateSymlink.test.ts`
Expected: PASS (5 tests).

Also run the full suite and typecheck before committing:
- `npx vitest run` (all green)
- `npm run typecheck` (clean)

## Step 5: Commit

```bash
git add src/wiring/migrateSymlink.ts src/wiring/migrateSymlink.test.ts
git commit -m "feat: generic migrate-symlink wiring for AGENTS.md + skills"
```

## TDD discipline

Follow RED → GREEN exactly as in previous tasks: write the test file first, run it to see the failure (module not found), then implement, then run to green. Include the RED and GREEN command outputs in your report.

## Report

When done, write your implementation report to:
/Users/matt/Repos/ai/harness-hub/docs/current/2026-09-20-0021-harness-hub-mvp/tasks/19-generic-migrate-symlink-wiring/2026-09-20-1557-19-generic-migrate-symlink-wiring.report.md

The report must include: commits made (hashes), test evidence (RED + GREEN + full suite + typecheck), any deviations from the brief with rationale, and anything you noticed but did not change (deferred notes for the reviewer).
