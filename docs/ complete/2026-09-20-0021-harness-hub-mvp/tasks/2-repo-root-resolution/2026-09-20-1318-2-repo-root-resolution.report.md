# Task 2 Report: Repo root resolution

## What I implemented

- `src/repo.ts` — exports `findRepoRoot(startDir: string): string` and `class NotAGitRepoError extends Error`, exactly per the brief. `findRepoRoot` walks up from `startDir`, returning the first ancestor containing a `.git` entry (`existsSync` covers both directory and file markers, so linked worktrees work); when `dirname` stops making progress (filesystem root) it throws `NotAGitRepoError(startDir)`.
- `src/repo.test.ts` — 4 tests verbatim from the brief: root itself, walk up from nested `a/b/c`, `.git` file (worktree marker), and `NotAGitRepoError` when no `.git` exists. Tests use real `mkdtempSync`/`rmSync` temp dirs, no mocks.

## Test results

- Focused (`npx vitest run src/repo.test.ts`): 4 passed (4)
- Full suite (`npm test`): 2 files, 5 tests passed (Task 1's version tests unaffected)
- `npm run typecheck`: clean, no errors

## TDD Evidence

**RED**

Command: `npx vitest run src/repo.test.ts`

Failing output (excerpt):

```
 FAIL  src/repo.test.ts [ src/repo.test.ts ]
Error: Cannot find module './repo' imported from /Users/matt/Repos/ai/harness-hub/src/repo.test.ts
 ❯ src/repo.test.ts:5:1
      5| import { findRepoRoot, NotAGitRepoError } from './repo';
```

Why expected: the brief specifies exactly this failure (`Cannot find module './repo'`) — the test exercises the not-yet-existing module, proving the tests test the new feature rather than existing behavior.

**GREEN**

Command: `npx vitest run src/repo.test.ts`

Passing output (excerpt):

```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

Followed by `npm test` (5/5 across 2 files) and `npm run typecheck` (clean).

## Files changed

- Created `src/repo.ts` (30 lines)
- Created `src/repo.test.ts` (40 lines)

## Commit

- `9d3284a` — `feat: findRepoRoot, matching Hermes's .git-ancestor resolution` (2 files, +70)

## Self-review findings

- **Completeness:** All 5 brief steps executed in order (RED → verify fail → implement → verify pass → commit).
- **Verbatim values:** Test file and implementation match the brief character-for-character, including the error message string (verified via grep at `src/repo.ts:6`) and the commit message.
- **Discipline (YAGNI):** Nothing beyond the brief — no extra exports, no symlinks module, no path normalization.
- **Testing:** Suite green before commit; output pristine apart from two pre-existing warnings (see Concerns).

## Concerns

- Minor, pre-existing (present in the RED run before any of my code existed): an npm `devdir` config warning and a Vite `configLoader: 'native'` warning about `vitest.config.ts` ESM-as-CJS. Not introduced by this task and not visible to users of the CLI; flagging for the controller in case Task 1's config should be revisited later.
- No blocking issues.
