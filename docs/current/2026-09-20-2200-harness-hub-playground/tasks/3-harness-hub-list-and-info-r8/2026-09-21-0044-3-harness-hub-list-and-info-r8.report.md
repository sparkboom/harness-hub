# Task 3 Report: `harness-hub list` and `harness-hub info` (R8)

## What I did

Followed the brief verbatim under TDD discipline (RED → GREEN → commit):

1. **Step 1 — failing tests first**: created `src/commands/list.test.ts` (3 tests: names every harness id, shows claude-code 2.1.272 and opencode 1.18.31 versions, sorted by harness id) and `src/commands/info.test.ts` (2 tests: detail for claude-code mentioning CLAUDE.md and .claude/skills; unknown id → exit 1 naming valid ids). Code copied verbatim from the brief.
2. **Step 2 — RED confirmed**: `npx vitest run src/commands/list.test.ts src/commands/info.test.ts` → both files fail with `Cannot find module './list'` / `Cannot find module './info'` (2 failed, exit 1).
3. **Step 3 — implemented `formatList`** in `src/commands/list.ts` verbatim from the brief: padded 5-column table (ID, NAME, VERSION, AGENT DOC, SKILLS), one row per `ALL_HARNESS_IDS` entry via `getHarnessEntry`.
4. **Step 4 — implemented `formatInfo` / `infoHarness`** in `src/commands/info.ts` verbatim: detail lines for version/verifiedDate, agent-doc mode (symlink path or native), skills mode (migrate-symlink path or native), optional trust-gate lines; `infoHarness` validates via `isHarnessId` and returns exit 1 with an error naming the 7 valid ids for unknown input.
5. **Step 5 — wired into the CLI** (`src/cli.ts`): added imports for `formatList` and `infoHarness`; added `program.command('list')` (prints via `console.log`) and `program.command('info <harness>')` (prints output, sets `exitCode` from result), both after `doctor` per the brief.
6. **Step 6 — GREEN**: targeted tests pass; full suite and typecheck stay green (below).
7. **Step 7 — committed** with the exact message from the brief, staging exactly the five task files.

## Files changed

- Created: `src/commands/list.ts` — `formatList()`
- Created: `src/commands/info.ts` — `formatInfo(id)`, `infoHarness(id)`
- Created: `src/commands/list.test.ts`, `src/commands/info.test.ts`
- Modified: `src/cli.ts` — two new imports, two new commands after `doctor`

## Test commands run + output summary

- `npx vitest run src/commands/list.test.ts src/commands/info.test.ts` (Step 2): **FAIL** as expected — "Cannot find module" for both new modules.
- `npx vitest run src/commands/list.test.ts src/commands/info.test.ts` (Step 6): **2 files passed, 5 tests passed**.
- `npx vitest run` (full suite): **29 files passed, 148 tests passed**.
- `npm run typecheck` (`tsc -p tsconfig.json --noEmit`): **clean, exit 0** (only a pre-existing unrelated npm `devdir` config warning).

## Decisions / deviations

- No deviations from the brief. All code is the brief's snippets verbatim.
- Note: `getHarnessEntry` lives at `src/registry/index.ts` (re-exported via `../registry`), matching the brief's import path `../registry` — no change needed.
- Commit scope: staged only `src/commands/list.ts`, `src/commands/info.ts`, `src/commands/list.test.ts`, `src/commands/info.test.ts`, `src/cli.ts`. The pre-existing unrelated working-tree changes under `docs/` (deletions in `"docs/ complete/..."`, untracked `docs/complete/` and `docs/current/2026-09-20-2200-harness-hub-playground/`) were left untouched, per the binding instruction.

## Concerns

- Minor (pre-existing, out of scope): the `docs/ complete/` deletion working-tree changes are unrelated churn that was already present; untouched as instructed.
- None otherwise.

## Fix round 1

**What changed** — addressing the two review findings, scoped to only the two named files:

1. [Critical] `src/commands/list.ts` — rows are now rendered from `[...ALL_HARNESS_IDS].sort()` instead of declaration order, so `list` output is sorted alphabetically by harness id (claude-code, codex, cursor, deepseek, hermes, opencode, pi), satisfying R8. Nothing else in the table format changed.
2. [Important] `src/commands/list.test.ts` — replaced the tautological "is sorted by harness id" test with the reviewer's meaningful assertion: it derives positions from the literal expected order `[...ALL_HARNESS_IDS].sort()` and asserts those positions are already in ascending order. This would have caught finding 1 (e.g. opencode before codex now fails).

**Test commands run + output:**

- `npx vitest run src/commands/list.test.ts src/commands/info.test.ts` → **2 files passed, 5 tests passed** (covering tests green with the new meaningful sort assertion).
- `npx vitest run` (full suite) → **29 files passed, 148 tests passed**.
- `npm run typecheck` → **clean, exit 0** (only the pre-existing unrelated npm `devdir` config warning).

**Commit:** `5ad3071` — "fix: sort harness-hub list output by harness id" (new commit on top of `81bbff1`; staged only `src/commands/list.ts` and `src/commands/list.test.ts`; docs/ churn untouched; nothing amended). Deferred minors (ternary, template literals, hardcoded valid-id list) intentionally not touched.

