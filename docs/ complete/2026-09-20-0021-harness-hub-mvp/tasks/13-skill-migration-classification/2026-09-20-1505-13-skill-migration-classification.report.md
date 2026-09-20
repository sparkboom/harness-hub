# Task 13 Report: Skill migration classification (registry-driven)

**Status:** DONE
**Branch:** `initial-harness-hub`
**Commit:** `3293062` — `feat: registry-driven skill migration classification (new/identical/collision)`

## Implementation

Created the shared classifier that both the doctor rule (Task 14) and the `migrate`
command (Task 21) will consume, so they can never disagree about what counts as
new / identical / collision.

- `src/skills/skillMigrationPlan.ts`
  - `SkillMigrationEntryPlan` — `{ name, harnessSkillPath, canonSkillPath, classification: 'new' | 'identical' | 'collision' }`
  - `listHarnessSkillDirNames(repoRoot, entry)` — directory names directly under a
    migrate-symlink harness's own skills dir; empty when the harness isn't
    `migrate-symlink`, has no `symlinkPath`, or the dir is absent.
  - `planSkillMigration(repoRoot, entry)` — for each real directory under the
    harness's own skills dir, classifies against canon `.agents/skills/<name>/`:
    `new` (absent in canon), `identical` (byte-identical), `collision` (differs).
- `src/skills/skillMigrationPlan.test.ts` — 4 tests, verbatim from the brief.

Consumes, per brief: `dirsByteIdentical` (Task 8, `src/fsutil.ts`),
`skillsRootDir` (Task 6, `src/canon.ts`), `HarnessEntry` (Task 4, `src/registry`).
The registry's `claude-code` entry (`migrate-symlink`, `.claude/skills`) drives the
tests. Byte-identity inherits Task 8's symlink semantics (a symlink is never
byte-identical to a real file/dir; symlink pairs compare stored targets).

## TDD Evidence

- **RED** — Step 2: `npx vitest run src/skills/skillMigrationPlan.test.ts`
  Failed exactly as the brief predicted:
  `Error: Cannot find module './skillMigrationPlan'` (0 tests collected, 1 suite failed).
- **GREEN** — Step 4, after implementing:
  - Focused: `Test Files 1 passed (1)`, `Tests 4 passed (4)`.
  - Full suite before committing (`npm test`): `Test Files 15 passed (15)`, `Tests 83 passed (83)`.

## Files Changed

- Created `src/skills/skillMigrationPlan.ts` (+34)
- Created `src/skills/skillMigrationPlan.test.ts` (+51)
- Commit contains only these two files (a pre-existing untracked insight doc in
  `docs/current/…harness-hub-future/…` was left untouched).

## Self-Review

- **Completeness:** All 5 brief steps executed in order (test → RED → implement → GREEN → commit); commit message verbatim; exports and signatures match the brief's Interfaces section exactly.
- **Quality:** Code is verbatim from the brief. The `entry.skills.symlinkPath as string` cast is required because TS narrowing from the `planSkillMigration` guard doesn't flow into the closure; it's safe since `listHarnessSkillDirNames` independently guards mode + `symlinkPath`.
- **Discipline (YAGNI):** Nothing beyond the brief — no extra options, no recursion into skill subdirs, no migration execution (that's Task 21).
- **Testing:** Pristine output; only the repo's pre-existing npm/Vite config warnings appear on every run.

## Concerns

None blocking. Two behavioral notes for downstream tasks (both are the brief's specified behavior, not deviations):

1. Non-directory entries directly under the harness skills dir (stray flat files) are ignored by this classifier — `listHarnessSkillDirNames` filters to `isDirectory()` per the brief.
2. `planSkillMigration` returns `[]` for non-migrate-symlink harnesses (e.g. `native` mode), so Task 14/21 must treat an empty plan as "nothing to migrate," not "error."
