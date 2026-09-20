# Task 9 Report: Pluggable doctor-rule framework

**Status:** DONE
**Commit:** `3e763cb` — `feat: pluggable doctor-rule framework (DoctorRule, runDoctor)`
**Branch:** `initial-harness-hub`

## Implementation

Implemented the doctor architecture from `harness-doctor-architecture.insight.md` §2 ("Doctor checks as pluggable rules"), exactly per `task-9-brief.md`:

- `src/doctor/types.ts` — `Severity` (`'error' | 'warning'`), `Finding` (ruleId, severity, message, remediation, optional harness-scoping `harnessId?`, `forceable` flag), `DoctorContext` (repoRoot, homeDir, config, configuredHarnesses, pendingHarnesses), `DoctorRule` (id + applicability predicate + check function). Types-only imports: `HarnessId` from `../harnesses`, `ConfigLoadResult` from `../config`.
- `src/doctor/run.ts` — `runDoctor(ctx, rules)` (runs each rule whose `applies(ctx)` is true, aggregates findings in rule order), `hasBlockingErrors(findings)` (true iff any finding has severity `'error'`), `findingsForHarness(findings, harnessId)` (canon-wide findings — `harnessId === undefined` — plus findings scoped to the given harness).
- `src/doctor/run.test.ts` — the brief's verbatim test file (`makeCtx` helper + 7 tests across `runDoctor`, `hasBlockingErrors`, `findingsForHarness`).

All code is verbatim from the brief. Nothing beyond the brief was added (no rule registry, no CLI wiring, no extra exports — those belong to Tasks 10–12, 14–16, which implement spec §9 checks as individual `DoctorRule`s).

## TDD Evidence

**RED** — `npx vitest run src/doctor/run.test.ts` after writing only the test file:

```
FAIL  src/doctor/run.test.ts
Error: Cannot find module './run' imported from .../src/doctor/run.test.ts
Test Files  1 failed (1)
```

Failed for the expected reason (feature missing — module not found), matching the brief's Step 2 expectation.

**GREEN** — after implementing `types.ts` + `run.ts`:

```
Test Files  1 passed (1)
Tests  7 passed (7)
Duration  91ms
```

## Test Results

- Focused: `src/doctor/run.test.ts` — 7/7 pass.
- Full suite (`npm test`): 9 files, 59/59 tests pass (52 pre-existing + 7 new).
- `npm run typecheck`: clean, no errors.
- Output pristine from my code; two pre-existing environmental warnings remain (npm `devdir` config warning; Vite `configLoader: 'native'` ESM/CJS warning about `vitest.config.ts`). Both predate this task and are unrelated to it — noting only so the controller doesn't attribute them to Task 9.

## Files Changed

- Created: `src/doctor/types.ts` (31 lines)
- Created: `src/doctor/run.ts` (20 lines)
- Created: `src/doctor/run.test.ts` (95 lines)

Commit `3e763cb` contains exactly these three files; working tree otherwise clean (one pre-existing untracked docs file, `docs/current/2026-09-20-0021-harness-hub-future/.../harness-tech-stack.insight.md`, untouched).

## Self-Review

- **Completeness:** all 6 brief steps executed in order; test file, types, runner, and commit message verbatim from the brief.
- **Quality:** type-only cross-module imports per the brief; doc comments on `harnessId` and `forceable` preserved verbatim; `findingsForHarness` accepts plain `string` harnessId per the brief's signature.
- **Discipline (YAGNI):** no code beyond the brief — the framework is the deliverable; rule implementations are later tasks.
- **Testing:** every exported function covered; RED observed before any implementation existed; full suite green before commit.

## Concerns

1. **Brief test-count annotation:** Step 5 says "Expected: PASS (6 tests)" but the brief's own verbatim test file contains 7 `it` blocks (2 `runDoctor` + 3 `hasBlockingErrors` + 2 `findingsForHarness`). I followed the test content (7 tests), which is authoritative; the "6" appears to be a miscount in the brief's annotation.
2. No other concerns. Dependencies (`HarnessId`, `ConfigLoadResult`) existed as specified; `claude-code`/`hermes` are valid `HarnessId`s in `ALL_HARNESS_IDS`.
