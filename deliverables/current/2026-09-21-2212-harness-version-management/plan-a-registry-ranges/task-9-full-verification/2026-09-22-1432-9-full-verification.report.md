# Task 9 Report: Full verification + ruled repair

**Status: DONE**

## Ruled repair (pre-flight, controller-ledgered)

Task 3's config rewrite (removing single-point `version`) broke `test/tools/detect.ts`, which read `manifest[id].version` for its PIN column. Repair applied exactly as ruled:

1. **`test/tools/manifest.ts`** — `HarnessManifestEntry`: dropped `version: string`, added `verifiedVersion?: string` (optional; entries like `cursor-cli` have no verified range). `displayName`, `verifiedDate`, `install` unchanged.
2. **`test/tools/detect.ts`** — in `detectWith`, pin derivation changed from `pin: manifest[id].version` to `pin: manifest[id].verifiedVersion ?? 'unpinned'`.
3. **`test/tools/detect.test.ts`** — added `import { loadManifest } from './manifest';`; stale assertion `expect(cursor.pin).toBe('3.x')` → `expect(cursor.pin).toBe('unpinned')`; stale literal `expect(out).toContain('2.1.272')` → `const manifest = loadManifest(); expect(out).toContain(manifest['claude-code'].verifiedVersion ?? 'unpinned')`. 'NOT INSTALLED' assertion kept.
4. **`npm run build:tools`** — rebuilt; compiled `test/tools/dist/detect.js` loads and runs cleanly (exit 0). Dist stayed **untracked** (`git ls-files test/tools/dist` → empty; not committed), per ruling.
5. **`npx vitest run test/tools/detect.test.ts`** → **3/3 PASS** (108ms).

## Step 6: Full suite — `npm test`

**PASS: 39 test files, 197 tests, 0 failures** (vitest v5.0.1, 5.00s).

```
 Test Files  39 passed (39)
      Tests  197 passed (197)
```

## Step 7: Typecheck + build

`npm run typecheck && npm run build` — **both clean, exit 0, no errors** (`tsc -p tsconfig.json --noEmit` then `tsc -p tsconfig.json`).

## Step 8: Smoke test (verbatim)

`node dist/bin.js list` (exit 0):

```
ID          NAME              VERSION     AGENT DOC   SKILLS      STATUS      TRUST GATE
claude-code  Claude Code        2.0.0        symlink      migrate-symlink unrecognized -
codex        Codex              0.155.0      native       native       unrecognized -
cursor       Cursor             3.0.0        native       native       unrecognized -
cursor-cli   Cursor CLI         3.0.0        native       native       unrecognized -
deepseek     DeepSeek Harness   0.0.0        native       native       verified     -
hermes       Hermes             0.0.0        native       native       verified     hermes skills trust
opencode     OpenCode           1.0.0        native       native       verified     -
pi           Pi                 0.0.0        native       native       unrecognized -
```

`node dist/bin.js info codex` (exit 0):

```
Codex (codex)
  version: 0.155.0 (verified 2026-09-03)
  status: unrecognized
  agent doc: native (reads AGENTS.md)
  skills: native (reads .agents/skills/)
```

Matches the brief's expectations: `list` has a STATUS column; harnesses not installed on this machine show `unrecognized`, installed ones (`deepseek`, `hermes`, `opencode`) show `verified`; `info codex` shows a `status:` line with the pin (`0.155.0`, verified 2026-09-03 = newest verified range's max). No crash.

## Step 9: Commits

1. `45ddd5b` — `fix(tools): derive detect pin from verifiedVersion after ranges rewrite` (3 files: manifest.ts, detect.ts, detect.test.ts; +6/−4)
2. `335283b` — `test: verify registry-ranges deliverable end-to-end` (run as written per brief Step 4; picked up the previously-untracked `deliverables/current/2026-09-21-2212-harness-version-management/` docs — 9 files — alongside the --allow-empty commit semantics)

Working tree clean after both commits. Branch: `harness-version-mgmt`.

## Self-review

- Repair matches ruling exactly: optional `verifiedVersion?`, `?? 'unpinned'`, cursor → `'unpinned'`, claude-code assertion manifest-derived. ✔
- Full suite green (39 files / 197 tests), typecheck + build clean, detect.test 3/3. ✔
- Smoke output captured verbatim above. ✔
- Commits split as specified (repair first, then end-to-end). ✔
- Scope respected: only the three named `test/tools` files changed; nothing in `src/` touched. ✔

## Concerns

- Minor: with only `deepseek`/`hermes`/`opencode` installed here, the live `unverified` display path wasn't exercised in the smoke run (no locally installed harness sits in an unverified range); it is covered by unit tests from Tasks 5/7 within the green 197.
- Note: the second commit captured the deliverable docs (`deliverables/current/2026-09-21-2212-harness-version-management/`) that were sitting untracked — a consequence of running the brief's `git add -A` as written.

---

# Fix Report (post-review amendment)

## Review finding (Important)

The original ruling's premise was wrong: `verifiedVersion` is not stored data — `config/config.json` carries no such key. Confirmed: all entries have shape `displayName` / `install` / `ranges` only, so `manifest[id].verifiedVersion` was always `undefined` and every pin fell back to `'unpinned'`; the "manifest-derived" assertion was statically `'unpinned'`.

## Amended implementation (controller-ledgered)

Per spec R1's derivation rule — verifiedVersion = newest `verified` range's `max` (or `min` when `max` is null), the same rule as `src/registry/data.ts` (`newestVerified(ranges) = ranges.filter(r => r.status === 'verified').at(-1)`, then `verified.max ?? verified.min`) — re-expressed in test/tools (which cannot import from src/):

1. **`test/tools/manifest.ts`** — added `export interface VersionRange` (mirror of `src/registry/versions.ts`: `profile`, `min`, `max: string | null`, `status: 'verified' | 'unverified'`, optional `verifiedDate`/`caveat`/`review`). `HarnessManifestEntry` is now `displayName` + `install` + `ranges: VersionRange[]` (dropped `verifiedVersion?` and `verifiedDate` — matching the actual config, which has no top-level verifiedDate). Added `export const UNPINNED = 'unpinned'` sentinel.
2. **`test/tools/detect.ts`** — added exported `derivedPin(ranges)`: newest verified range via `.at(-1)`, `return verified.max ?? verified.min`, else `UNPINNED`. `detectWith` now uses `pin: derivedPin(manifest[id].ranges)`.
3. **`test/tools/detect.test.ts`** — `expectedPin(id)` helper re-expresses the rule against `loadManifest()[id].ranges`, so expectations are genuinely config-derived. Assertions:
   - `cursor.pin` → `expectedPin('cursor')` and `'3.0.0'` (cursor's only range is **verified** with manual review + caveat; open-ended → min `3.0.0`). NOTE: the amended ruling said cursor's range is unverified and expected `'unpinned'`; that is factually wrong for the actual config — the unverified entry is **cursor-cli**, which is asserted instead: `expect(cursorCli.pin).toBe(UNPINNED)`. First run failed exactly on this (`expected 'unpinned', received '3.0.0'`), then was corrected to match the config.
   - claude-code → `expectedPin('claude-code')` in the formatted output (open-ended verified range min `2.0.0` → pin `2.0.0`; no longer a constant).
   - NEW codex test pins the max-vs-min branch: capped verified range `0.139.0 ≤ v < 0.155.0` → `expectedPin('codex')` and literal `'0.155.0'`.
   - 'NOT INSTALLED' assertion kept.

## Verification (commands + output)

- `npx vitest run test/tools/detect.test.ts` → **4 passed (4)** (was 3; +1 codex branch test).
- `npm run build:tools` → clean; `node test/tools/dist/detect.js` → exit 0. Dist remains untracked (`git ls-files test/tools/dist` empty; not committed).
- `npm test` (full suite) → **Test Files 39 passed (39), Tests 198 passed (198)**.
- `npm run typecheck` → clean; `npm run build` → clean (both exit 0).
- `node dist/bin.js list` re-smoke → exit 0, STATUS column unchanged (deepseek/hermes/opencode verified, rest unrecognized). `info codex` verified in the previous round; src/ untouched.

## Commit

- `1299b0b` — `fix(tools): derive detect pin from verified ranges (mirrors registry rule)` (only the three test/tools files: manifest.ts, detect.ts, detect.test.ts; +50/−8). No additional end-to-end commit, per instruction.

## Self-review

- Derivation mirrors the registry rule (`at(-1)` on verified, `max ?? min`, else sentinel) ✔
- `UNPINNED` exported once from manifest.ts, used in detect.ts and detect.test.ts — no duplicated literal ✔
- Assertions genuinely config-derived (expectedPin helper); max branch covered by codex ✔
- Scope: only the three named files changed ✔

## Concerns

- The amended ruling misattributed cursor's range as unverified — the config's cursor entry is `verified` (manual review + caveat) and cursor-cli is the unverified one. The UNPINNED assertion was placed on cursor-cli accordingly; flagged so the ledger reflects the actual config semantics.

