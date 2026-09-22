# Task 2 Report — Specific finding-id renames (R10)

Status: DONE
Commit: cd35c9fcf7a7c1326d938c6a889aa4da64fe5bb9 (`refactor: rename finding ruleIds to be failure-specific`)

## What I did

Followed the brief's TDD steps in order:

1. **Step 1 (RED)** — Updated the two tests that already asserted ruleId strings:
   - `src/doctor/rules/generatedFileDrift.test.ts`: `ruleId: 'generated-file-drift'` → `'claude-drift'`.
   - `src/commands/enable.test.ts`: both `blockingFindings[0].ruleId` assertions `'clobber-risk'` → `'claude-md-clobber'` ("hand-written CLAUDE.md without --force" and "does not clobber a foreign file on drift-repair").
2. **Step 2 (RED)** — Added specific-ruleId assertions:
   - `clobberRisk.test.ts`: `claude-md-clobber` (hand-written CLAUDE.md case), `claude-skills-clobber` (foreign symlink case).
   - `configValidity.test.ts`: `config-unknown-harness-id`, `config-ambiguous`, `config-parse-error`, `config-invalid-shape` (one per case).
   - `skillShape.test.ts`: `skill-flat-file` (flat .md at skills root), `skill-missing-skill-md` (dir with no SKILL.md).
   - `skillFrontmatter.test.ts`: `skill-name-mismatch` (name/dir mismatch case).
3. **Step 3** — Ran `npx vitest run src/doctor/rules src/commands/enable.test.ts src/commands/migrate.test.ts`: **12 failed / 45 passed** — all failures were the new assertions receiving the old ruleIds, as expected.
4. **Step 4** — Applied the renames in the rule sources:
   - `clobberRisk.ts`: agents-doc branch → `'claude-md-clobber'`, skills branch → `'claude-skills-clobber'`.
   - `configValidity.ts`: the four branches → `'config-unknown-harness-id'`, `'config-ambiguous'`, `'config-parse-error'`, `'config-invalid-shape'`.
   - `skillShape.ts`: flat-file → `'skill-flat-file'`, missing-SKILL.md → `'skill-missing-skill-md'`.
   - `skillFrontmatter.ts`: added `CODE_TO_RULE_ID` map (codes verified against `src/skills/validate.ts`: `missing-name`, `invalid-name-format`, `name-mismatch`, `missing-description`, `description-length`), `ruleId: CODE_TO_RULE_ID[issue.code] ?? 'skill-frontmatter'`.
   - `generatedFileDrift.ts`: → `'claude-drift'`.
5. **Step 5** — Updated string-match consumers:
   - `enable.ts` drift check → `f.ruleId === 'claude-drift'`.
   - `cli.ts` `--force` help → `'overwrite clobber findings (CLAUDE.md, .claude/skills symlink target)'`.
   - `migrate.ts` prose → `'invalid skill — refusing to adopt invalid skill(s), …'`.
   - `wiring/migrateSymlink.ts` doc comment → `(claude-md-clobber, claude-skills-clobber, unmigrated-skills, skill-migration-collision)`.
   - `migrate.test.ts` (controller ruling): both `toContain('clobber-risk')` assertions → `toContain('invalid skill')`, and the two test titles' `(clobber-risk)` parentheticals → `(invalid skill)`.
6. **Step 6** — `npx vitest run`: **27 files / 143 tests, all passed**. Also `npm run typecheck`: clean.
7. **Step 7** — Committed with the brief's message.

## Files changed (16)

- `src/doctor/rules/clobberRisk.ts` (+test)
- `src/doctor/rules/configValidity.ts` (+test)
- `src/doctor/rules/skillShape.ts` (+test)
- `src/doctor/rules/skillFrontmatter.ts` (rewritten with the map; +test)
- `src/doctor/rules/generatedFileDrift.ts` (+test)
- `src/commands/enable.ts` (+test)
- `src/commands/migrate.ts` (+test)
- `src/wiring/migrateSymlink.ts` (comment only)
- `src/cli.ts` (help text only)

## Test commands + output summary

- `npx vitest run src/doctor/rules src/commands/enable.test.ts src/commands/migrate.test.ts` (Step 3, pre-rename): 12 failed / 45 passed — expected RED.
- `npx vitest run` (post-rename): **27 passed (27 files), 143 passed (143 tests)** — full suite PASS.
- `npm run typecheck`: clean.
- Exhaustive grep `clobber-risk|generated-file-drift|skill-frontmatter|skill-shape|config-validity` over `src/`: every remaining hit is a rule `id:` field, the untouched `index.test.ts` rule-id list, a rule-name comment (`canon.ts:51` left alone per ruling, plus comments in `enable.test.ts` and `migrate.ts:61` naming the skill-shape/skill-frontmatter *rules*), or the brief-mandated `?? 'skill-frontmatter'` fallback. No code consumer of the renamed values remains.

## Decisions / deviations

- **`migrate.test.ts` scope extension** (controller ruling): updated the two `toContain('clobber-risk')` assertions to `'invalid skill'` and the two test-title parentheticals to `(invalid skill)` — required for the full-suite PASS to hold after the migrate.ts prose change.
- **`migrate.ts:62` comment**: after the required renames, the comment still read "anything that fails is a clobber-risk error", referencing the old prose. Changed "clobber-risk error" → "invalid-skill error" (comment-only) so the file no longer names the old terminology anywhere; grep now shows zero stale references. `canon.ts:51` and other rule-*name* comments left untouched per the ambiguity resolutions.
- No deviations from the brief's mapping values; all 14 new ruleId strings match the Interfaces section verbatim.

## Concerns

- none (code-wise).
- Informational, not mine to act on: the working tree contains pre-existing, unstaged deletions of `docs/ complete/2026-09-20-0021-harness-hub-mvp/…` (note the space in the directory name) plus an untracked `docs/complete/` directory — this looks like an unrelated in-progress docs archival/move by someone else. I did not stage, commit, revert, or modify any of it; my commit contains only the 16 src files listed above.
