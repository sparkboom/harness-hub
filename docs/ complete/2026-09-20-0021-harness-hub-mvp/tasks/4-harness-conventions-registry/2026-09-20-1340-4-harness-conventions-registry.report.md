# Task 4 Report: Harness conventions registry

**Status:** DONE
**Commit:** `73036c8` feat: declarative harness-conventions registry

## Implementation

Implemented the declarative, internal per-harness conventions registry exactly per
`task-4-brief.md`, in TDD order:

- `src/registry/types.ts` — `AgentsDocConvention` (`native` | `symlink` + optional
  `symlinkPath`), `TrustGateConvention` (`configPathFromHome`, `trustedDirsKeyPath`,
  `trustCommand`), `SkillsConvention` (`native` | `migrate-symlink` + optional
  `symlinkPath`, optional `trustGate`), `HarnessEntry` (`id: HarnessId`,
  `displayName`, `verifiedVersion`, `verifiedDate`, `agentsDoc`, `skills`).
  Verbatim from the brief, doc comments included.
- `src/registry/data.ts` — `HARNESS_REGISTRY: Record<HarnessId, HarnessEntry>` with
  all 7 entries verbatim: claude-code (`unpinned`/`2026-09-20`, AGENTS symlink
  `CLAUDE.md`, skills migrate-symlink `.claude/skills`), cursor (`3.x`/`2026-09-10`),
  opencode (`1.18.31`/`2026-09-14`), codex (`0.153.2`/`2026-09-03`), hermes
  (`0.21.2`/`2026-09-11`, trust gate `.hermes/config.yaml` →
  `['skills','trusted_project_dirs']`, command `hermes skills trust`),
  pi (`0.85.0`/`2026-09-04`), deepseek (`0.1.5-rc.1`/`2026-09-10`).
  `Record<HarnessId, HarnessEntry>` makes a missing/extra key a compile error.
- `src/registry/index.ts` — `getHarnessEntry(id)` accessor, re-exports
  `HARNESS_REGISTRY` and the four types. Consumes `HarnessId` from `../harnesses`
  (Task 3) as specified.

## TDD Evidence

- **RED (Step 2):** `npx vitest run src/registry/index.test.ts` →
  `Error: Cannot find module './index'` — 1 suite failed, no tests ran.
- **GREEN (Step 6):** same command → `Test Files 1 passed (1)`, `Tests 5 passed (5)`.
- **Full suite:** `npm test` → `Test Files 4 passed (4)`, `Tests 13 passed (13)`.
- **Typecheck:** `npm run typecheck` → clean, no errors.

## Test results

| Command | Result |
|---|---|
| `npx vitest run src/registry/index.test.ts` | 5/5 passed |
| `npm test` (full suite) | 13/13 passed, 4 files |
| `npm run typecheck` | clean |

## Files changed

- Created `src/registry/types.ts` (41 lines)
- Created `src/registry/data.ts` (68 lines)
- Created `src/registry/index.ts` (10 lines)
- Created `src/registry/index.test.ts` (37 lines; 49 after the post-review fix)

Commit `73036c8` contains exactly these 4 files (156 insertions).

## Self-review

- **Completeness:** All 7 brief steps executed in order; test file, types, data, and
  accessor copied verbatim from the brief (spot-diffed every entry value, all
  `verifiedVersion`/`verifiedDate` provenance values match).
- **Quality:** Exhaustiveness enforced by the type system via
  `Record<HarnessId, HarnessEntry>`; accessor is total over `HarnessId`, no
  runtime lookup failure possible for known ids.
- **Discipline (YAGNI):** Nothing beyond the brief's file list; no extra exports,
  helpers, or speculative fields.
- **Testing:** RED→GREEN observed, not assumed; full suite green before commit
  (per task order). Output pristine apart from a pre-existing vitest
  config-loader warning that appears on all runs regardless of this change.

## Concerns

None blocking. Two notes for the record:

1. The vitest warning "ESM syntax in a file loaded as CommonJS (vitest.config.ts)"
   predates this task and is unrelated to it.
2. An untracked doc file
   (`docs/current/2026-09-20-0021-harness-hub-future/.../harness-tech-stack.insight.md`)
   existed before this task; it was not staged or touched — it is not part of Task 4's
   scope.

---

# Fix Report (post-review)

**Finding fixed:** review coverage gap — the test suite never asserted the two
filesystem-wiring literals (`CLAUDE.md`, `.claude/skills`), so a registry edit
changing them would have passed all 5 tests.

## What changed

- `src/registry/index.test.ts` — added one test, verbatim per the controller's
  authorized fix: "pins the exact symlink paths claude-code wires". It asserts
  `agentsDoc.symlinkPath === 'CLAUDE.md'` and `skills.symlinkPath === '.claude/skills'`
  for claude-code, and that every other harness id has both `symlinkPath` fields
  `undefined`. No implementation files touched (`data.ts` / `types.ts` unchanged);
  no new imports needed (`getHarnessEntry` and `ALL_HARNESS_IDS` were already
  imported).

## Covering tests

| Command | Result |
|---|---|
| `npx vitest run src/registry/index.test.ts` | 6/6 passed (was 5) |
| `npm test` (full suite) | 14/14 passed, 4 files (was 13) |

## Commit

Amended per controller authorization so Task 4 stays a single commit:
`0151a84` feat: declarative harness-conventions registry — same message, now
4 files / 168 insertions (index.test.ts grew 37 → 49 lines, +12 test lines).

## Verification notes

- Working tree clean after amend except the pre-existing untracked docs insight file
  (untouched, out of scope).
- Typecheck unaffected (test-only change); full suite green.
