# Task 16 Report: Generated-file-drift rule (registry-driven)

## Commits

| Hash | Message |
|---|---|
| `0730fca` | `feat: generated-file-drift doctor rule, driven by the harness registry` |

Single commit on branch `initial-harness-hub`, parent `4cfb564`. Only the two files named in the brief were staged (`src/doctor/rules/generatedFileDrift.ts`, `src/doctor/rules/generatedFileDrift.test.ts`); 2 files changed, 85 insertions.

## TDD Evidence

### RED (Step 2)

Command: `npx vitest run src/doctor/rules/generatedFileDrift.test.ts`

```
 RUN  v5.0.1 /Users/matt/Repos/ai/harness-hub

 ❯ src/doctor/rules/generatedFileDrift.test.ts (0 test)

⎯⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/doctor/rules/generatedFileDrift.test.ts [ src/doctor/rules/generatedFileDrift.test.ts ]
Error: Cannot find module './generatedFileDrift' imported from /Users/matt/Repos/ai/harness-hub/src/doctor/rules/generatedFileDrift.test.ts
 ❯ src/doctor/rules/generatedFileDrift.test.ts:5:1
      3| import { tmpdir } from 'node:os';
      4| import { join } from 'node:path';
      5| import { generatedFileDriftRule } from './generatedFileDrift';
       | ^
      6| import type { DoctorContext } from '../types';
      7|

 Test Files  1 failed (1)
      Tests  no tests
```

Exactly the expected failure: module not found.

### GREEN (Step 4, file-scoped)

Command: `npx vitest run src/doctor/rules/generatedFileDrift.test.ts`

```
 Test Files  1 passed (1)
      Tests  3 passed (3)
   Duration  133ms
```

All 3 tests pass.

### Full suite

Command: `npx vitest run`

```
 Test Files  18 passed (18)
      Tests  96 passed (96)
   Duration  415ms
```

All green — no regressions against Tasks 1–15.

### Typecheck

Command: `npm run typecheck` (`tsc -p tsconfig.json --noEmit`)

```
> harness-hub@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit
```

Exit code 0, no errors.

## Deviations

None. Both files are verbatim from the brief (byte-for-byte as supplied), and the commit message matches Step 5 exactly.

## Deferred Notes

- Pre-existing test-run noise, unrelated to this task and left untouched: an npm warning (`Unknown env config "devdir"`) and a Vite notice that `vitest.config.ts` uses ESM syntax in a CommonJS-loaded config under `configLoader: 'native'`. Both appear on every vitest invocation and do not affect results.
- The untracked file `docs/current/2026-09-20-0021-harness-hub-future/2026-09-14-2211-harness-hub/harness-tech-stack.insight.md` existed before this task and was deliberately not staged or modified (scope discipline).
- Minor behavioral note for the reviewer (inherent to the brief's design, not a deviation): `applies()` returns true when a configured harness has *either* a symlink-mode `agentsDoc` *or* a `migrate-symlink` skills mode, while `check()` reports only the specific symlinks that are wrong. The test "does not apply when claude-code is not configured" relies on `configuredHarnesses: []`; behavior with a harness that has only one symlinked aspect follows directly from the code and is not separately tested.

## Checklist

- [x] Step 1 — Created `src/doctor/rules/generatedFileDrift.test.ts` with the brief's verbatim test code (only file created first).
- [x] Step 2 — Ran the file-scoped test run; confirmed RED (`Cannot find module './generatedFileDrift'`); output captured above.
- [x] Step 3 — Created `src/doctor/rules/generatedFileDrift.ts` with the brief's verbatim implementation code.
- [x] Step 4 — Re-ran file-scoped tests (GREEN, 3/3), then full suite (18 files / 96 tests, all passing) and `npm run typecheck` (clean).
- [x] Step 5 — Committed exactly once with the exact message from the brief, staging only the two new files; hash `0730fca` recorded. Not pushed.
