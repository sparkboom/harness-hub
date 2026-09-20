# Task 14 Report: Skill-migration doctor rule

## Implementation

Created `src/doctor/rules/skillMigration.ts` — a single rule module exporting `skillMigrationRule: DoctorRule` (id `skill-migration`), emitting the two distinct finding classes from spec §9:

- `'new'` plan entries → findings with `ruleId: 'unmigrated-skills'`, severity `error`, remediation to run `harness-hub migrate <id>`.
- `'collision'` plan entries → findings with `ruleId: 'skill-migration-collision'`, severity `error`, remediation to reconcile by hand then re-run migrate.

Both severities are `error` and `forceable: false` (never `--force`-able — resolved by running migrate or reconciling by hand), per spec.

Applicability: the rule applies when any harness with `skills.mode === 'migrate-symlink'` (from `ALL_HARNESS_IDS` + `getHarnessEntry`) is in `configuredHarnesses ∪ pendingHarnesses`. The check iterates only relevant migrate-symlink harnesses and consumes `planSkillMigration(repoRoot, entry)` per harness, mapping classifications to findings. Findings are harness-scoped (`harnessId` set).

Implementation and tests were written verbatim from the brief — no deviations.

## TDD Evidence

- **RED**: After writing `skillMigration.test.ts` (before the rule existed), `npx vitest run src/doctor/rules/skillMigration.test.ts` failed with `Failed to resolve import "./skillMigration"` — "Test Files 1 failed (1), Tests no tests". Expected failure (module not found) confirmed.
- **GREEN**: After implementing `skillMigration.ts`, the same command passed: "Test Files 1 passed (1), Tests 4 passed (4)".

## Test Results

- Focused: `npx vitest run src/doctor/rules/skillMigration.test.ts` → 4 passed (4).
- Full suite: `npm test` → **16 test files passed, 87 tests passed** (0 failures, 0 skipped), before committing.

## Files Changed

- `src/doctor/rules/skillMigration.ts` (new, 40 lines)
- `src/doctor/rules/skillMigration.test.ts` (new, 58 lines)

## Commit

- `327b379` — feat: skill-migration doctor rule (unmigrated-skills + skill-migration-collision) — 2 files changed, 98 insertions(+)

## Self-Review

- **Completeness**: All 5 brief steps executed in order (failing tests → RED → implement → GREEN → commit). Values verbatim from the brief: rule ids, severities, `forceable: false`, messages, remediations, commit message. No extra files, no extra exports, no index/registration wiring (matches existing rule modules — `canonPresenceRule` etc. are likewise not yet registered; registration is a later task's concern).
- **Quality**: Module reuses the migration classifier rather than re-walking directories; helpers (`migrateSymlinkHarnessIds`, `isRelevant`) are private. Findings carry `harnessId` for harness-scoped reporting.
- **Discipline (YAGNI)**: Nothing beyond the brief.
- **Testing**: Focused output is clean; full suite pristine (no new warnings introduced — the pre-existing Vite `configLoader` notice is unrelated and appears for every vitest run).

## Concerns

None. Test message-agnostic assertions (`expect.objectContaining`) leave the exact copy free to evolve without brittleness, and the collision/new classifications are both covered, plus the identical-and-irrelevant negative paths.
