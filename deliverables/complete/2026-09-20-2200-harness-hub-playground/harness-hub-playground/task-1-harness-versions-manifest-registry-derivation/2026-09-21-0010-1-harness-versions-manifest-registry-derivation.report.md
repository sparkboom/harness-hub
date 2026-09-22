# Task 1 Report: `harness-versions.json` manifest + registry derivation

**Status:** DONE
**Commit:** `9ab5c62` — `feat: add harness-versions.json manifest as single source of truth`
**Branch:** `playground`

## What I did

Followed the brief's 8 steps in order with TDD discipline:

1. **Step 1 (RED):** Created `src/registry/versions.test.ts` with the five test cases exactly as specified in the brief (manifest covers all 7 harness ids, non-empty version + YYYY-MM-DD verifiedDate, registry derives from manifest with no drift, claude-code pinned to `2.1.272`, cursor is `fhs-wrapper` install / all others `npm`).
2. **Step 2:** Ran `npx vitest run src/registry/versions.test.ts` — failed as expected with `Error: Cannot find module './versions'`.
3. **Step 3:** Created `harness-versions.json` at the repo root, verbatim from the brief (all 7 ids: claude-code 2.1.272 / 2026-09-15, cursor 3.x fhs-wrapper, opencode 1.18.31, codex 0.153.2, hermes 0.21.2, pi 0.85.0, deepseek 0.1.5-rc.1).
4. **Step 4:** Created `src/registry/versions.ts` with `loadVersionsManifest()` exactly as specified — reads the manifest from `join(__dirname, '..', '..', 'harness-versions.json')`, validates every `ALL_HARNESS_IDS` entry exists, exports `HarnessVersionEntry` / `HarnessInstallManifest` types.
5. **Step 5:** Rewrote `src/registry/data.ts` so `HARNESS_REGISTRY` derives `displayName`/`verifiedVersion`/`verifiedDate` from `loadVersionsManifest()` at module load; every `agentsDoc`/`skills` block kept byte-for-byte identical to the previous file (verified against the original contents before editing). `claude-code.verifiedVersion` deliberately changed from `'unpinned'` (with its stale comment) to `'2.1.272'` per the controller ruling.
6. **Step 6:** Ran the new test plus the pre-existing `src/registry/index.test.ts` — all pass. Also ran `npx tsc --noEmit` (clean).
7. **Step 7:** `package.json` `files` array → `["dist", "harness-versions.json"]` so the manifest ships in the npm package. Appended `tools/dist/` to `.gitignore`, preserving the uncommitted `playground/` line that was already in the working tree (that line remains uncommitted-but-present in the same file; it was included in the commit since the whole file is staged — see Decisions).
8. **Step 8:** Staged exactly the six files from the brief and committed.

Ran the **full suite** (`npx vitest run`) as a final safety check before committing: **27 files / 143 tests, all passing.**

## Files changed (all in commit `9ab5c62`)

| File | Change |
|---|---|
| `harness-versions.json` | Created — 7-entry version manifest |
| `src/registry/versions.ts` | Created — manifest loader + types |
| `src/registry/versions.test.ts` | Created — 5 tests (brief verbatim) |
| `src/registry/data.ts` | Modified — registry derives versions from manifest |
| `package.json` | Modified — `files: ["dist", "harness-versions.json"]` |
| `.gitignore` | Modified — appended `tools/dist/` |

## Test commands run + output summary

- `npx vitest run src/registry/versions.test.ts` (Step 2) → **FAIL** as expected: `Cannot find module './versions'`.
- `npx vitest run src/registry/versions.test.ts src/registry/index.test.ts` (Step 6) → **2 files / 11 tests passed**.
- `npx tsc -p tsconfig.json --noEmit` → clean (`TYPECHECK_OK`).
- `npx vitest run` (full suite) → **27 files / 143 tests passed**.

## Decisions / deviations

1. **`claude-code.verifiedVersion` = `'2.1.272'`** (was `'unpinned'` in `data.ts`) — deliberate, per the binding controller ruling and the brief's note. The old inline comment about "opaque native binary" was removed with the literal it annotated.
2. **`.gitignore` commit includes the pre-existing uncommitted `playground/` line.** The working tree already had `playground/` as an uncommitted modification; the brief's commit step stages the whole `.gitignore` file, so that line rode along into the commit. Its content was left in place as instructed; committing it is the natural consequence of the specified `git add .gitignore`. Flagging for the reviewer's awareness only.
3. **`docs/current/2026-09-20-2200-harness-hub-playground/` left untracked** — not staged, not committed (verified post-commit `git status`: only `?? docs/...` remains).
4. No dependencies added; no other files touched.

## Concerns

- None blocking. (Minor note: the `playground/` gitignore line is now committed earlier than originally intended — cosmetic, reversible, doesn't affect behavior since `playground/` still isn't tracked.)
