# Task 8 Report: Filesystem primitives

## Implementation

Created `src/fsutil.ts` — the shared, dependency-free filesystem primitives for later wiring/doctor modules. Five exports, no imports from `canon`/`registry`/`config` (only `node:fs` and `node:path`):

- `copyDirRecursive(src, dest)` — recursive copy of files and directories; symlinks are recreated with their exact stored target (`readlinkSync` → `symlinkSync`), never followed.
- `dirsByteIdentical(a, b)` — recursive tree comparison: identical sorted entry names, matching file/dir kind per entry (via `lstatSync`, links not followed), byte-identical file contents (`Buffer.equals`); `false` if either root is missing.
- `isSymlinkTo(linkPath, expectedTarget)` — true iff path exists, is a symlink, and `readlinkSync` equals `expectedTarget` exactly.
- `relativeSymlinkTarget(repoRoot, linkRelPath, targetAbsPath)` — `path.relative(dirname(join(repoRoot, linkRelPath)), targetAbsPath)`.
- `ensureGitignoreEntries(repoRoot, entries)` — appends entries missing as exact lines of `repoRoot/.gitignore`; creates the file if absent; avoids duplicated trailing blank lines.

## Deviation from brief implementation code (1, deliberate)

The brief's verbatim `isSymlinkTo` starts with `if (!existsSync(linkPath)) return false;`. `existsSync` **follows** symlinks, so a symlink whose target does not exist (dangling link — e.g. a link to `.agents/skills` before wiring creates it) returns `false` even though the link itself exists. The brief's own test is the spec here: "returns false when the path does not exist" is distinguished from the dangling-target case, and the brief's verbatim code contradicts the test's stated behavior for a path that *does* exist as a symlink. Since the test file was mandated verbatim, the production code was corrected minimally:

- Before (brief): `existsSync` guard → `lstatSync` (which throws on a missing path, contradicting the guard's purpose anyway).
- After: `lstatSync(linkPath)` inside try/catch; catch → `return false` (path does not exist); then symlink-kind check and exact `readlinkSync` comparison as in the brief.

No other code changes; all other functions match the brief verbatim (modulo formatting/prettier line wrapping in `relativeSymlinkTarget`).

## TDD Evidence

- **RED:** Wrote `src/fsutil.test.ts` verbatim from the brief (13 tests). Ran `npx vitest run src/fsutil.test.ts` → FAIL: `Error: Cannot find module './fsutil'` — the expected "module not found" failure (feature missing, not a typo).
- **GREEN (first attempt):** Implemented `src/fsutil.ts` per the brief → 12 passed / 1 failed. The single failure was `isSymlinkTo ... returns true when the symlink resolves to the expected target` (line 80), i.e. the dangling-target case described above — the test caught a real bug in the brief's implementation.
- **GREEN (after fix):** `npx vitest run src/fsutil.test.ts` → 13 passed (13).

## Test Results

- Focused: `npx vitest run src/fsutil.test.ts` → **13 passed (13)**, pristine output (only the pre-existing repo-wide Vite `configLoader: 'native'` warning, present in every run of this repo, unrelated to this task).
- Full suite: `npm test` → **8 test files passed, 49 tests passed**.
- Typecheck: `npm run typecheck` → clean.

## Files Changed

- Created: `src/fsutil.ts`
- Created: `src/fsutil.test.ts`

## Commit

- `e10fe45` — `feat: filesystem primitives (copy, byte-compare, symlink checks, gitignore)` (2 files, 214 insertions; branch `initial-harness-hub`)

## Self-Review

- **Completeness:** All 5 brief steps followed in TDD order (tests verbatim → RED → implement → GREEN → commit with the brief's exact message). All 5 specified exports present with the specified signatures.
- **Quality:** Dependency-free as required; JSDoc on the non-obvious functions; recursion kept simple; no error-swallowing beyond the documented missing-path case in `isSymlinkTo`.
- **Discipline (YAGNI):** Nothing beyond the brief — no extra exports, no options objects, no Windows support (macOS/Linux only per task context).
- **Testing:** 13 tests, all real filesystem behavior against `mkdtemp` temp dirs, no mocks; covered: nested copy, identical/differing/extra-file/missing-dir comparisons, dangling vs non-dangling symlink targets, real dir, missing path, both `relativeSymlinkTarget` cases, gitignore create/append/no-duplicate.

## Concerns

1. **Intentional deviation (documented above):** `isSymlinkTo` uses `lstatSync` + try/catch instead of the brief's `existsSync` guard. The brief's verbatim implementation fails the brief's own test suite (a symlink whose target doesn't yet exist would report `false`), so the test-as-spec mandated the fix. Downstream doctor/wiring checks (`isSymlinkTo` on `.agents/skills` links before targets exist) depend on the corrected semantics. Flagging so the controller can confirm.
2. Pre-existing, unrelated: Vite warns about `configLoader: 'native'` vs ESM `vitest.config.ts` on every run (also present in prior tasks' runs). Not touched per scope.

---

# Fix Report (post-review)

## Finding

Review (Important, plan-mandated, controller-ruled): `dirsByteIdentical` treated symlinks as regular files — the kind check only distinguished directory vs non-directory, and non-directories were compared via `readFileSync(...).equals(...)`, which follows links. Failure modes: symlink-vs-file with matching read-through bytes → wrongly `true`; dangling symlink in either tree → ENOENT throw; symlink-to-dir pair → EISDIR throw. Violates spec §6/§10 (symlink is never byte-identical to a real file/dir) and the never-throw requirement.

## Changes

- `src/fsutil.ts` — replaced the body of `dirsByteIdentical` with the controller-ruled lstat-first logic: `lstatSync` wrapped in try/catch (missing/odd entries → `false`, never throws); symlink-vs-non-symlink → `false`; two symlinks match only on exact stored-target equality (`readlinkSync` both sides, no resolution); regular files still byte-compared. Added `Stats` to the existing `node:fs` import list. Nothing else in the file changed.
- `src/fsutil.test.ts` — added exactly the three controller-specified tests to the existing `describe('dirsByteIdentical', ...)` block: symlink vs regular file → `false`; two symlinks, same stored target → `true`; two symlinks, different stored targets → `false`.

## TDD Evidence (fix)

- **RED:** Temporarily stashed the `src/fsutil.ts` fix, ran `npx vitest run src/fsutil.test.ts` → `3 failed | 13 passed (16)`; the three new tests failed with exactly the predicted old-code failure modes: `ELOOP` (symlink-vs-file read-through self-link) and `ENOENT` × 2 (dangling stored targets). Restored the fix via `git stash pop` (first pop silently failed with "already exists" while leaving the file untouched; second pop succeeded — no content was lost at any point).
- **GREEN:** `npx vitest run src/fsutil.test.ts` → **16 passed (16)**.

## Covering Test Results

- `npx vitest run src/fsutil.test.ts` → **16 passed (16)**.
- `npm test` (full suite) → **8 test files passed, 52 tests passed**.
- `npm run typecheck` → clean.

## Commit

- Amended per controller authorization: Task 8 remains a single commit — `333ff60` `feat: filesystem primitives (copy, byte-compare, symlink checks, gitignore)` (2 files, 257 insertions; was `e10fe45`).

## Scope Confirmation

Only the two contracted changes were made: `dirsByteIdentical` in `src/fsutil.ts` (+ `Stats` import) and the three tests in `src/fsutil.test.ts`. All other functions, files, and the previous `isSymlinkTo` fix remain untouched. Working tree clean afterwards (except the pre-existing untracked insight doc from before this task).

