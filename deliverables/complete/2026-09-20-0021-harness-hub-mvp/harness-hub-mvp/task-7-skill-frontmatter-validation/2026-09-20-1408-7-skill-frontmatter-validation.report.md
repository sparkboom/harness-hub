# Task 7 Report: Skill frontmatter validation

**Status:** DONE
**Commit:** `8b0f22a` feat: skill frontmatter validation per spec §7

## Implementation

Created `src/skills/validate.ts` exporting:

- `interface FrontmatterIssue` — discriminated by `code` (`missing-name`, `invalid-name-format`, `name-mismatch`, `missing-description`, `description-length`) with a human-readable `message`.
- `validateSkillFrontmatter(dirName, frontmatter): FrontmatterIssue[]` — pure function implementing spec §7's contract:
  - `name`: required; 1–64 chars; lowercase `a-z0-9-` via `NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/` (rejects leading/trailing/consecutive hyphens); must equal `dirName`.
  - `description`: required; non-empty; ≤ 1024 chars.
  - `frontmatter === undefined` (canon's degraded-YAML path from Task 6) yields `missing-name` + `missing-description`.
  - Optional keys untouched — the function reads only `name`/`description`.

Implementation and test file match the brief verbatim; no additions (YAGNI).

## TDD Evidence

**RED** — wrote `src/skills/validate.test.ts` (7 tests, brief Step 1 verbatim), then:

```
$ npx vitest run src/skills/validate.test.ts
Error: Failed to resolve import "./validate" from "src/skills/validate.test.ts"
Test Files  1 failed (1)
      Tests  no tests
```

Failed for the expected reason: module not yet implemented (not a typo/setup error).

**GREEN** — implemented `src/skills/validate.ts` (brief Step 3 verbatim), then:

```
$ npx vitest run src/skills/validate.test.ts
Test Files  1 passed (1)
      Tests  7 passed (7)
```

No refactor needed — code was already minimal and matches the brief.

## Test Results

- Focused: `npx vitest run src/skills/validate.test.ts` → 7/7 passed.
- Full suite: `npm test` → **7 files, 36/36 tests passed**, pristine output (no warnings/errors).
- Typecheck: `npm run typecheck` → clean, no errors.

## Files Changed

- `src/skills/validate.ts` (new, 46 lines)
- `src/skills/validate.test.ts` (new, 50 lines)

Commit: `8b0f22a` — `feat: skill frontmatter validation per spec §7` (2 files, 96 insertions).

## Self-Review

- **Completeness:** All 5 brief steps executed in order; test file and implementation verbatim; exact commit message used. ✓
- **Quality:** Pure function, no I/O, no side effects; typed union of issue codes; matches Task 6 canon's `frontmatter: undefined` degradation path. ✓
- **Discipline (YAGNI):** Nothing beyond the two brief files — no extra exports, no doctor wiring (that's Task 11), no registry changes. ✓
- **Testing:** Watched RED (module-not-found) before implementing; 7/7 GREEN; full suite green before committing; output pristine. ✓

## Concerns

None.

- Note for the controller: an unrelated untracked doc (`docs/current/2026-09-20-0021-harness-hub-future/...harness-tech-stack.insight.md`) predates this task and was deliberately left out of the commit.
