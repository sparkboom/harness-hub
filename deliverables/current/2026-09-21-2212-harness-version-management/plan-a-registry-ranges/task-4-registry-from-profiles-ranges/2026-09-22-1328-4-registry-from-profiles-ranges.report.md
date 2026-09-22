# Task 4 Report: Build `HARNESS_REGISTRY` from profiles + ranges

**Status:** DONE
**Commit:** `f668152` — `feat(registry): build HARNESS_REGISTRY from profiles + ranges`
**Branch:** `harness-version-mgmt`

## What was implemented

1. **`src/registry/data.ts`** — full rewrite, verbatim from the brief's Step 1:
   - `loadVersionsManifest()` supplies `versions` (module-level, as before).
   - `newestVerified(ranges)` → last `verified` range (`.at(-1)`).
   - `effectiveProfile(entry)` → newest verified range's profile, falling back to the last (highest-bounds) range when nothing is verified; throws on unknown profile names.
   - `build(id)` maps each id to the unchanged `HarnessEntry` shape: `verifiedVersion` = verified `max ?? min` (or the fallback range's when nothing is verified), `verifiedDate` = verified → fallback → `'2026-01-01'`, and `agentsDoc`/`skills` come from the effective profile.
   - `HARNESS_REGISTRY` assembled via `Object.fromEntries(ALL_HARNESS_IDS.map(...))` cast to `Record<HarnessId, HarnessEntry>`.

2. **`src/registry/index.test.ts`** — appended the brief's Step 3 derivation test to the existing describe block. Existing tests untouched.

## Tests and results

- **Step 2** (before adding the derivation test): `npx vitest run src/registry/index.test.ts` → **6 passed (6)**. Existing assertions (claude-code symlink paths, hermes trust gate, per-id population) hold because the profiles encode the same conventions as the old hand-written literals — exactly as the brief expected.
- **Step 4** (after adding the derivation test): same command → **7 passed (7)**.
- `npx tsc --noEmit` → exit 0. The Task 3 fallout (old literal reading `.version`/`.verifiedDate`) is resolved.

## TDD evidence (RED/GREEN)

The brief's step order is Step 1 (rewrite `data.ts`) → Step 3 (add test), so a classic RED-first run wasn't literally executable: the new test asserts behavior only the new `data.ts` provides, and the old `data.ts` can't even compile against the new types. I demonstrated RED honestly instead: after writing the new test, I temporarily restored HEAD's (old) `data.ts` and ran the suite —

- **RED:** `Tests 6 failed | 1 passed (7)` — the derivation test failed with `Received: undefined` at `expect(getHarnessEntry('codex').verifiedVersion).toBe('0.155.0')` (the old literal produced `undefined` from the ranges-shaped manifest; the other failures were the same fallout breaking the pre-existing tests).
- **GREEN:** restored the new `data.ts`, suite returned to **7 passed (7)**, then committed.

Process note: the restore `cp` inside that RED demo command silently didn't execute (the `;`-separated restore ran only when the pipeline succeeded, and a failed pipeline short-circuited nothing as intended — it broke the `&&` chain). I caught it because the follow-up run was still red, inspected state, restored from the `/tmp/data.ts.new` backup, and re-verified **7/7 green before committing**. No stray state remains; backup removed.

## Files changed (commit `f668152`, 39 insertions / 66 deletions)

- `src/registry/data.ts` (rewritten)
- `src/registry/index.test.ts` (+5: the derivation test only — `git diff HEAD~1 HEAD` confirms the append is the sole change)

## Self-review

- [x] `data.ts` matches the brief verbatim — mechanical diff of the committed file against the brief's fenced code block: lines 1–38 identical; only artifact was my extraction script sweeping the brief's second ```ts fence (the test snippet) and a missing trailing newline, both extraction side-effects, not content differences.
- [x] Derivation test values exact: codex `0.155.0`, claude-code `2.0.0`.
- [x] Existing `index.test.ts` assertions untouched (diff shows only the appended test).
- [x] Only the two permitted files changed; working tree otherwise clean (`deliverables/current/` untracked, pre-existing).
- [x] Full suite left knowingly-red files (`list.test.ts`, etc.) untouched per instructions; only the focused file was run.

## Concerns

- The committed `data.ts` has no trailing newline (matches the brief's snippet as written; git flags `\ No newline at end of file`). Cosmetic; can be normalized later if the repo style wants one.
- Per the brief, `verifiedDate` falls back to `'2026-01-01'` when neither the verified nor fallback range carries a date. All 8 current entries have dates in config, so nothing exercises that default yet.
- In `build()`, `fallback` is computed even when a verified range exists (used only via the `??` chain). Verbatim from the brief; harmless.