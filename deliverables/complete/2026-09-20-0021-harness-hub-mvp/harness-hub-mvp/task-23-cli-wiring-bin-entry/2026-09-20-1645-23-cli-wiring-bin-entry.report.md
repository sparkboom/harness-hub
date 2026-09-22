# Task 23 Report: CLI wiring + bin entry

**Branch:** `initial-harness-hub` · **Base HEAD:** `a499de1` · **Result:** success

## Commits

| Hash | Message |
|---|---|
| `3e24cb4` | `feat: CLI wiring (enable/disable/migrate/doctor) + bin entry` |

Files committed (3, +150 lines, exactly as the brief specified — `dist/` is gitignored and was not committed):

```
 src/bin.ts      | 11 ++++++++
 src/cli.test.ts | 58 +++++++++++++++++++++++++++++++++++++++++
 src/cli.ts      | 81 ++++++++++++++++++++++++++++++++++++++++++++++
```

## TDD evidence

### Step 2 — RED (module not found)

`npx vitest run src/cli.test.ts` → **exit 1**:

```
 RUN  v5.0.1 /Users/matt/Repos/ai/harness-hub

 ❯ src/cli.test.ts (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/cli.test.ts [ src/cli.test.ts ]
Error: Cannot find module './cli' imported from /Users/matt/Repos/ai/harness-hub/src/cli.test.ts
 ❯ src/cli.test.ts:6:1
      4| import { tmpdir } from 'node:os';
      5| import { join } from 'node:path';
      6| import { main } from './cli';
       | ^
      7|
      8| describe('cli main()', () => {

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  no tests
```

### Step 5 — GREEN (all 6 pass)

`npx vitest run src/cli.test.ts` → **exit 0**:

```
 RUN  v5.0.1 /Users/matt/Repos/ai/harness-hub

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  16:43:32
   Duration  322ms (transform 51%, import 35%, tests 12%, worker 2%)
```

### Step 6 — Full suite

`npm test` → **exit 0**:

```
 Test Files  26 passed (26)
      Tests  132 passed (132)
   Start at  16:43:40
   Duration  866ms
```

### Step 6 — Typecheck

`npm run typecheck` → **exit 0**, no output beyond the npm banner:

```
> harness-hub@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit
```

## Smoke test (Step 7)

`npm run build` → exit 0 (`tsc -p tsconfig.json`). Then in a fresh `mktemp -d` with `git init -q` + `AGENTS.md`:

```
--- doctor ---
harness-hub doctor: no issues found.
doctor exit code: 0
--- enable cursor ---
harness-hub enable cursor: enabled
enable exit code: 0
--- cat harness-hub.yaml ---
harnesses:
  - cursor
```

All expectations met: doctor exits 0 with "no issues found"; `enable cursor` prints `harness-hub enable cursor: enabled`; `harness-hub.yaml` contains `harnesses:` with `- cursor`. Temp dir was removed afterwards (`rm -rf`).

## Deviations

None. All three files match the brief verbatim (including the `\u2192` escape and the `exitOverride` + `commander.helpDisplayed`/`commander.version` catch pattern). No existing files were modified.

## Deferred notes

- **Transient tooling hiccup, not a code issue:** the first attempt at the Step 8 commit returned an ambiguous "no exit status" error from the shell execution environment (unrelated to git). Verified via `.git/logs/HEAD` that no commit had been created, then re-ran the identical commit command successfully. The single final commit is `3e24cb4`; no stray/empty commits exist.
- Pre-existing untracked file `docs/current/2026-09-20-0021-harness-hub-future/2026-09-14-2211-harness-hub/harness-tech-stack.insight.md` was present before this task and was deliberately left uncommitted.
- Pre-existing, cosmetic npm warnings on every run (`Unknown env config "devdir"`; Vite `configLoader: 'native'` ESM/CJS notice for `vitest.config.ts`) plus a vitest `isolate: false` perf hint — untouched, out of scope.
- `bin.ts` is intentionally untested (thin shebang wrapper); it is exercised by the Step 7 smoke test, per the brief.

## Checklist

1. ✅ Test file `src/cli.test.ts` created first (verbatim) — 6 tests
2. ✅ RED confirmed: `Cannot find module './cli'`, exit 1
3. ✅ `src/cli.ts` + `src/bin.ts` created verbatim from the brief
4. ✅ GREEN confirmed: 6/6 passed, exit 0
5. ✅ Full suite green: 26 files / 132 tests; `npm run typecheck` clean (exit 0)
6. ✅ Scope: only the three brief-named files created; `package.json`/`tsconfig.json` verified (`bin` → `dist/bin.js`, `build`/`test`/`typecheck` scripts present) but not edited
7. ✅ Build + smoke test passed (doctor exit 0, enable exit 0, yaml correct); temp dir cleaned up
8. ✅ One commit `3e24cb4` with the exact brief message; only `src/cli.ts`, `src/bin.ts`, `src/cli.test.ts` staged; no push, no rebase, no amend
