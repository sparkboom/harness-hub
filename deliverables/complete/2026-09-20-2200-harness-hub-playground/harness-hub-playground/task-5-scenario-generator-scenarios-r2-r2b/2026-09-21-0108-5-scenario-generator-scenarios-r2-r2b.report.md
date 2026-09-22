# Task 5 report — scenario generator + scenarios (R2, R2b)

## What I did

Followed the brief's TDD steps in order, on branch `playground`:

1. **Step 1 (RED):** Wrote `tools/generate.test.ts` verbatim from the brief.
2. **Step 2 (see RED):** `npx vitest run tools/generate.test.ts` failed with
   `Cannot find module './scenarios'` — expected failure confirmed.
3. **Steps 3–6 (implement):**
   - `tools/scenarios/shared.ts` — `validAgentsDoc()`, `validSkill()`,
     `harnessConfig(harnesses)` exactly as the brief's source.
   - 19 scenario modules under `tools/scenarios/` (2 verbatim from the brief:
     `baseline.ts`, `claude-md-clobber.ts`, plus `claude-drift.ts` verbatim
     including its drift-inducing `actions`; the remaining 16 follow the
     representative pattern with the brief's asset compositions and spec-table
     descriptions).
   - `tools/scenarios/index.ts` — `Scenario` interface + `SCENARIOS` registry
     (19 entries, keys = finding `ruleId`-mirroring kebab-case names).
   - `tools/generate.ts` — `generateScenario`, `parseArgs`, `main` verbatim
     from the brief.
   - `tools/generate.mjs` — thin ESM entrypoint verbatim from the brief
     (requires `dist/generate.js` at runtime, with a helpful "not built"
     message).
4. **Step 7 (GREEN):** see "Test commands run" below.
5. **Step 8 (commit):** committed only the task files (plus the vitest config,
   see Deviations) — nothing under `docs/`.

## Files changed (commit `aab0b16`)

- Created: `tools/generate.test.ts` (verbatim brief test)
- Created: `tools/generate.ts`, `tools/generate.mjs`
- Created: `tools/scenarios/shared.ts`, `tools/scenarios/index.ts`
- Created: 17 scenario modules — `baseline.ts`, `claude-drift.ts`,
  `claude-enable.ts`, `claude-md-clobber.ts`, `claude-skills-clobber.ts`,
  `missing-agents-md.ts`, `ambiguous-config.ts`, `config-invalid-shape.ts`,
  `config-parse-error.ts`, `unknown-harness-id.ts`, `flat-skill-file.ts`,
  `skill-missing-skill-md.ts`, `skill-missing-name.ts`,
  `skill-name-mismatch.ts`, `skill-missing-description.ts`,
  `unmigrated-skills.ts`, `skill-migration-collision.ts`, `hermes-trust.ts`,
  `multi.ts`
- Created: `vitest.config.mjs` (see Deviations — required for the brief's
  verbatim test to load)

## Test commands run + output summary

| Command | Result |
|---|---|
| `npx vitest run tools/generate.test.ts` (Step 2, pre-impl) | FAIL — `Cannot find module './scenarios'` (expected RED) |
| `npx vitest run tools/generate.test.ts` (post-impl, pre-config) | 4/4 tests passed but suite failed to load — `./generate` resolved to `generate.mjs` (CLI shim ran `process.exit(1)`); fixed via `vitest.config.mjs` (see Deviations) |
| `npx vitest run tools/generate.test.ts tools/primitives.test.ts` (Step 7) | PASS — 2 files, 9 tests |
| `npx vitest run` (full suite) | PASS — **31 files, 157 tests** |
| `npm run build:tools` | clean `tsc` compile; produced `tools/dist/generate.js`, `tools/dist/fs.js`, `tools/dist/primitives.js`, and 21 files under `tools/dist/scenarios/` |

Additional verification beyond the brief (smoke, not unit-tested):

- Rendered **all 19 scenarios** into fresh tmp dirs via the compiled
  `tools/dist/generate.js`; asserted key artifacts (baseline AGENTS.md +
  SKILL.md; claude-skills-clobber's foreign symlink; claude-drift's removed
  CLAUDE.md; unmigrated-skills' `.claude/skills/a/SKILL.md` content `body\n`).
- Idempotency: rendering `claude-drift` twice into one target leaves no stale
  files; switching scenarios fully resets the target.
- Unknown scenario: `generateScenario(t, 'nope')` throws
  `Unknown scenario "nope". Available: baseline, claude-enable, …`.
- `git check-ignore tools/dist/generate.js` → matched
  `.gitignore:5:tools/dist/`; `git status` shows no `tools/dist` leakage; the
  root npm `dist/` is unaffected by `build:tools` (separate tsconfig
  `rootDir`/`outDir`).

## Decisions / deviations

1. **Added `vitest.config.mjs` (not in the brief's file list).** The brief's
   verbatim test imports `./generate`; Vite's default extension order resolves
   that to `generate.mjs` (the CLI shim) before `generate.ts`, so the test
   file crashed at import time with the shim's `process.exit(1)` — before any
   test ran. The binding ruling forbids modifying the test file, and renaming
   `generate.mjs` would violate the spec (`R6` names `tools/generate.mjs` as
   the thin entrypoint; `playground` scripts call it directly). The minimal
   fix was a repo-level Vitest `resolve.extensions` override putting `.ts`
   first: `['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json']` (Vite's default
   list, reordered). Config is `.mjs` (not `.ts`) because the repo's
   package.json lacks `"type": "module"`; the `.ts` variant produced a
   "ESM syntax in a file loaded as CommonJS" warning that the `.mjs` form
   eliminates. Impact: none on `npm run build`/`typecheck` (root tsconfig
   includes only `src/**`). Risk if wrong: a future test importing a bare
   `./x` where both `x.mjs` and `x.ts` exist would now get `.ts` — currently
   no such pair exists except `generate`, which is exactly the desired
   direction.
2. **`skill-missing-name.ts` mid-write correction.** My first draft of that
   file used a wrong import path (`../primitives-alias`); rewritten
   immediately with the correct `../primitives` import before any test run.
   No committed artifact reflects the typo (single commit covers all files).
3. **Scenario descriptions** for the 16 non-verbatim modules follow the spec
   table's "rule → finding" mapping (the brief's step-4 bullets gave
   compositions; the spec table is the description source the brief points
   to). Format: `<condition> (<rule> → <finding>).` for rule-mapped scenarios;
   action phrasing ("ready for `harness-hub enable …`") for `claude-enable`
   and `hermes-trust`; "composition; no single rule" for `multi` — matching
   the brief's description notes.
4. **`claude-skills-clobber` actions** follow the binding ambiguity ruling +
   the `clobberRisk.test.ts` foreign-symlink fixture exactly:
   `mkdir -p .claude` then `symlinkSync('/somewhere/else', .claude/skills)`.
5. **`unmigrated-skills`** uses the ruled
   `raw('.claude/skills/a/SKILL.md', 'body\n')` (creates a real dir containing
   a SKILL.md with no canon counterpart — exercises the skill-migration rule's
   unmigrated branch, not clobber).
6. **Nothing under `docs/` committed** (binding constraint honored). Note:
   the working tree contains unrelated pre-existing `docs/complete/` →
   `docs/current/...` moves staged/deleted by the controller session; I
   neither touched nor committed those.

## Concerns

- **Config addition is the one real deviation** (file `vitest.config.mjs`).
  It's required for the brief's verbatim test to execute at all; the
  alternative (changing the import in the test) was explicitly forbidden, and
  renaming `generate.mjs` was off-spec. If the controller prefers a different
  mechanism (e.g. an `extensions` alias in a shared vitest workspace config),
  it's a 3-line change.
- `generate.mjs` remains un-unit-tested by design (brief Step 7 note);
  manual verification happens in Task 9 after `build:tools`. My compiled-dist
  smoke run above covers `generateScenario` behavior end-to-end; the `.mjs`
  shim itself is exercised only for the "not built" guard path implicitly.
- Registry count is 19, matching the spec table row-for-row (baseline,
  4 config, 4 skill-shape/frontmatter, 4 clobber/migration, hermes-trust,
  claude-drift, multi, missing-agents-md, flat-skill-file).
