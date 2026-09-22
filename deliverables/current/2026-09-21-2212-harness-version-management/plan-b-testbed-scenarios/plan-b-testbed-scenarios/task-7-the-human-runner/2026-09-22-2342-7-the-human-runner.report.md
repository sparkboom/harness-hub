# Task 7 Report: The `human` runner

**Status:** DONE (two approved deviations from the brief's verbatim code, noted below)
**Commit:** `dc0a18a` — `feat(verify): human runner for manual GUI/IDE review`
**Branch:** `harness-version-mgmt-plan-b` (worked directly on current branch, no worktree/branch created)

## What I did

1. **RED** — Wrote `test/tools/verify/runner-human.test.ts` exactly as the brief's Step 1. Ran
   `npx vitest run test/tools/verify/runner-human.test.ts` → failed with
   `Cannot find module './runner-human'` (correct failure: feature missing, not a typo).

2. **GREEN** — Implemented `test/tools/verify/runner-human.ts` per the brief's Step 2, with the
   two amendments below. Same run → 1 test passed.

3. **Regression check** — Full `test/tools/verify/` suite: 6 files, 14 tests, all passed.
   Typecheck `npx tsc --noEmit -p test/tools/tsconfig.json` → clean.

4. Committed the two new files with the brief's exact commit message.

## Deviations from the brief (both per controller instructions)

1. **readline import corrected.** The brief's Step 2 shows `import { readline } from 'node:readline'`
   followed by `readline.createInterface(...)` — node:readline has no `readline` named function
   export, so that code would not compile. Used
   `import { createInterface } from 'node:readline'` with `createInterface({...})`, keeping the
   rest of `stdinIO()` verbatim.

2. **try/catch inside `run()` (Task 4 ruling).** Runner.run implementations must never throw.
   The brief's `humanRunner.run` body had no guard; the injectable-io test path is safe, but the
   default `stdinIO()` creates a readline interface (e.g. if stdin is closed, `rl.question`'s
   interface could surface errors). Wrapped the run() body in try/catch →
   `{ status: 'failed', output: '', error: <message> }`, matching the pattern already used in
   `containerRunner.ts` (commit cc1499e).

Also added a brief file header comment explaining the runner's purpose (human-only harnesses per
spec R5) and the two rulings, consistent with the headers on the other verify modules. All
brief-specified strings, prompts, and the RunResult payload (`'human signaled completion'`) are
verbatim.

## Test command + output summary

```
npx vitest run test/tools/verify/runner-human.test.ts
  → Test Files 1 passed (1) / Tests 1 passed (1)

npx vitest run test/tools/verify/
  → Test Files 6 passed (6) / Tests 14 passed (14)

npx tsc --noEmit -p test/tools/tsconfig.json → exit 0
```

## Concerns

None blocking. Minor notes:

- The default `stdinIO()` is lazily constructed at `humanRunner()` call time (brief's design).
  If a scenario suite instantiates the human runner with defaults but never calls `run()`, the
  readline interface still opens stdin. Harmless in practice (and unavoidable without changing
  the brief's factory signature), and tests always inject `io`.
- `ask` resolves with whatever the human types (the test uses `'done'`); the result is not
  validated — completion is signaled by the human pressing Enter, per the brief. Any stricter
  validation would be new behavior beyond the brief's spec.

## Fix round 1

**Review finding (Important):** the original test never asserted that `run()` actually calls
`ask` before resolving — an implementation that resolved without awaiting the ack would pass.

**Fix:** strengthened `test/tools/verify/runner-human.test.ts` only (no production change, no
signature changes):

- Fake `io.ask` now records its calls (`const asked: string[] = []`, pushed per call); the test
  asserts `asked.length === 1 && asked[0].includes('done')`, proving `run()` awaits the ack
  before returning `status: 'ok'`.
- Applied the reviewer's optional tightening: also assert `printed` contains
  `'=== human runner'`.

`runner-human.ts` is untouched. Re-ran
`npx vitest run test/tools/verify/runner-human.test.ts` → 1/1 passed with the new assertions.
Committed as `test(verify): assert humanRunner awaits the human ack`.