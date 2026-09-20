# Task 11 Report: Skill-shape + skill-frontmatter doctor rules

## Implementation

Implemented exactly what the brief specifies, verbatim:

- `src/doctor/rules/skillShape.ts` — `skillShapeRule` (canon-wide, no harnessId), id `skill-shape`:
  - Flags every non-directory entry directly under `.agents/skills/` (via `listSkillsRootNonDirEntries` from `src/canon.ts`) with message `.agents/skills/<entry> is not a directory — skills must be laid out as <name>/SKILL.md.`
  - Flags every skill directory lacking a `SKILL.md` (via `listSkillDirNames` + `readSkillFrontmatter(...).hasSkillMd`) with message `.agents/skills/<name>/ has no SKILL.md.`
  - All findings `severity: 'error'`, `forceable: false`, with per-finding remediation strings as specified.
- `src/doctor/rules/skillFrontmatter.ts` — `skillFrontmatterRule` (canon-wide), id `skill-frontmatter`:
  - Iterates skill dirs; skips dirs with no `SKILL.md` (deferred to skill-shape).
  - Runs `validateSkillFrontmatter(name, frontmatter)` (from `src/skills/validate.ts`) on each present SKILL.md and converts each `FrontmatterIssue` into a Finding with `severity: 'error'`, `forceable: false`, remediation `Fix the frontmatter in .agents/skills/<name>/SKILL.md.`
  - Canon's degradation of malformed YAML to `{ hasSkillMd: true, frontmatter: undefined }` flows through the validator's missing-name/missing-description issues, as designed.
- No changes beyond the brief's four files (no rules-index registration — not in this task's scope).

## TDD Evidence

**RED (Step 2):** Wrote both test files verbatim from the brief, then ran:

```
npx vitest run src/doctor/rules/skillShape.test.ts src/doctor/rules/skillFrontmatter.test.ts
Test Files  2 failed (2)
Error: Cannot find module './skillShape' imported from .../skillShape.test.ts
```

Failed exactly as expected (modules not yet implemented), not for typos or other errors.

**GREEN (Step 5):** Implemented both rules, re-ran the same command:

```
Test Files  2 passed (2)
Tests  6 passed (6)
```

## Test Results

- Focused: `skillShape.test.ts` + `skillFrontmatter.test.ts` — 6/6 pass.
- Full suite: `npm test` — **13 files, 73/73 tests pass**.
- `npx tsc --noEmit` — clean (exit 0).

## Files Changed

- Created `src/doctor/rules/skillShape.ts`
- Created `src/doctor/rules/skillShape.test.ts`
- Created `src/doctor/rules/skillFrontmatter.ts`
- Created `src/doctor/rules/skillFrontmatter.test.ts`

Commit: `d25c6fa` — `feat: skill-shape and skill-frontmatter doctor rules` (4 files, 138 insertions).

## Self-Review

- **Completeness:** All 6 brief steps done in order; ids `skill-shape` / `skill-frontmatter`, messages, remediations, and severities match the brief verbatim. Test files copied verbatim from the brief.
- **Quality:** Follows the established rule convention (`canonPresenceRule` pattern): plain object typed `: DoctorRule`, `applies: () => true`, pure `check` over `DoctorContext`.
- **Discipline (YAGNI):** Nothing beyond the brief — no extra exports, no registration/index changes, no speculative options.
- **Testing:** Pristine test results; the only console noise is pre-existing, unrelated config warnings (`npm warn Unknown env config "devdir"`, Vite `configLoader` notice) that predate this task.
- **Process note:** During Step 4 I briefly deviated from the brief's verbatim code (`satisfies DoctorRule` + an extra `DoctorContext` import); caught it against the "verbatim" requirement before running tests and reverted to the brief's exact implementation.

## Concerns

None blocking. (Pre-existing warnings noted above are project-level config hygiene, out of scope for this task.)
