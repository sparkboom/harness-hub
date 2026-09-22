# Task 2 Report: Repo/home snapshot + diff

**Status:** DONE_WITH_CONCERNS (implementation complete, tests pass; two deliberate deviations from the brief, documented below)
**Commit:** `4e253ec` — `feat(verify): add repo/home snapshot and diff`
**Branch:** `harness-version-mgmt-plan-b` (parent: Task 1, `8d1cf02`)
**Files created:**
- `test/tools/verify/snapshot.ts`
- `test/tools/verify/snapshot.test.ts`

## What was done

1. **RED:** Wrote `snapshot.test.ts` verbatim from the brief (3 tests: file capture, symlink capture, diffFiles added-path). Confirmed failing (`Failed to resolve import "./snapshot"`).
2. **GREEN:** Implemented `snapshot.ts` per the brief. Confirmed `npx vitest run test/tools/verify/snapshot.test.ts` → **3 passed (3)**.
3. **Typecheck:** `npx tsc -p test/tools/tsconfig.json --noEmit` → exit 0. No `src/` imports used; `Snapshot`/`FileEntry` imported from `./schema` as required by the Task 1 ruling.
4. **Regression:** `npx vitest run test/tools/verify/` → **2 files, 5 tests passed** (schema tests unaffected).
5. **Commit:** `git add` + `git commit -m "feat(verify): add repo/home snapshot and diff"` → `4e253ec`, 2 files, 83 insertions.

## Deviations from the brief (2) — why they were necessary

1. **Dropped `import { Object } from 'node:util';`** — `node:util` has no named export `Object`; this line cannot typecheck as written. It is clearly an accidental line in the brief (implementation already uses the global `Object.entries`). Removing it was the only way to compile.
2. **Symlink target normalization added to `walk()`:** absolute link targets are converted to root-relative via `relative(base, raw)`. Rationale: the brief's own test creates the symlink with an **absolute** target (`symlinkSync(join(root, 'target-dir'), ...)`) but asserts `target: 'target-dir'`, while the brief's implementation stores `readlinkSync(full)` raw. Taken literally, the brief's implementation fails its own test. Normalization reconciles this. It also makes snapshots comparable across runs where the temp root path differs (relevant to later predicate tasks, e.g. the plan's S6/plan predicate at plan.md:412 checks `claude.target?.includes('.agents/skills/...')` on relative targets).

Everything else — test file, walk logic, `.git` skip, empty-snapshot-on-missing-root, `key()`/`diffFiles` semantics — is verbatim from the brief.

## Verification evidence

- `npx vitest run test/tools/verify/snapshot.test.ts` → `Test Files 1 passed (1)`, `Tests 3 passed (3)`
- `npx vitest run test/tools/verify/` → `Test Files 2 passed (2)`, `Tests 5 passed (5)`
- `npx tsc -p test/tools/tsconfig.json --noEmit` → exit 0

## Concerns

- **Flag for reviewer/planner:** the brief's symlink test/implementation were mutually inconsistent as written (absolute symlink + raw `readlinkSync`). I resolved in favor of the test's expected value and added a normalization comment in `snapshot.ts`. If a downstream task expects *absolute* targets in `FileEntry.target`, revisit — but the plan's predicates inspect relative-style targets (`includes('.agents/skills/...')`), which normalization supports.
- No other concerns; scope was single module + test, fully committed, worktree clean for these files.