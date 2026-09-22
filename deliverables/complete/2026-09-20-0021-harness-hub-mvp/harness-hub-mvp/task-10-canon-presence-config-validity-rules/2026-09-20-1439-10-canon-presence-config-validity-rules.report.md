# Task 10 Report: Canon-presence + config-validity rules

## Implementation

Implemented per `docs/current/2026-09-20-0021-harness-hub-mvp/tasks/10-canon-presence-config-validity-rules/2026-09-20-1437-10-canon-presence-config-validity-rules.brief.md`, code verbatim from the brief:

- `src/doctor/rules/canonPresence.ts` — `canonPresenceRule: DoctorRule` (`id: 'canon-presence'`, `applies: () => true`). Consumes `hasAgentsMd` from `src/canon.ts`. Returns one canon-wide `error` finding when `AGENTS.md` is absent at `repoRoot`; `[]` otherwise. Message text verbatim ("AGENTS.md is missing at the repo root.") so Task 18's `doctor` output test can match on "AGENTS.md".
- `src/doctor/rules/configValidity.ts` — `configValidityRule: DoctorRule` (`id: 'config-validity'`, `applies: () => true`). Exhaustive switch over `ConfigLoadResult.status`:
  - `absent` → `[]`
  - `ok` → error finding iff `unknownIds` non-empty (lists the ids)
  - `ambiguous` → error (both yaml/json paths reported)
  - `parse-error` → error including the underlying `error` string
  - `invalid-shape` → error including the `reason`
  - All findings canon-wide (no `harnessId`), `forceable: false`.

## TDD Evidence

**RED (Step 2):** `npx vitest run src/doctor/rules/canonPresence.test.ts src/doctor/rules/configValidity.test.ts`
→ FAIL: `Cannot find module './canonPresence'` / `Cannot find module './configValidity'`; Test Files 2 failed (2), Tests no tests. Matches brief's expectation (modules not found).

**GREEN (Step 5):** same command
→ Test Files 2 passed (2), Tests 8 passed (8). Matches brief's expected count (8).

## Test Results

- Focused: 8/8 passed.
- Full suite `npm test`: Test Files 11 passed (11), Tests 67 passed (67). Exit 0. Output pristine (no console noise).

## Files Changed

- Created: `src/doctor/rules/canonPresence.ts`
- Created: `src/doctor/rules/canonPresence.test.ts`
- Created: `src/doctor/rules/configValidity.ts`
- Created: `src/doctor/rules/configValidity.test.ts`

## Commit

- `fb6668c` feat: canon-presence and config-validity doctor rules (4 files, 147 insertions)

## Self-Review

- **Completeness:** All 6 brief steps executed in order; all values (rule ids, messages, remediations, `forceable: false`) verbatim from the brief.
- **Quality:** Implementation is the brief's code exactly; exhaustive discriminated-union switch satisfies the `Finding[]` return type with no casts.
- **Discipline (YAGNI):** Nothing beyond the brief's four files; no extra rules, options, or exports.
- **Testing:** Pristine output; both RED (module-not-found) and GREEN (8 passing) evidenced.

## Concerns

None.
