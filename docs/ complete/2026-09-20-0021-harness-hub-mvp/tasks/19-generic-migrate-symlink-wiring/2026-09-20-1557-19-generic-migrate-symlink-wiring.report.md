# Task 19 Report: Generic migrate-symlink wiring

**Branch:** `initial-harness-hub` · **Base HEAD:** `95b4334` · **Result commit:** `d432838`

## Commits

| Hash | Message |
|---|---|
| `d432838` | `feat: generic migrate-symlink wiring for AGENTS.md + skills` |

2 files changed, 103 insertions(+): `src/wiring/migrateSymlink.test.ts` (new) and `src/wiring/migrateSymlink.ts` (new).

## TDD Evidence

### RED (Step 2 — test file created, implementation absent)

Command: `npx vitest run src/wiring/migrateSymlink.test.ts` (exit code 1):

```
 RUN  v5.0.1 /Users/matt/Repos/ai/harness-hub

 ❯ src/wiring/migrateSymlink.test.ts (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/wiring/migrateSymlink.test.ts [ src/wiring/migrateSymlink.test.ts ]
Error: Cannot find module './migrateSymlink' imported from /Users/matt/Repos/ai/harness-hub/src/wiring/migrateSymlink.test.ts
 ❯ src/wiring/migrateSymlink.test.ts:6:1
      4| import { tmpdir } from 'node:os';
      5| import { join } from 'node:path';
      6| import { wireMigrateSymlinkHarness } from './migrateSymlink';
       | ^
      7| import { getHarnessEntry } from '../registry';

 Test Files  1 failed (1)
      Tests  no tests
```

Expected failure mode per brief Step 2: **module not found**. Confirmed.

### GREEN — intermediate run (verbatim brief implementation, 4/5)

After creating the implementation with the brief's verbatim code, one test failed:

```
 ❯ src/wiring/migrateSymlink.test.ts (5 tests | 1 failed) 12ms
   ❯ wireMigrateSymlinkHarness (5)
     × is idempotent when the symlinks already exist 3ms

 FAIL  src/wiring/migrateSymlink.test.ts > wireMigrateSymlinkHarness > is idempotent when the symlinks already exist
Error: EEXIST: file already exists, symlink '../.agents/skills' -> '/var/folders/.../hh-wiring-TNQL6c/.claude/skills'
 ❯ ensureSymlink src/wiring/migrateSymlink.ts:16:5
```

Root cause and minimal fix are described under **Deviations** below. The test file was not modified.

### GREEN — final run (after minimal fix)

Command: `npx vitest run src/wiring/migrateSymlink.test.ts` (exit code 0):

```
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

### Full suite (Step 4)

Command: `npx vitest run` (exit code 0):

```
 Test Files  22 passed (22)
      Tests  106 passed (106)
```

### Typecheck (Step 4)

Command: `npm run typecheck` (`tsc -p tsconfig.json --noEmit`) — exit code 0, no errors.

## Deviations

### Deviation 1: dangling-symlink-safe existence check in `ensureSymlink` (behavior-affecting, minimal)

**What happened:** The brief's verbatim implementation of `ensureSymlink` fails the brief's own test 2 (`is idempotent when the symlinks already exist`) with `EEXIST`. On the second `wireMigrateSymlinkHarness` call, `.claude/skills → ../.agents/skills` is a **dangling** symlink (`.agents/skills` does not exist in that test). `existsSync` follows symlinks and returns `false` for a dangling link, so the "create if absent" branch fires and `symlinkSync` throws `EEXIST` on the existing link.

**Root cause:** Using a follows-symlinks existence check (`existsSync`) for link-presence. The codebase already handles this distinction correctly elsewhere: `src/doctor/rules/clobberRisk.ts` (previously merged) uses an lstat-based `pathPresent` helper for exactly this purpose.

**Minimal fix (implementation file only; tests untouched):**
- Added `pathPresent` helper based on `lstatSync` (try/catch), mirroring the existing `clobberRisk.ts` pattern.
- Replaced the two `existsSync(linkAbsPath)` calls in `ensureSymlink` with `pathPresent(linkAbsPath)`.
- Removed the now-unused `existsSync` from the `node:fs` import (consequence of the same change; keeps the file warning-free).

Everything else is verbatim from the brief: imports, names, `relativeSymlinkTarget`/`isSymlinkTo`/`ensureGitignoreEntries` usage, the doc comment, and 100% of the test file. For all non-dangling cases behavior is identical; the fix only changes the dangling-symlink case from "throw EEXIST" to the intended idempotent no-op (correct-target dangling link is left untouched; wrong-target dangling link is removed and recreated).

## Deferred Notes (for reviewer)

1. **The same bug exists in the plan document.** `docs/current/2026-09-20-0021-harness-hub-mvp/harness-hub-mvp.plan.md` Task 19 (plan lines ~2950–2985) contains the identical `existsSync`-based `ensureSymlink`; the brief faithfully transcribed a plan bug that the plan's own idempotency test exposes. The plan was not edited (out of scope for this task). The Task 20 author (`enable` command, which calls this wiring) should be aware that link-presence checks must be lstat-based, not `existsSync`.
2. **Resulting semantics of `ensureSymlink`:** a dangling-but-correct-target link is a pure no-op (no rm/recreate); a dangling-wrong-target link is replaced. This is consistent with doctor's `clobber-risk` rule, which (being `isSymlinkTo`/lstat-based) tolerates a dangling-but-correct symlink.
3. Pre-existing, unrelated noise on every vitest run: `npm warn Unknown env config "devdir"` and a Vite `configLoader: 'native'` warning about `vitest.config.ts`. Left untouched.
4. An untracked file `docs/current/2026-09-20-0021-harness-hub-future/2026-09-14-2211-harness-hub/harness-tech-stack.insight.md` exists in the working tree; unrelated to this task, not staged, not committed.

## Checklist

- [x] **Step 1** — Created only `src/wiring/migrateSymlink.test.ts`, verbatim from the brief.
- [x] **Step 2** — RED confirmed: `Cannot find module './migrateSymlink'` (output pasted above).
- [x] **Step 3** — Created `src/wiring/migrateSymlink.ts`; verbatim except the minimal dangling-symlink fix under Deviations.
- [x] **Step 4** — GREEN: 5/5 tests in the target file; full suite 22 files / 106 tests, all passing; typecheck clean.
- [x] **Step 5** — Exactly one commit (`d432838`) with the exact message from the brief; only the two new files staged; not pushed; no rebase; no amend of prior commits.
