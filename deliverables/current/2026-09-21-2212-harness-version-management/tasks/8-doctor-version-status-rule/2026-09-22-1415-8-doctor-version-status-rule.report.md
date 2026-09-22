# Task 8 Report — The doctor version-status rule

**Commit:** `a31d8a3` — `feat(doctor): warn on unverified/unrecognized installed versions`
**Branch:** `harness-version-mgmt`

## What was implemented

1. **`src/doctor/types.ts`** — `DoctorContext` gains the required field
   `installedVersions: Record<HarnessId, string | null>` (doc-commented).
2. **`src/doctor/context.ts`** — `buildDoctorContext` gains a 4th param
   `installedVersions` defaulting to `EMPTY_VERSIONS` (`{} as Record<HarnessId, string | null>`),
   per the brief. No detection happens in the context builder (keeps pure unit tests fast);
   the default is an empty map, so `enable` (which still calls the 3-arg form) is unaffected —
   pending harnesses then resolve as unrecognized → warnings only, never blocking.
3. **`src/doctor/rules/versionStatus.ts`** (new) — the `version-status` rule, **verbatim from
   the brief**: warns (`severity: 'warning'`, `forceable: false`) for each configured/pending
   harness whose installed version resolves `unrecognized` (`version-unrecognized`) or
   `unverified` (`version-unverified`); silent for `verified`; skips irrelevant harnesses.
4. **`src/doctor/rules/versionStatus.test.ts`** (new) — rule tests (see TDD evidence).
5. **`src/doctor/rules/index.ts`** — `versionStatusRule` imported and appended after
   `generatedFileDriftRule` in `ALL_DOCTOR_RULES`.
6. **`src/commands/doctor.ts`** — imports `detectInstalledVersions` and passes it as the 4th
   arg to `buildDoctorContext`. This is the only command-file edit; **`enable.ts` untouched**.

## Rulings applied

- **Ruling 1 (factory fallout):** added
  `installedVersions: {} as DoctorContext['installedVersions']` to all 9 test-factory
  literals: `trustGate`, `skillShape`, `skillMigration`, `skillFrontmatter`,
  `generatedFileDrift`, `configValidity`, `clobberRisk`, `canonPresence` (rule tests) and
  `src/doctor/run.test.ts` (`makeCtx` literal before `...overrides`, so overrides still win).
- **Ruling 2:** rule emits warnings only; status never blocks. Verified in code and by test.
- **Ruling 3:** rule code kept verbatim. Undefined entries (pending harnesses under the
  empty default map) hit `resolveHarnessStatus` → `installedVersion == null` → `unrecognized`,
  whose message guards with `installed ?? 'unknown'`; the `unverified` branch is unreachable
  with `undefined` installed, so its direct interpolation is safe.

## TDD evidence (RED → GREEN)

- **RED 1:** wrote `versionStatus.test.ts` (brief's Step 2) before the rule existed →
  `1 failed (Test Files) / no tests` (cannot resolve `./versionStatus`).
- **GREEN:** implemented `versionStatus.ts`; suite went green (after the test-data fix below).
- Final: `versionStatus.test.ts` — **5 passed**.

## Deviation: brief's unrecognized test data was wrong (rule code unchanged)

The brief's Step 2 test used `codex: '9.9.9'` expecting `version-unrecognized`. But the
shipped manifest (`config/config.json`) gives codex an **open-ended unverified range**
`[0.155.0, ∞)`, so `9.9.9` resolves **`unverified`**, and the test failed against the
(correct) brief-verbatim rule. Per the spec, `unrecognized` = matches **no** range; since
every shipped harness's last range is open-ended, the only unrecognized paths are `null`,
unparseable, or **below the first range's min**. Fixed the test to use `codex: '0.100.0'`
(below codex's verified min `0.139.0` — same value the plan's own Task 5 resolver test uses
for unrecognized) with an explanatory comment. **No rule code changed.**

## Additional tests beyond the brief (backing the controller's self-review criteria)

- `warns unrecognized when the version is unknown (null or missing entry)` — asserts
  severity `warning` and the `unknown` fallback message.
- `ignores harnesses that are neither configured nor pending` — configured `cursor`
  (verified → silent) with an unrecognized but irrelevant `codex` → zero findings.

## Additional mechanical fallout (beyond Ruling 1's list): `src/doctor/rules/index.test.ts`

The existing `ALL_DOCTOR_RULES` test pins the exact rule-id list ("exactly the 8 rule
modules…"). Registering the 9th rule (brief Step 4) broke it. Updated the pinned list to
include `'version-status'` and the test title to say 9. This is the same mechanical class as
Ruling 1, and Task 9 runs `npm test` as its gate, so it could not be left red. Spec §9's
original 8 rules still all appear, in order.

## Verification results

- `npx vitest run src/doctor/rules/versionStatus.test.ts src/commands/doctor.test.ts
  src/doctor/context.test.ts src/doctor/rules/ src/doctor/run.test.ts`
  → **13 files / 50 tests, all passed.**
- `npm run typecheck` → **clean** (including all 9 fixed factories).
- `npm test` (whole suite) → **195 passed, 2 failed** — both failures are in
  `test/tools/detect.test.ts` and are **pre-existing at HEAD** (verified by stashing my
  changes and re-running: same 2 failures without my work). That directory is explicitly
  out of this plan's scope ("This plan touches `src/` only — not `test/tools/`").
- `git diff HEAD~1 HEAD -- src/commands/enable.ts` → empty (enable untouched).
- Commit contains exactly: `versionStatus.ts`, `versionStatus.test.ts`, `rules/index.ts`,
  `rules/index.test.ts`, `context.ts`, `types.ts`, `commands/doctor.ts`, the 8 rule-factory
  test files, and `run.test.ts` — 16 files, +115/−12.

## Self-review findings

- Rule warns (never errors) for configured/pending harnesses with unverified/unrecognized
  versions; silent for verified; irrelevant harnesses skipped — ✓ (tests cover all four).
- Context default keeps pure unit tests fast — ✓ (`EMPTY_VERSIONS`; detection only in
  `commands/doctor.ts`).
- Doctor command passes real detection; enable untouched — ✓.
- Typecheck clean including the 9 factories — ✓.

## Concerns

1. **Brief test-data defect (resolved in-task):** codex `9.9.9` in the brief's test resolves
   `unverified` against the shipped manifest, not `unrecognized`. Fixed the test to
   `0.100.0`; reviewers should confirm that's the intended semantic (it matches the plan's
   Task 5 fixture and the spec's definition).
2. **Pre-existing red suite:** `test/tools/detect.test.ts` fails at HEAD (2 tests) and will
   make Task 9's `npm test` gate red unless fixed separately. Out of this task's scope per
   the plan's global constraints, but the controller should plan for it.
3. **Minor:** `commands/doctor.test.ts` now runs `detectInstalledVersions()` (8 binary
   probes) on every `runDoctorCommand` call. Probes fail fast for missing binaries, and the
   two tests still pass in ~ms, but a host with slow/hanging `--version` binaries could slow
   that suite. Existing design per the brief (real detection wired into the command); noting
   for awareness.
