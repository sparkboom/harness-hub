# Task 4 Report — Runner interface + `runScenario` orchestration

**Status:** DONE
**Commit:** `7c35fe1` — `feat(verify): add runner interface and runScenario orchestration`
**Branch:** `harness-version-mgmt-plan-b`

## What was done

Created both files per the brief, verbatim (with the one binding Task 1 caveat applied):

- `test/tools/verify/runner.test.ts` — 2 tests using fake no-op runners against
  `SCENARIO_SUITE['skill-wiring']` (deterministic predicate → passes) and
  `SCENARIO_SUITE['agentsdoc-load-canary']` (canary predicate → fails with no model run).
- `test/tools/verify/runner.ts` — exports `Runner`, `RunContext`, `RunResult`,
  `runScenario(scenario, runner, ctx): Promise<ScenarioOutcome>` (writeSetup → before
  snapshots → runner.run → after snapshots → predicate → outcome), and re-exports
  `diffFiles`.

### Deviation from brief (mandated by parent context, not discretionary)

The brief's line `import type { HarnessId } from '../../src/harnesses'` was replaced with
`import type { HarnessId } from './schema'` (combined into the single schema type import),
per the binding Task 1 ruling: test/tools production code must not import from `src/`
(even type-only — TS6059 under `test/tools/tsconfig.json` rootDir). A comment in the file
documents this. `schema.ts` exports the drift-guarded 8-member `HarnessId` union.

## Test command + output

```
npx vitest run test/tools/verify/runner.test.ts
→ Test Files 1 passed (1); Tests 2 passed (2)

npx vitest run test/tools/verify/   (regression across Tasks 1–3)
→ Test Files 4 passed (4); Tests 11 passed (11)
   [schema.test.ts, snapshot.test.ts, scenarios.test.ts, runner.test.ts]

npx tsc -p test/tools/tsconfig.json --noEmit
→ exit 0 (runner.ts typechecks; no src/ import; confirms TS6059 caveat handled)
```

TDD sequence followed: test written first, confirmed RED (Cannot find module './runner'),
implemented, confirmed GREEN.

## Verification of exact-output requirements

- Test file matches the brief verbatim.
- Implementation matches the brief verbatim except the HarnessId import source (above).
- `runScenario` outcome shape: `scenarioId`, `result`, `runs: 1`, `passes` (0/1),
  `evidence: scenario.evidenceLevels`, `reason: pr.reason`,
  `note: result.status === 'failed' ? result.error ?? result.output : undefined`.
- Predicate receives full `ScenarioContext` (`repoRoot`, `homeDir`, `repo`, `home`,
  `beforeRepo`, `beforeHome`) — home/before snapshots available for S5 and delta predicates.
- `writeSetup` handles both file and symlink setup kinds; symlinks are created relative to
  `repoRoot`, files via `writeAssets` from `test/tools/fs.ts`.

## Concerns

None blocking. Carried-over deferred minors (not worsened, per parent context):
- SCENARIO_SUITE key ↔ id is not compile-checked (scenario lookup by string key).
- `skill-wiring` has `prompt: ''` — `runScenario` passes `ctx.prompt` through verbatim;
  a real runner will receive an empty prompt for that scenario. Intended per brief.
- One cosmetic note: brief's test comment says "no model call" — accurate, fake runner
  never invokes a model; nothing to fix.

---

## Fix round 1

**Commit:** (see below) — `fix(verify): runScenario survives a throwing runner`
**Review finding addressed:** runner.ts:58 — `await runner.run(ctx)` had no try/catch, so
a real runner that throws (spawn ENOENT, container timeout) made `runScenario` reject:
no outcome, no note, no post-run snapshots, no predicate evaluation for the failed run.

### What changed

- `test/tools/verify/runner.ts` — the `await runner.run(ctx)` call is now wrapped in
  try/catch (controller-approved amendment to the brief's verbatim code). On rejection,
  `result` is set to `{ status: 'failed', output: '', error: e instanceof Error ? e.message : String(e) }`
  (preserves the error text; message extraction for Error instances) and the pipeline
  continues: after-snapshots, predicate evaluation, and outcome construction all still run,
  so `note` carries the failed-run diagnostics via the existing
  `result.status === 'failed' ? result.error ?? result.output : undefined` path.
  Non-throwing runner behavior is unchanged (no branch taken).
- `test/tools/verify/runner.test.ts` — added one test: a runner whose `run()` rejects with
  `Error('spawn ENOENT')` against the deterministic-pass `skill-wiring` scenario. Asserts
  `runScenario` still returns an outcome with `result: true` (predicate still evaluated),
  `runs: 1`, `passes: 1`, and `note === 'spawn ENOENT'` — proving the pipeline continues
  and the error is carried.

### Test command + output

```
npx vitest run test/tools/verify/runner.test.ts
→ Test Files 1 passed (1); Tests 3 passed (3)
  [new test confirmed RED first: 1 failed | 2 passed, rejection escaping runScenario]

npx vitest run test/tools/verify/   (regression)
→ Test Files 4 passed (4); Tests 12 passed (12)

npx tsc -p test/tools/tsconfig.json --noEmit
→ exit 0
```

No other files touched.