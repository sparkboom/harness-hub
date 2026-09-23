# Task 3 Report — The scenario suite (S1–S5)

**Status:** DONE
**Commit:** `8132d6c` — `feat(verify): define the S1-S5 convention-verification scenario suite`
**Branch:** `harness-version-mgmt-plan-b`

## What was done

Created both files from the brief, applied TDD (test written first, verified
failing import → implemented → passed), then committed.

### Files created

- `test/tools/verify/scenarios.test.ts` — verbatim from brief Step 1 (4 tests).
- `test/tools/verify/scenarios.ts` — brief Step 2 implementation, with one
  mandated deviation.

### Deviation from brief (mandated by parent instruction)

The brief's `import type { HarnessId } from '../../src/harnesses'` was **not**
used. Per the Task 1 binding ruling (test/tools production code must not
import from `src/` at all — even type-only imports are TS6059 build failures
under the tools tsconfig `rootDir`), the import is:

```ts
import type { HarnessId, Scenario, ScenarioContext, Predicate } from './schema';
```

`schema.ts` exports the local `HarnessId` union (same 8 members, drift-guarded
by `schema.test.ts` against `src`'s `ALL_HARNESS_IDS`), so this is the
single-source-of-truth substitute the brief's own alternative note described.
Everything else in `scenarios.ts` is verbatim: `ALL_CLI`, both predicate
helpers, canary constants, `zebraSkillBody()`, and all seven scenario entries
(`agentsdoc-load-canary`, `agentsdoc-behavioral`, `skill-wiring`,
`skill-explicit-invocation`, "skill-auto-discovery", `skill-scoping`,
`hermes-trust-gate`) with their ids, `conventionUnderTest`, `harnessCompat`,
setup files, prompts, predicates, rubrics, and `evidenceLevels`.

## Verification

### Test command and output

```
npx vitest run test/tools/verify/scenarios.test.ts
```

```
RUN  v5.0.1 /Users/matt/Repos/ai/harness-hub
 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  144ms
```

PASS — 4/4 tests: seven scenarios with the exact expected id set; canary
strings absent from prompts; wiring/explicit/auto evidence-level trio as
required; `skill-scoping.harnessCompat` equals `['cursor', 'cursor-cli',
'opencode']`.

### Additional checks beyond the brief

- `npx tsc -p test/tools/tsconfig.json --noEmit` → exit 0. Confirms the
  `./schema` import does not trip TS6059 under the tools rootDir (the exact
  failure mode the Task 1 ruling warned about).
- Full verify directory regression: `npx vitest run test/tools/verify` →
  3 files / 9 tests passed (schema + snapshot suites unaffected).
- Working tree clean before start; commit contains only the two new files
  (191 insertions, 2 files changed).

## Concerns

- None blocking. Minor observation for later tasks: `SCENARIO_SUITE` is typed
  `Record<string, Scenario>` per the brief, so the keys-in-`Scenario.id`
  correspondence and harness-id validity of the suite are not compile-checked;
  a downstream runner task (Task 4+) may want an invariant test for those.
  The existing schema drift-guard already covers the harness-id side.