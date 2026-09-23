# Task 6 Report: The `container` runner adapter

**Status:** DONE
**Commit:** `cc1499e` — `feat(verify): container runner adapter over the testbed`
**Branch:** `harness-version-mgmt-plan-b`

## What was done

1. **RED:** Wrote `test/tools/verify/containerRunner.test.ts` exactly as in the brief.
   Confirmed failing first (`Cannot find module './containerRunner'`).
2. **GREEN:** Implemented `test/tools/verify/containerRunner.ts` per the brief:
   `containerRunner(exec?: DockerExecutor): Runner` with `kind: 'container'`, an
   optional injected executor, `mkdtempSync` work dir, `buildImage` → fail-fast,
   then `runHarness`, mapping both results onto `RunResult`.
   Test passed after implementation.
3. Verified no regressions: full tools suite `npx vitest run test/tools` →
   12 files / 54 tests passed; tools typecheck
   `npx tsc -p test/tools/tsconfig.json --noEmit` → exit 0.
4. Committed both files with the brief's exact commit message.

## Deviations from the brief (and why)

1. **Task-4-ruling try/catch (controller-approved amendment, pre-authorized in
   the task instructions):** the body of `run()` is wrapped in
   `try/catch`; any unexpected throw (`mkdtempSync` failure, manifest read
   failure) returns `{ status: 'failed', output: '', error: <message> }`
   instead of propagating. This keeps the binding rule that `Runner.run`
   implementations never throw. The catch is placed *inside* `run` so the
   `workDir`/build/run flow and the brief's return shapes are otherwise
   unchanged.
2. Cosmetic only: added a short file-header comment documenting the injected
   executor (tests stay off docker) and the Task 4 ruling. No code-path changes.

## Not changed (brief verbatim, noted deliberately)

- The `runHarness` failure branch returns `{ status: 'failed', output }`
  without an `error` field — the docker output in `output` is the useful
  evidence there, and the brief's shape was kept. The `buildImage` failure
  branch sets `error` (as the brief does).

## Test command + output

```
npx vitest run test/tools/verify/containerRunner.test.ts
→ Test Files 1 passed (1), Tests 1 passed (1)

npx vitest run test/tools
→ Test Files 12 passed (12), Tests 54 passed (54)

npx tsc -p test/tools/tsconfig.json --noEmit → exit 0
```

Tests never invoked docker: the test injects a fake `DockerExecutor`
(`build`/`run` stubs returning `ok`). `buildImage` still reads the real
`config/config.json` manifest for the `codex` entry — verified present
(`npm` install method, `@openai/codex`), so the test path resolves the
Dockerfile string without touching a docker CLI.

## Concerns

- None blocking. Two minor observations:
  - The brief's test transitively depends on the real manifest having a
    `codex` entry (via `buildImage` → `loadManifest`). If that entry is ever
    removed, the test fails through the new catch path (status `failed`),
    which is at least a diagnosable failure mode.
  - `hh-testbed-*` temp work dirs are never cleaned up (inherent to the
    brief's design; also true of `testbed.ts main`). Harmless for tests; a
    future cleanup pass could remove them after `run`.