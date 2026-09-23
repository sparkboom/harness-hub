# Task 1 Report: Scenario schema types

**Status:** DONE_WITH_CONCERNS
**Commit:** `8d1cf02a3ef3ef8801bdaa9070e52b155682caad` — `feat(verify): add scenario schema types`
**Branch:** `harness-version-mgmt-plan-b` (worked in place, no worktree)

## What I did

Created the two files from the brief:

- `test/tools/verify/schema.ts` — all interfaces/type aliases as specified:
  `EvidenceLevel`, `ConventionUnderTest`, `SetupFile`, `FileEntry`, `Snapshot`,
  `ScenarioContext`, `PredicateResult`, `Predicate`, `RubricCriterion`,
  `Scenario`, `ScenarioOutcome`. Doc comments preserved verbatim.
- `test/tools/verify/schema.test.ts` — the smoke test from the brief, plus one
  additional sync test (see Concern 1).

## Deviation from the brief (the concern)

The brief's `schema.ts` starts with:

```ts
import type { HarnessId } from '../../src/harnesses';
```

Two problems with that line as written:

1. **Wrong relative path.** From `test/tools/verify/`, `../../` resolves to
   `test/`, i.e. `test/src/harnesses` — nonexistent. Repo-root `src` is three
   levels up from `verify/`.
2. **Even the corrected path breaks `npm run build:tools`.**
   `test/tools/tsconfig.json` sets `rootDir: test/tools`, and TypeScript pulls
   the imported source file into the program regardless of `import type`
   (verified: `error TS6059: File '.../src/harnesses.ts' is not under 'rootDir'
   '/Users/matt/Repos/ai/harness-hub/test/tools'`). Baseline without my files
   was green; with the import, `build:tools` failed. The plan gates on
   `build:tools` staying green (plan line 20) and Task 10 re-runs it.

The plan itself pre-authorizes the resolution (plan line 484): *"Alternative:
duplicate the id union here; `import type` is safe and keeps a single source of
truth."* The plan's cross-boundary note (line 26) frames the constraint as the
`rootDir` — confirming the union cannot be imported from tools production code
by any mechanism, type-only included.

**What I implemented instead** (minimal deviation, plan-sanctioned):

- `schema.ts` declares `HarnessId` locally as the same 8-member union
  (`'claude-code' | 'cursor' | 'cursor-cli' | 'opencode' | 'codex' | 'hermes' |
  'pi' | 'deepseek'`), with a comment pointing at `src/harnesses.ts` and
  explaining the rootDir constraint.
- `schema.test.ts` gains one extra test guarding the duplication: a local
  `SCHEMA_HARNESS_IDS` const with `satisfies readonly HarnessId[]` (catches
  invalid members at typecheck — note the test may import `src` because vitest
  runs outside the tools tsconfig; the plan explicitly allows tests to import
  `src`), compared at runtime against `ALL_HARNESS_IDS` from
  `src/harnesses.ts`. If `src` adds/removes a harness, this test fails.

Everything else in both files is byte-for-byte the brief's code.

## Verification (all run and observed passing)

| Check | Command | Result |
|---|---|---|
| Test (required by brief) | `npx vitest run test/tools/verify/schema.test.ts` | **PASS — 2 tests, 1 file** (~200ms) |
| Tools build gate | `npm run build:tools` | **exit 0** (failed before the fix with TS6059; baseline without my files confirmed green) |
| Strict typecheck of both new files incl. the excluded test file | `npx tsc --noEmit --ignoreConfig --strict --target es2022 --module esnext --moduleResolution bundler --skipLibCheck test/tools/verify/schema.ts test/tools/verify/schema.test.ts` | **exit 0** |
| Root typecheck | `npm run typecheck` | **exit 0** |
| Working tree | `git status --short` | clean after commit |

## Notes for later tasks

- Later tasks importing `HarnessId` from `./schema` are unaffected — the type
  is exported from `schema.ts` either way, with identical members.
- The duplication is deliberate and guarded; if a future task would rather
  centralize it, the only consumer of `HarnessId` in `test/tools` is
  `verify/schema.ts` today (the `test/tools/scenarios/` framework has its own
  pre-existing types and was not touched).
- npm prints an unrelated warning on every run: `Unknown env config "devdir"`.
  Pre-existing, ignored.

## Concerns (summary)

1. **Brief deviation (resolved in-plan):** replaced the brief's
   `import type { HarnessId } from '../../src/harnesses'` with a locally
   declared, union-identical `HarnessId` — the brief's line was both a wrong
   relative path and would break the `build:tools` rootDir gate even when
   corrected. Sanctioned by plan line 484's stated alternative; drift is
   guarded by a dedicated test.
2. No other concerns. No subagents used; work done in place on the current
   branch as instructed.
