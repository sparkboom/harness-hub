# SDD ledger — plan: deliverables/current/2026-09-21-2212-harness-version-management/plan-a-registry-ranges.plan.md

## Preflight scan (2026-09-22)

Model availability: `inherit` (session default) and `composer-2.5-fast` (fast tier) only.

### Task-pair/interface rows

| Pair | Interface / files | What one produces vs other consumes | Finding | Ruling |
|---|---|---|---|---|
| T1→T3 | `ALL_HARNESS_IDS` × config.json | T1 grows id set to 8; T3's config.json adds cursor-cli | Existing `src/harnesses.test.ts` test "lists exactly the seven recognized ids from spec §4" contradicts T1's new 8-id test — existing test must change in T1 | **Ruling:** T1 implementer updates the existing seven-id test to the eight-id set (cursor-cli included). Cost if wrong: test-only. |
| T3→T7 | config.json ranges × list output | T3 replaces single-point versions (claude-code 2.1.272, opencode 1.18.31) with ranges → verifiedVersion becomes 2.0.0 / 1.0.0 | `src/commands/list.test.ts` "shows each harness version" asserts `2.1.272` and `1.18.31`, which T3 removes | **Ruling:** T7 updates that test's assertions to the ranges-derived values (`2.0.0`, `1.0.0`), or better, derives from the registry. Cost if wrong: test-only. |
| T5→T8 | resolveVersion null-handling × DoctorContext.installedVersions | T8's `buildDoctorContext` defaults `installedVersions` to an EMPTY map; `enable.ts` (T31 buildDoctorContext call) leaves it empty while passing pending harnesses → rule reads `installedVersions[id]` = `undefined` for a pending harness | resolve.ts guards `installedVersion === null` only; `undefined` falls through to `parseVersion(undefined).trim()` → TypeError. `enable claude-code` would crash | **Ruling:** T5's resolve.ts treats `null` and `undefined` identically (`installedVersion == null` → unrecognized). Cost if wrong: negligible (undefined now maps to unrecognized instead of crashing). |
| T8→existing doctor tests | `DoctorContext` gains required `installedVersions` | 8 doctor rule test factories (`trustGate`, `skillShape`, `skillMigration`, `skillFrontmatter`, `generatedFileDrift`, `configValidity`, `clobberRisk`, `canonPresence`) construct `DoctorContext` literals; adding a required field breaks `npm run typecheck` (Task 9 gate) | Plan Task 8 doesn't mention these files | **Ruling:** T8 implementer also adds `installedVersions` to those 8 test-factory literals (mechanical: `installedVersions: {} as Record<HarnessId, string | null>`). `context.test.ts` and `run.test.ts` need no change (run.test.ts uses `Partial<>` overrides on a full literal — must add the field there too: it constructs a full literal, so add it). `enable.ts` needs no change (4th param defaults). Cost if wrong: typecheck failure, trivial. |
| T7↔T5/T6 | formatList/info signatures | Plan updates all callers (cli.ts, list.test.ts, info.test.ts) in the same task | none — plan self-consistent | — |
| T4↔T3 | data.ts consumes ranges | Derivation test values match T3 config: codex verified max = 0.155.0; claude-code open-ended → min = 2.0.0 | none | — |
| T2↔all | semver dep | Root package.json; both src/ and test/tools/ resolve from root node_modules | none | — |

### Task self-consistency rows

| Task | Check | Result |
|---|---|---|
| T1 | New 8-id test vs existing 7-id test in same file | Conflict — ruled above |
| T3 | versions.test rewrite drops getHarnessEntry import; derivation test moves to index.test.ts in T4 | consistent |
| T5 | resolve.test cases traced through planned impl: 0.150.0→verified; 0.155.1→unverified; 0.155.0→unverified (max exclusive ✓); 0.154.999→verified; null→unrecognized; '3.x'→coerce 3.0.0→no range→unrecognized ✓; 0.100.0→unrecognized ✓ | consistent |
| T6 | detectWith covers all 8 ids; cursor has empty candidates (null) | consistent |
| T7 | verbatim code carries pre-existing redundant skills ternary (present in current list.ts) — not new debt | keep |
| T8 | Two "Step 5" labels — second is Step 6 (register/wire). Cosmetic plan typo, no conflict | noted |
| T9 | Smoke test needs `npm run build` before `node dist/bin.js list` | consistent |

**Ruling 0 (process):** Task numbering in commits follows the plan's 9 tasks; expected-red suite after Task 1 is per plan Step 5 (commit alone, suite red until Task 6).

Verdict: plan is executable with the 4 rulings above carried into dispatches.
## Execution log
Task 1: complete (commits 4a08519..8f83bd8, review clean) — minor deferred: brief-mandated assertion overlap in harnesses.test.ts (toContain duplicates equality test); final review to triage.
Task 2: complete (commits 8f83bd8..98fd980, review clean) — minor deferred: npm "files" reformat in package.json (cosmetic); final review to triage.
Task 3: complete (commits 98fd980..d074061, review clean) — minors deferred (brief-mandated code): getProfile prototype-key lookup hole; loader error-path/caching behavior untested; partial trust-gate assertions in profiles.test.ts. Final review to triage.
Task 4: complete (commits d074061..f668152, review clean) — minors deferred (brief-mandated): duplicated newestVerified computation + unused fallback in verified branch; fallback branch (cursor-cli min/date constant) untested; data.ts EOF newline. Final review to triage.
Task 5: complete (commits f668152..e58c0d4, review clean)
Ruling: parseVersion wildcard guard — brief's verbatim `valid ?? coerce` contradicted the brief's own test ('3.x' must be unrecognized; coerce('3.x')=3.0.0 would match the open unverified range). Kept the test, added wildcard guard in parseVersion. Cost if wrong: a real installed version string containing a bare x/* outside valid() is treated unrecognized instead of coerced — conservative direction.
Ruling: `== null` guard in resolveVersion (undefined from Task 8's default empty installedVersions map must resolve unrecognized, not crash). Cost if wrong: negligible.
Minors deferred (final review to triage): undefined leaks through Resolution.installedVersion type on unrecognized-undefined path (Task 8's rule should pass null); unknown harness id crashes resolveHarnessStatus (guard at Task 8 call sites or here); first-match lowest-first precondition unenforced/uncommented; resolveHarnessStatus untested; missing EOF newlines in resolve.ts/resolve.test.ts.
Task 6: complete (commits e58c0d4..2f1c8d7, review clean)
Ruling: detectWith normalization — brief's verbatim test (expects '0.155.1\\n' → '0.155.1') contradicted the brief's verbatim detectWith (raw passthrough). Kept the test, normalized inside detectWith (idempotent with runVersion). Cost if wrong: none beyond the normalization itself.
Minors deferred (final review to triage): which() shell-quoting latent hazard (constants-only today); EOF newlines; spawn-error paths untested by design (runner injection).
Task 7: complete (commits 2f1c8d7..8723f18, review clean) — minors deferred (final review to triage): STATUS test could pin per-row; info.test codex '0.150.0' range-dependent (fails loudly if range narrows).
Ruling: test/tools detect fallout — Task 3's config rewrite (removing single-point .version) breaks test/tools/detect.ts + detect.test.ts + manifest.ts (pin '3.x' for cursor, 2.1.272 claude-code assertion), which read the same manifest. Plan contradicts itself: "touches src/ only — not test/tools/" vs "npm test must stay green" (npm test includes test/tools). Test/tools is the product's own acceptance harness, not Plan B's workspace. Ruled: minimal repair in Task 9 — manifest entry keeps displayName/verifiedDate/install, drops `version`, adds optional `verifiedVersion?`; detect.ts derives pin = verifiedVersion ?? 'unpinned' (cursor-cli unverified → 'unpinned'); detect.test.ts updated (cursor expects 'unpinned', claude-code derives from manifest, no literal 2.1.272/3.x). Compiled dist/ detect.js refreshes via build:tools. Cost if wrong: test/tools displays derived pin instead of literal — cosmetic; Plan B will re-express per its own spec anyway.
Task 8: complete (commits 8723f18..a31d8a3, review clean)
Ruling: brief test data '9.9.9' actually resolves unverified (open unverified range) — test changed to 0.100.0 (true unrecognized), rule code kept verbatim. Cost if wrong: none (test-only).
Ruling: detect fallout (see earlier entry) — fix deferred to Task 9 per plan.
Minors deferred (final review to triage): pendingHarnesses-gating path untested in versionStatus.test.ts; test title overclaims (missing-key case); EMPTY_VERSIONS shared mutable default.
Task 9: fix round 1/5 (1 open — reviewer Important: verifiedVersion never populated in config.json; my repair ruling's premise wrong. Spec R1: verifiedVersion is DERIVED from newest verified range, not stored. Amended ruling: test/tools/manifest.ts types ranges; test/tools/detect.ts derives pin = newest verified range's (max ?? min), else 'unpinned' — mirroring src/registry/data.ts; test updated to derive claude-code pin from ranges. Cost if wrong: display-only PIN column; same rule as product registry so drift risk minimal.)
Task 9: fix round 1/5 (1 addressed, 0 open; commits 335283b..1299b0b) — re-review clean.
Ruling (amended): cursor = verified range (pin 3.0.0), cursor-cli = unverified (unpinned) — my earlier amended ruling misattributed; implementer's correction verified against config.json. Cost if wrong: none (display-only).
Task 9: complete (commits a31d8a3..1299b0b, 1 fix round, review clean)

## Final whole-branch review (4a08519..1299b0b)
Verdict: merge with fixes. 3 Important:
1. resolveHarnessStatus crashes (TypeError) on an id missing from manifest — guard with named error/unrecognized.
2. parseVersion wildcard guard too broad — rejects banners containing x/* anywhere (e.g. "codex-cli 0.155.1" → unrecognized false-negative); restrict guard to bare wildcard range specs.
3. Loader doesn't validate min/max parse as semver — bad bounds surface as runtime TypeError in gte/lt instead of config-load error.
Deferred minors triaged: all 8 ledgered items defer (details in review package).
Final-review fix wave: commits 1299b0b..c06c352 — all 3 findings ADDRESSED, re-review clean. New minor: interior-x garbage like '0.1x.3' now coerces via valid()/coerce path (behavior drift for implausible output only; non-blocking).
Final review: CLEAN — branch ready.
