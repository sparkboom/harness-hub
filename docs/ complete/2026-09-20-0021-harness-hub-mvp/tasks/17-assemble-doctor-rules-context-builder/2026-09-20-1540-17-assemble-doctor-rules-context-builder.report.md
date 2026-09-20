# Task 17 Report: Assemble doctor rules + context builder

**Branch:** `initial-harness-hub` (HEAD before: `0730fca`, after: `f888c76`)

## Commits

- `f888c76` — `feat: assemble all 8 doctor rules + doctor context builder` (4 files changed, 83 insertions)

Files created:
- `src/doctor/rules/index.ts`
- `src/doctor/rules/index.test.ts`
- `src/doctor/context.ts`
- `src/doctor/context.test.ts`

## TDD evidence

### RED (Step 2) — both new suites fail, modules not found

Command: `npx vitest run src/doctor/rules/index.test.ts src/doctor/context.test.ts`

```
 RUN  v5.0.1 /Users/matt/Repos/ai/harness-hub

 ❯ src/doctor/rules/index.test.ts (0 test)
 ❯ src/doctor/context.test.ts (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/doctor/context.test.ts [ src/doctor/context.test.ts ]
Error: Cannot find module './context' imported from /Users/matt/Repos/ai/harness-hub/src/doctor/context.test.ts
 ❯ src/doctor/context.test.ts:5:1

 FAIL  src/doctor/rules/index.test.ts [ src/doctor/rules/index.test.ts ]
Error: Cannot find module './index' imported from /Users/matt/Repos/ai/harness-hub/src/doctor/rules/index.test.ts
 ❯ src/doctor/rules/index.test.ts:2:1

 Test Files  2 failed (2)
      Tests  no tests
```

### GREEN (Step 5) — both new suites pass

Command: `npx vitest run src/doctor/rules/index.test.ts src/doctor/context.test.ts`

```
 RUN  v5.0.1 /Users/matt/Repos/ai/harness-hub

 Test Files  2 passed (2)
      Tests  3 passed (3)
   Start at  15:39:26
   Duration  167ms
```

### Full suite (Step 5)

Command: `npx vitest run`

```
 Test Files  20 passed (20)
      Tests  99 passed (99)
   Start at  15:39:30
   Duration  439ms
```

All 20 test files / 99 tests passing, including the 3 new ones.

### Typecheck (Step 5)

Command: `npm run typecheck` (`tsc -p tsconfig.json --noEmit`)

```
> harness-hub@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit

EXIT: 0
```

Clean — no type errors.

## Deviations

None. All four files use the brief's code verbatim (imports, names, ordering, formatting). `ALL_DOCTOR_RULES` order matches the brief exactly: canon-presence, config-validity, skill-shape, skill-frontmatter, clobber-risk, skill-migration, trust-gate, generated-file-drift.

## Deferred notes (for the reviewer)

- `npx vitest run` prints a recurring warning: "Your Vite config uses features that are unsupported by `configLoader: 'native'` … ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1)". Pre-existing across all tasks' runs; not touched here. May warrant a `.mjs` rename or `"type": "module"` in a future housekeeping task.
- `npm` prints `Unknown env config "devdir"` on every invocation. Pre-existing environment noise; untouched.
- `src/doctor/rules/index.ts` imports `DoctorRule` as `import type` (as briefed) — consistent with the repo's `verbatimModuleSyntax`-friendly style; noted only as confirmation, no issue.
- Pre-existing untracked file `docs/current/2026-09-20-0021-harness-hub-future/2026-09-14-2211-harness-hub/harness-tech-stack.insight.md` remains untracked and was deliberately left out of the commit.

## Checklist

- [x] Step 1: Created both test files verbatim (only the tests, before any implementation)
- [x] Step 2: Ran targeted vitest command; confirmed RED — 2 suites fail with "Cannot find module" (0 tests run)
- [x] Step 3: Created `src/doctor/rules/index.ts` verbatim (8 rules, load-bearing order intact)
- [x] Step 4: Created `src/doctor/context.ts` verbatim
- [x] Step 5: Targeted run GREEN (2 files / 3 tests), full suite green (20 files / 99 tests), `npm run typecheck` clean
- [x] Step 6: One commit (`f888c76`) adding exactly the four new files with the exact message; no push, no rebase, no amend
