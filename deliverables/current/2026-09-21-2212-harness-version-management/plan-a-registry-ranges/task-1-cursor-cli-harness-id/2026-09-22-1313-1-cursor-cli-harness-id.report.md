# Task 1 Report: Add `cursor-cli` to the harness id set

## What I implemented

Added `'cursor-cli'` to `ALL_HARNESS_IDS` in `src/harnesses.ts` (7 → 8 entries), in the exact position and order given verbatim in the brief (Step 3): after `'cursor'`. `HarnessId` and `isHarnessId` derive from the array, so both now include `'cursor-cli'` with no further changes.

Per the controller ruling, the existing test "lists exactly the seven recognized ids from spec §4" (which contradicted the brief's new 8-id assertions) was rewritten as "lists exactly the eight recognized ids" with `'cursor-cli'` added to its expected array. The brief's new test ("recognizes cursor-cli as an eighth id, distinct from cursor") was added verbatim alongside it.

## Files changed

- `src/harnesses.ts` — added `'cursor-cli'` to `ALL_HARNESS_IDS`
- `src/harnesses.test.ts` — updated seven-id test to eight-id set (renamed per ruling); added the brief's new test verbatim

Commit: `8f83bd8` — `feat(registry): add cursor-cli harness id (IDE vs headless CLI split)` (only the two files above staged; the untracked pre-existing `deliverables/current/` directory was left untouched).

## TDD Evidence

### RED

Command: `npx vitest run src/harnesses.test.ts` (before touching `src/harnesses.ts`)

Relevant output:

```
 ❯ src/harnesses.test.ts (4 tests | 2 failed) 86ms
   ❯ harnesses (4)
     × lists exactly the eight recognized ids 66ms
     × recognizes cursor-cli as an eighth id, distinct from cursor 8ms

 FAIL ... > lists exactly the eight recognized ids
AssertionError: expected [ 'claude-code', 'codex', …(5) ] to deeply equal [ 'claude-code', 'codex', …(6) ]
-   "cursor-cli",

 FAIL ... > recognizes cursor-cli as an eighth id, distinct from cursor
AssertionError: expected [ 'claude-code', 'cursor', …(5) ] to include 'cursor-cli'

 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)
```

Why expected: the tests assert an 8-element id set and `isHarnessId('cursor-cli') === true`, but `ALL_HARNESS_IDS` still had 7 entries and no `'cursor-cli'`. The two pre-existing tests (`isHarnessId accepts every recognized id`, `rejects an unrecognized string`) kept passing, as they don't depend on the new id.

### GREEN

Command: `npx vitest run src/harnesses.test.ts` (after adding the id)

Relevant output:

```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

## Test results summary

- `src/harnesses.test.ts`: 4/4 passing (RED → GREEN as above).
- Per Step 5, I did not run the full suite: `src/registry/versions.test.ts`, `src/registry/index.test.ts`, and `src/commands/list.test.ts` are expected to fail until Tasks 3–6 add the `config.json` / `data.ts` entries. The suite is knowingly-red at this commit by plan design.

## Self-review findings

- Diff contains only the two intended files; the id array matches the brief's Step 3 block verbatim (same order).
- The controller ruling was applied exactly: the old seven-id test's name and expected array now reflect the eight-id set; no other tests were modified.
- Test name change drops the stale "from spec §4" reference since the spec's §4 seven-id list is superseded by this deliverable; flagging in case the reviewer prefers a different phrasing.
- Nothing outside `src/harnesses.ts` / `src/harnesses.test.ts` was touched.

## Issues or concerns

- None blocking. The only judgment call was the eight-id test's name ("lists exactly the eight recognized ids" — the example name suggested by the controller ruling) and dropping the `from spec §4` suffix, since that spec section now disagrees with the 8-id set this deliverable introduces.