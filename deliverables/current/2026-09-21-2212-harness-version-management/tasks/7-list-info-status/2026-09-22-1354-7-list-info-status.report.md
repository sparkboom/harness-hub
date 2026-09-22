# Task 7 Report: Wire status into `list` and `info`

## What was implemented

Applied Steps 1–4 of the brief verbatim:

1. **`src/commands/list.ts`** — `formatList(installed: Record<HarnessId, string | null>)` now takes a
   required installed map, resolves each row's status via `resolveHarnessStatus(id, installed[id]).status`,
   and adds a `STATUS` column (padded 12) between `SKILLS` and `TRUST GATE` in both header and rows.
   Kept the pre-existing `e.skills.mode === 'migrate-symlink' ? 'migrate-symlink' : e.skills.mode`
   ternary verbatim per controller ruling 2 (no refactor).
2. **`src/commands/info.ts`** — `formatInfo(id, installedVersion?)` and
   `infoHarness(id, installedVersion?)` accept an optional installed version; a `  status: <status>`
   line was inserted after the version line; agent-doc/skills/trust-gate lines are byte-identical to
   the previous code. The unrecognized-id message now lists 8 valid ids (adds `cursor-cli`).
3. **`src/cli.ts`** — added `import { detectInstalledVersions } from './harnessDetect';`; the `list`
   action calls `formatList(detectInstalledVersions())`; the `info` action looks up
   `detectInstalledVersions()[harness as HarnessId] ?? null` and passes it to `infoHarness`
   (unknown ids safely resolve to `null` → `unrecognized`).
4. **Tests** — all `formatList()` calls in `list.test.ts` became `formatList(none)` with
   `none` built from `ALL_HARNESS_IDS` as the brief shows; added the new STATUS-column test verbatim
   (`shows a STATUS column and marks an uninstalled harness unrecognized`).
   `info.test.ts` gained the brief's `surfaces a status line` test verbatim (`formatInfo('codex', '0.150.0')`
   → `status: verified`; verified against `config/config.json`: codex verified range `0.139.0`–`0.155.0`
   contains `0.150.0`).

## Ruling choices

- **Ruling 1 (stale version assertions):** chose the "assert against values derived from
  `getHarnessEntry`" option — `expect(out).toContain(getHarnessEntry('claude-code').verifiedVersion)`
  and `getHarnessEntry('opencode').verifiedVersion` — so the test can never drift from `config.json`
  again. (Today those resolve to `2.0.0` / `1.0.0`.)
- **Ruling 2 (redundant ternary):** kept verbatim, no refactor.

## Test results

- `npx vitest run src/commands/list.test.ts src/commands/info.test.ts` → **2 files, 8 tests, all PASS**
  (this includes the previously failing stale-version test, now fixed).
- Regression run: `npx vitest run src/cli.test.ts src/commands/doctor.test.ts src/registry/index.test.ts`
  → **3 files, 15 tests, all PASS**.
- `npm run typecheck` (`tsc --noEmit`) → clean.
- Verified no other call sites of `formatList`/`formatInfo`/`infoHarness` exist beyond the five files.

## TDD evidence

Task is wiring/refactor of existing surfaces; the brief prescribes implementation-first with test
updates in Step 4. The RED state was inherited (stale-version test failing before this task);
the new-behavior tests (STATUS column, unrecognized marker, status line, 8-id message) were added
with the implementation per the brief and are GREEN.

## Files changed (commit `8723f18`, exactly the five authorized files)

- `src/commands/list.ts`
- `src/commands/info.ts`
- `src/cli.ts`
- `src/commands/list.test.ts`
- `src/commands/info.test.ts`

## Self-review findings

- `formatList` requires the installed map (no default arg) — ✓
- STATUS column present in header and rows; per-row status from `resolveHarnessStatus` — ✓
- `formatInfo`/`infoHarness` accept `installedVersion?: string | null`; status line added after
  version line; trust-gate/skills/agent-doc output untouched — ✓
- Valid-ids message lists 8 ids — ✓
- `cli.ts` detects versions for both `list` and `info` actions; `exitCode` handling preserved — ✓
- All existing test intent preserved: names-every-id, sorted-by-id, trust-gate-column tests intact
  (only the `formatList` call signature changed) — ✓

## Concerns

- Minor (cosmetic): the info `status:` line is emitted before the agent-doc/skills lines, per brief.
- `infoHarness` still accepts `HarnessId`-cast-free strings; unknown-id CLI behavior unchanged
  (exit 1, 8-id message). No functional concerns.
