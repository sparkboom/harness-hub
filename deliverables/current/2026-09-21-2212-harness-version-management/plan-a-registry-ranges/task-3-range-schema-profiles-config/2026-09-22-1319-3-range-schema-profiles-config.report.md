# Task 3 Report: Range schema + profiles, config.json rewrite

**Status:** DONE
**Commit:** `d074061` — feat(registry): add convention profiles and rewrite config.json to version ranges
**Branch:** `harness-version-mgmt` (parent of `98fd980`)

## What I implemented

Exactly per the brief, verbatim values:

1. **`src/registry/profiles.ts` (new)** — `ConventionProfile` interface, `hermesTrustGate` constant
   (`.hermes/config.yaml`, `['skills','trusted_project_dirs']`, `hermes skills trust`), and
   `CONVENTION_PROFILES` with the three profiles: `claude-code-symlink-v1` (symlink CLAUDE.md +
   migrate-symlink `.claude/skills`), `hermes-native-v1` (native + native w/ trust gate), `native-v1`
   (native/native). `getProfile(name)` lookup exported.

2. **`src/registry/profiles.test.ts` (new)** — 3 tests: exact key set of the three profiles;
   claude-code is the only symlink/migrate-symlink profile and native-v1 has no trust gate; hermes
   trust gate trustCommand verbatim + `getProfile('does-not-exist')` returns undefined.

3. **`src/registry/versions.ts`** — `HarnessInstallManifest`, `MANIFEST_PATH`, the explanatory
   comment above it, and `ManifestShape` left as-is. Replaced `HarnessVersionEntry`
   (`displayName; install; ranges`) and added `VersionRange`
   (`profile; min; max: string | null; status: 'verified'|'unverified'; verifiedDate?; caveat?;
   review?: 'automated'|'manual'`). Loader now caches in a module-level `cached` variable and
   validates per harness id: ranges array non-empty (`... has no ranges`) and every range's profile
   exists in `CONVENTION_PROFILES` (`... references unknown profile "..."`). Missing-entry error
   message unchanged.

4. **`config/config.json`** — rewritten to the ranges schema exactly as Step 5 shows: all 8 ids
   (claude-code, cursor, cursor-cli, opencode, codex, hermes, pi, deepseek). cursor-cli present with
   its unverified range + AGENTS.md auto-load caveat; codex has the two ranges (verified
   0.139.0–0.155.0, unverified ≥ 0.155.0); cursor keeps its manual review + IDE-surface caveat;
   hermes uses `hermes-native-v1`; claude-code uses `claude-code-symlink-v1`; everything else
   `native-v1`.

5. **`src/registry/versions.test.ts`** — rewritten per Step 6: entry-per-id key check, every
   harness ≥ 1 range with a known profile + valid status, install-method check (cursor +
   cursor-cli fhs-wrapper; claude-code/codex npm), cursor manual vs cursor-cli automated review.
   The `getHarnessEntry` import is dropped as the brief intends (derivation test moves to Task 4).

## TDD evidence

- `profiles.test.ts` is a new file — no prior failure was possible; brief Step 3 explicitly expects
  PASS on first run ("this is a new file, no prior failure"). Result: 3/3 pass.
- `versions.test.ts` rewrite is a schema migration, not red→green: the old tests asserted the
  single-point `.version` schema that Step 4/5 deliberately remove. The new assertions
  (ranges non-empty, known profiles, cursor-cli fhs-wrapper, cursor manual / cursor-cli automated)
  exercise the new loader validation paths. 4/4 pass.

## Test results (brief's Step 7 scope only)

```
npx vitest run src/registry/versions.test.ts src/registry/profiles.test.ts
 Test Files  2 passed (2)
      Tests  7 passed (7)
```

Run twice (initial + after trailing-newline fix) — both green.

Known/expected fallout NOT touched (owned by Tasks 4/7 per task instructions):
- `src/registry/data.ts` still reads `.version`/`.verifiedDate` → typecheck + `index.test.ts` fail
  until Task 4 rebuilds it.
- `src/commands/list.test.ts` similarly owned by Task 7.
- Not run, per instructions to only run the focused tests.

## Files changed (commit d074061)

```
config/config.json            | 67 ++++---
src/registry/profiles.test.ts | 24 ++++++
src/registry/profiles.ts      | 36 ++++++
src/registry/versions.test.ts | 44 ++++---
src/registry/versions.ts      | 33 ++++--
5 files changed, 153 insertions(+), 48 deletions(-)
```

Nothing outside the five files. `data.ts` untouched (no drive-by fix).

## Self-review findings

- Read the full committed diff (`git diff 98fd980 d074061`) against the brief line by line:
  all range rows, caveats (em-dashes, ≡ symbol, backticked `agent`), verified dates, and error
  messages match verbatim; loader caches once and validates every referenced profile.
- Found & fixed during self-review: my `Write` calls dropped the trailing newline on the five
  files (originals had them; `\ No newline at end of file` in the diff). Added the newline, re-ran
  the focused tests (7/7), and `--amend`ed into the same commit. Final diff is newline-clean.
- Config JSON is valid (loader parses + validates it in the passing tests, exercising all 8 ids).

## Concerns

- None blocking. Noted for the controller: the whole-suite/typecheck state is intentionally red
  (data.ts, index.test.ts, list.test.ts) until Tasks 4/7 land — matches the plan's sequencing.