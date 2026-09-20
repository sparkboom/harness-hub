# Task 12 Report: Clobber-risk rule (registry-driven)

## Status: DONE_WITH_CONCERNS

## Implementation

- `src/doctor/rules/clobberRiskRule` (`src/doctor/rules/clobberRisk.ts`), rule id `clobber-risk`.
- Registry-driven: loops `ALL_HARNESS_IDS`, gating each id on relevance
  (`configuredHarnesses` or `pendingHarnesses`) and on symlink-based conventions
  (`agentsDoc.mode === 'symlink'` or `skills.mode === 'migrate-symlink'`). No
  hardcoded `claude-code` check anywhere — today only `claude-code` qualifies
  via `src/registry/data.ts`, but future registry entries qualify automatically.
- agentsDoc branch: computes the expected relative symlink target from
  `repoRoot/<symlinkPath>` to `repoRoot/AGENTS.md` via `relativeSymlinkTarget`,
  and reports an error finding when the link path is present but
  `isSymlinkTo` is false (exact stored-target comparison).
- skills branch: same pattern against `skillsRootDir(repoRoot)`, with the
  additional `isSymbolicLink()` guard so a real directory is not flagged
  (skill-migration rule's domain).
- All findings: `severity: 'error'`, `forceable: true` (the only doctor rule
  with forceable findings, per spec §8), `harnessId: id` (harness-scoped),
  remediation mentioning `enable --force`.

## Deviation from the brief's implementation snippet (test-forced)

The brief's Step 3 snippet gates both branches with `existsSync(linkPath)`.
The brief's own Step 1 test "flags a .claude/skills symlink pointing elsewhere"
symlinks to the nonexistent path `/somewhere/else` (a dangling symlink), and
`existsSync` follows symlinks — it returns `false` for a dangling link, so the
finding was skipped and the verbatim test failed.

Root cause verified empirically (node probe): `existsSync(dangling link) === false`
while `lstatSync(link).isSymbolicLink() === true`.

Fix: replaced `existsSync` with an `lstat`-based `pathPresent()` helper (true
for any directory entry, including a dangling symlink). This satisfies all six
verbatim tests and preserves the Task 8 ruling: a dangling link that *stores*
the expected target string still counts as ours (`isSymlinkTo` compares the
stored target exactly, no resolution), so it produces no finding. Both branches
use the same existence semantics for a consistent "path exists but is not a
symlink to the expected target" contract.

Everything else (structure, messages, remediations, imports) is the brief's
snippet verbatim. Tests are verbatim.

## TDD Evidence

- RED: `npx vitest run src/doctor/rules/clobberRisk.test.ts` →
  `Error: Cannot find module './clobberRisk'` (suite failed before implementation).
- GREEN (after implementation): 6 passed (6).
- Post-fix rerun after the `pathPresent` correction: 6 passed (6).

## Test results

- Focused: `npx vitest run src/doctor/rules/clobberRisk.test.ts` → 6 passed (6).
- Full suite: `npm test` → 14 test files, 79 tests, all passed.
- Typecheck: `npx tsc -p tsconfig.json --noEmit` → clean.

## Files changed

- `src/doctor/rules/clobberRisk.ts` (new, 75 lines)
- `src/doctor/rules/clobberRisk.test.ts` (new, 55 lines)

## Commit

- `c10f052` — `feat: clobber-risk doctor rule, driven by the harness registry`
  (2 files changed, 125 insertions)

## Self-review

- Completeness: all five brief steps done in TDD order; verbatim values used
  (rule id, messages, remediations, severity/forceable/harnessId); deviation is
  the documented `existsSync` → `pathPresent` fix only.
- Quality: helper documented with the reason it exists; registry-driven, no id
  hardcoding; consumes Task 3/4/6/8 modules via their public interfaces.
- Discipline (YAGNI): nothing beyond the brief's two files; no registration
  wiring (the brief excludes it — `runDoctor` takes rules as a parameter, so
  wiring is another task's job).
- Testing: pristine output; no skipped/tod tests; tmpdir fixtures cleaned in
  `afterEach`.

## Concerns

1. The implementation intentionally deviates from the brief's Step 3 snippet in
   one line per branch (`existsSync` → `pathPresent`, lstat-based). The brief's
   own test suite forced this; behavior matches the brief's stated contract
   ("a link path exists but is NOT a symlink to the expected canon target") and
   the Task 8 dangling-ours-link ruling. Flagging for controller awareness.
