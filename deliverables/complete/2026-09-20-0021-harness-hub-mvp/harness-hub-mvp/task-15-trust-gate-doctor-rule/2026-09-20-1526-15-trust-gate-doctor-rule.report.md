# Task 15 Report: Trust-gate doctor rule (Hermes)

## Commits

- `4cfb564cf718fab8cb80279b03dcd52e7a43c8ad` — `feat: trust-gate doctor rule (Hermes skills.trusted_project_dirs)`
  - 2 files changed, 146 insertions(+) — only `src/doctor/rules/trustGate.ts` (new) and `src/doctor/rules/trustGate.test.ts` (new). No push, no rebase, no amend.

## TDD evidence

### RED (Step 2) — `npx vitest run src/doctor/rules/trustGate.test.ts`, before implementation existed

```
 FAIL  src/doctor/rules/trustGate.test.ts [ src/doctor/rules/trustGate.test.ts ]
Error: Cannot find module './trustGate' imported from /Users/matt/Repos/ai/harness-hub/src/doctor/rules/trustGate.test.ts
 ❯ src/doctor/rules/trustGate.test.ts:5:1
      5| import { trustGateRule } from './trustGate';
       | ^

 Test Files  1 failed (1)
      Tests  no tests
```

Exit code 1, failure mode exactly as the brief predicted (module not found).

### GREEN (Step 4) — same command after implementing

```
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

All 6 tests: applies-gate, missing-file warning, parse-failure warning, untrusted-repo error, trusted pass, trailing-slash normalization.

### Full suite — `npx vitest run`

```
 Test Files  17 passed (17)
      Tests  93 passed (93)
```

Exit code 0.

### Typecheck — `npm run typecheck`

```
> harness-hub@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit
```

Exit code 0, no errors.

## Deviations

none — both files match the brief's code verbatim.

## Deferred notes (for the reviewer)

- `trustGateRule.id` is `'trust-gate'` while the emitted `Finding.ruleId` is `'hermes-trust'` (per brief/plan; the test asserts `hermes-trust`). Noted in case a later task standardizes rule-id ↔ finding-id conventions.
- `/`-suffix normalization strips only one trailing slash (`replace(/\/$/, '')`) — fine for Hermes-written paths; a Windows-style `\` suffix is out of scope (MVP, macOS/Linux).
- Pre-existing repo-level noise, untouched: npm warning `Unknown env config "devdir"` and a Vite config-loader warning about `vitest.config.ts` being ESM-in-CJS. Both appear in every task's runs.
- `applies()` recomputes `trustGatedHarnessIds()` per call (registry lookups) — negligible cost, matches the brief's implementation and the existing rule style (`clobberRisk.ts`).

## Checklist

- [x] Step 1: Created `src/doctor/rules/trustGate.test.ts` (verbatim from brief) — nothing else created
- [x] Step 2: Ran `npx vitest run src/doctor/rules/trustGate.test.ts` — confirmed FAIL (module not found)
- [x] Step 3: Created `src/doctor/rules/trustGate.ts` (verbatim from brief)
- [x] Step 4: Re-ran targeted test — 6/6 pass; full suite `npx vitest run` — 93/93 pass; `npm run typecheck` — clean
- [x] Step 5: `git add` of exactly the two new files + commit `4cfb564` with the exact brief message; commit hash recorded above
