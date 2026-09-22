# Final whole-branch review — fix wave (2026-09-23)

Controller ruling on the final whole-branch review (`review-ac31029..3dc7724.diff`):
fix I1, I3, I4; park I2 (predicate redesign) but fold in its empty-prompt guard.
All fixes in one commit on `harness-version-mgmt-plan-b` (base 3dc7724).

## FIX 1 (I1) — symlink setup guard + round-trip test

- `test/tools/verify/runner.ts` `writeSetup`: `kind: 'symlink'` without
  `symlinkTarget` now throws
  `setup: symlink at "<path>" requires symlinkTarget` instead of
  `symlinkSync('', target)` cryptic EINVAL.
- `test/tools/verify/runner.test.ts`: two new tests —
  - symlink-setup round-trip: inline fake scenario (not SCENARIO_SUITE) with a
    link-dir-relative symlink (`.claude/skills/writing-tests` →
    `../../.agents/skills/writing-tests`) + native `SKILL.md`, no-op runner;
    predicate asserts the native file AND the symlink entry in
    `ctx.repo.files` with its target stored as given. Closes the Task-4
    deferred minor (symlink branch of writeSetup was never exercised
    end-to-end).
  - guard test: symlink without target → `runScenario` rejects with the
    required message.
- `test/tools/verify/schema.ts`: doc comment on `FileEntry.target` — targets
  are stored as given when relative; absolute targets are normalized
  root-relative by `snapshot()`.

## FIX 2 (I3, partial) — hermes trust-gate container path

- `test/tools/verify/scenarios.ts` `hermes-trust-gate` predicate: now accepts
  either `ctx.repoRoot` (human mode) or the container mount path `/repo`
  (container mode), with distinct reason strings
  (`trust ledger gained the repo path` /
  `trust ledger gained the container mount path /repo`). I2's predicate
  redesign remains parked as ruled.
- `test/tools/verify/scenarios.test.ts`: focused tests with a minimal
  ScenarioContext (only the fields the predicate touches) — passes for a
  `/repo` ledger, passes for a repoRoot ledger, fails for neither.

## FIX 3 (I4) — hermetic reconcile drift test

- `test/tools/reconcile.test.ts`: 'exits non-zero when any harness latest is
  outside verified ranges' now passes explicit fixture entries (one harness,
  verified range [0.139.0, 0.155.0), resolver latest 0.155.1) via the
  injectable `entries` param — no live `config/config.json` reads in tests.
  Assertion tightened to exact `rows`.

## FIX 4 (folded from parked I2) — empty-prompt dispatch guard

- `test/tools/verify/containerRunner.ts`: when `ctx.prompt === ''`
  (deterministic scenarios like skill-wiring), skip build/run entirely and
  return `{ status: 'ok', output: 'no prompt — deterministic scenario,
  container dispatch skipped' }`. Prevents `claude -p ""` garbage runs while
  keeping `runScenario`'s snapshot/predicate flow intact.
- `test/tools/verify/containerRunner.test.ts`: spy executor (build/run
  counters) — empty prompt → status ok, executor never called.

## TDD evidence (red → green)

RED (before implementations): 3 of 4 new tests failed for the expected
missing-behavior reasons —

- `runner.test.ts` guard test: `promise resolved instead of rejecting`
  (guard absent).
- `scenarios.test.ts` `/repo` case: `pass: false, "repo path not found in
  trust ledger"` (container path not accepted).
- `containerRunner.test.ts` skip test: received `{ status: 'ok',
  output: 'done' }` — executor ran (guard absent).

The reconcile test passed at RED because it exercised only existing
`checkLatest(resolver, entries)` behavior (the fix is the call-site change to
explicit fixtures); the new exact-`rows` assertion proves no live-config read
(would have listed all 8 harnesses and failed).

GREEN:

```
$ npx vitest run test/tools/verify/ test/tools/reconcile.test.ts
 Test Files  7 passed (7)
      Tests  25 passed (25)

$ npm test
 Test Files  48 passed (48)
      Tests  242 passed (242)

$ npm run typecheck && npm run build:tools
BUILD_AND_TYPECHECK_OK (both clean, exit 0)
```

Scope: only `test/tools/**`; no changes to `src/`, `config.json`, or
`deliverables/`.