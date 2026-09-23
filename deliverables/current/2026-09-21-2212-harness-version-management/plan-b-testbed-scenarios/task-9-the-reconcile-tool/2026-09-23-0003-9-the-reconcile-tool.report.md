# Task 9 Report — The reconcile tool (R3)

**Status:** DONE (with concerns noted below)
**Commit:** `8489bc5` — `feat(reconcile): --check drift gate and --record review write-back` (on `harness-version-mgmt-plan-b`, parent `c0b686b`)

## What was done

1. **`test/tools/manifest.ts` extended (brief Step 1):**
   - Added `ManifestRange`, `ManifestVersionEntry`, and `loadVersionEntries()` verbatim from the brief. `loadManifest()` untouched (back-compat preserved).
   - **Controller ruling applied:** `const MANIFEST_PATH` → `export const MANIFEST_PATH`, reusing the file's existing `MANIFEST_CANDIDATES` dual-layout resolution (source `test/tools` + compiled `test/tools/dist`). One-word diff; no behavior change for existing callers.

2. **`test/tools/reconcile.test.ts` created** — verbatim from the brief Step 2 (3 tests, injected resolver; no real `npm view`, no `config.json` writes).

3. **`test/tools/reconcile.ts` created** — verbatim from the brief Step 3, with exactly two deviations:
   - `MANIFEST_PATH` is imported from `./manifest` instead of the brief's broken `const MANIFEST_PATH = join(__dirname, '..', '..', 'config', 'config.json')` (from `test/tools/dist`, `../..` lands in `test/`, so Task 10's `node test/tools/reconcile.mjs --check` would read a nonexistent file). `recordReview`'s read and write both resolve through the exported `MANIFEST_PATH`, which works under both layouts.
   - Dropped the now-unused `import { join } from 'node:path'` that only served that constant.
   - Everything else (semver usage, `isCoveredByVerified`, `npmUpstream`, `checkLatest`, `formatCheck`, `recordReview` returning `{ changed, message }`, `main`) is character-for-character the brief's code. `{ changed, message }` kept per the controller ruling (message form is authoritative over the Interfaces section's `{ changed; entry }`).

4. **`test/tools/reconcile.mjs` created** — verbatim from the brief Step 4. Checked against the repo's established shim pattern first: `env.mjs`, `probe.mjs`, and `testbed.mjs` are byte-identical to the brief's shim modulo the entry filename, so the brief *is* the repo pattern — no adaptation needed.

5. **Built** `test/tools/dist/` via `npm run build:tools` (gitignored) so the shim and Task 10's smoke test have their compiled entry.

## Verification (test command + output summary)

- `npx vitest run test/tools/reconcile.test.ts` → **1 file passed, 3 tests passed** (176 ms).
- Regression: `npx vitest run test/tools` → **15 files / 60 tests passed** (manifest.ts is imported broadly; nothing broke).
- `npx tsc -p test/tools/tsconfig.json --noEmit` → OK (strict).
- Shim smoke (built): `node test/tools/reconcile.mjs` → usage line, exit 1.
- `--check` with a fake `npm` on PATH answering `0.156.0`: table rendered, exit 1; `NO` rows exactly where expected — `claude-code` (0.156.0 below verified min 2.0.0), `codex` (outside 0.139.0–0.155.0), `opencode` (0.156.0 below min 1.0.0); `yes` for `cursor`/`cursor-cli` (no npm package → `latest: null` → covered) and `hermes`/`pi`/`deepseek` (0.0.0–∞). Matches brief semantics (null → covered; min-inclusive/max-exclusive).
- `--record` no-change path: `deepseek 0.156.0` → `is already verified — no change`, exit 0, `config.json` byte-identical (git status clean).
- `--record` flip path: `codex 0.156.0` → flips the `0.155.0–∞` unverified range to `verified` with `verifiedDate 2026-09-22`; then `git checkout -- config/config.json` restored the file.
- `--record` new-range path: `claude-code 1.5.0` (below verified min 2.0.0, matches no range) → new sorted verified range `1.5.0–∞` inserted; then restored.
- Error paths: unknown harness and unparseable version both print `reconcile: …` to stderr, exit 1.
- `config.json` ended untouched; working tree after commit contains only the four task files.

## Concerns

1. **`config.json` formatting churn (main concern, kept verbatim per ruling):** the repo's `config.json` is hand-formatted with inline `install` objects and wrapped range lines. `recordReview`'s `JSON.stringify(raw, null, 2)` fully re-expands it, so a one-field flip rewrites/reformats the entire file (~130-line diff for one semantic change; content is semantically identical — verified in the git diff before restore). The flip branch also reorders keys within the affected range object (`status`/`verifiedDate` re-emitted in different positions — JSON.stringify emits keys in mutation order for the object it mutates; untouched ranges keep their original key order). Worth a follow-up: either a one-time normalization commit of `config.json` to the 2-space style, or a format-preserving serializer.
2. **Pre-existing, out of scope:** `test/tools/verify/schema.test.ts` imports `../../../src/harnesses` — a test-file violation of the Task 1 "no src/ imports in test/tools" ruling. All *production* code in `test/tools` (including everything in this task) remains src-free. Flagging for the controller; not touched by this task.
3. Trivial note for Task 10: the check gate needs no extra flag — `node test/tools/reconcile.mjs --check` already exits non-zero on drift (I passed an invented `--exit-code` flag in one smoke run; unknown flags are ignored, exit 1 propagated either way).

## Environment note

The sandbox shell truncates/cuts off everything after any command that exits non-zero (observed with `false; echo hi`), so verification used guard patterns (`cmd; if [ $? -eq 1 ]; …`) and `&&` chains. No impact on the deliverable; noted only in case later tasks see "missing output" on expected-failure commands.

## Fix round 1 (controller-ruled, commit 8489bc5 → follow-up fix commit)

Two Important brief-inherited defects from review were fixed:

1. **`recordReview` crash on empty `ranges`** — `entry.ranges[entry.ranges.length - 1].profile` threw a raw TypeError when an entry had `ranges: []`. Fix: guard before the new-range branch; if `entry.ranges.length === 0`, throw `reconcile: harness "<harness>" has no ranges to derive a profile from` (caught by `main` → exit 1). Guard placed so the flip branch is unaffected. Verified end-to-end with a temp config entry (restored afterwards): exit 1 with the ruled message.
2. **npm failure silently read as "covered"** — empty stdout after `npm view` failure (spawn error, non-zero exit, timeout) became `latest: null` → `covered: true` → gate exited 0 silently. Fix: `npmUpstream.latest` now throws on `r.error` or `r.status !== 0` (`reconcile: npm view failed for <pkg>: <detail>`); `null` now means only "no package configured". `checkLatest` wraps each `resolver.latest` call per-row: on error the row gets `{ latest: null, covered: false, error: <message> }` and the run exits **2** (distinct from drift's 1, and from success's 0). `CheckRow` gains the optional `error?: string` field (controller-approved additive extension); `formatCheck` prints `ERR` for error rows. `main`'s `--check` branch gained a try/catch → `reconcile: upstream check failed: <msg>` on stderr, exit 2, so a hard failure (e.g. unreadable/malformed `config.json`) can no longer escape as an unhandled rejection. Verified end-to-end: fake failing npm → all `ERR` rows, exit 2; unpinned harnesses remain `yes`; fake `npm` still gives drift exit 1 as before; malformed config → exit 2 with legible message.

Supporting changes (controller-approved):
- `checkLatest` gained an optional second parameter `entries` (default `loadVersionEntries()`) so tests inject fixture entries and stay hermetic.
- Missing/empty `ranges` in `checkLatest` are handled via `entries[id].ranges ?? []` → not covered → drift (the honest answer).

Tests: added 2 focused tests (RED before the fix — verified failing 2/5 against pre-fix code, then GREEN): (a) `checkLatest` with an entry whose `ranges` is `[]` or absent + resolver returning a version → rows not covered, exit 1, no crash; (b) rejecting resolver → row carries `error: 'npm down'`, `covered: false`, exit 2, and `formatCheck` renders `ERR`.

Verification: `npx vitest run test/tools/reconcile.test.ts` → **2 files… 1 file passed, 5 tests passed (was 3)**. Regression `npx vitest run test/tools` → **15 files / 62 tests passed**. `npx tsc -p test/tools/tsconfig.json --noEmit` → OK. Shim smokes (rebuilt `dist/`): failing-npm `--check` → `ERR` rows + exit 2; fake-version `--check` → drift exit 1 unchanged; empty-ranges `--record` → exit 1 + ruled message; malformed-config `--check` → exit 2 via main's catch; `config.json` restored byte-identical after all smokes.