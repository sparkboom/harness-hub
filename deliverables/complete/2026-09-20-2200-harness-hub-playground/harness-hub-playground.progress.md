# SDD ledger — plan: docs/current/2026-09-20-2200-harness-hub-playground/harness-hub-playground.plan.md

Branch: `playground` (user-directed: work on current branch, no worktree).
Spec: docs/current/2026-09-20-2200-harness-hub-playground/harness-hub-playground.spec.md (read).
Plan merge-base with main: 9dd0f9c.

## Pre-flight scan

| Pair / task | Produces → consumes | Finding |
|---|---|---|
| T1 → T3 | `loadVersionsManifest` derives registry; `list`/`info` read registry | clean — plan's list.test expects '2.1.272'/'1.18.31', manifest pins match |
| T2 → T5 | renamed ruleIds ↔ scenario names | plan's scenario names already use renamed ids; `hermes-trust` finding id already `hermes-trust` (unchanged) — consistent |
| T2 ↔ T2 | `enable.ts` drift check rename must land with `generatedFileDrift.ts` rename | same task, plan Step 5 covers both — clean |
| T4 → T5/T6/T7 | `Asset`, primitives, `writeAssets`/`resetTarget` | signatures consistent across tasks; `Scenario.assets(target)` matches `writeAssets` |
| T6 → T7 | `loadManifest`, `resolveBinary` consumed by probe | probe test stubs runner; `resolveBinary` exported? plan's detect.ts defines it module-locally but probe.ts imports it — plan shows `resolveBinary` as module-local (no `export`). Ruling: export it from detect.ts |
| T5 | `skill` primitive in plan Task 4 has no `valid` param | spec R2a mentions `valid` controlling frontmatter; plan's primitive takes explicit `frontmatter` per scenario instead — same flexibility via explicit frontmatter args. Ruling: follow the plan (explicit frontmatter); spec's `valid` flag is an alternative mechanism for the same capability, scenarios cover all named cases |
| T8 | flake `buildNpmPackage` + `fakeSha256` | plan itself flags as first-cut with a build loop; verification of actual nix build is environment-dependent. Ruling: implement flake as specified; running the full `nix develop` hash-fill loop is best-effort (network/nix build may be unavailable in sandbox) — record outcome in report |
| T9 | playground git-ignored — `playground/package.json`/`setup.sh` uncommitted | plan Step 5 acknowledges: no commit for playground files. Ruling: follow plan; files exist on disk, untracked, per R7 |
| T2 | plan misses `src/commands/migrate.test.ts` — asserts `toContain('clobber-risk')` ×2, but migrate error prose becomes 'invalid skill — refusing…' | Plan's Step 6 says "full suite PASS" — it would fail. Ruling: Task 2 must also update migrate.test.ts prose assertions (change expected string to 'invalid skill'); reviewer will verify |
| T2 | plan's enable.test rename: `claude-md-clobber` | consistent with clobberRisk.ts agents-doc branch (CLAUDE.md case) — clean |
| T1 | registry index.test asserts verifiedVersion truthy + date format | manifest values satisfy — clean |
| T3 | info test asserts 'CLAUDE.md' and '.claude/skills' in claude-code output | formatInfo emits symlink paths — clean |
| T9 vs T3/T4 | Task 9 smoke test runs `harness-hub doctor` etc. | requires build + npm link; environment-dependent — implementer verifies what's possible, records outcome |

## Rulings

- Ruling: Task 2 scope extended to `src/commands/migrate.test.ts` prose assertions ('clobber-risk' → 'invalid skill') — required for plan Step 6 "full suite PASS" to hold; plan listed the file set incompletely. Cost if wrong: none, test-only change.
- Ruling: Task 6 must `export` `resolveBinary` (probe.ts imports it; plan's detect.ts source omits `export`). Cost if wrong: compile error, caught by build/tests immediately.
- Ruling: T8 nix hash-fill loop is best-effort — depends on nix + network availability at execution time; flake structure + manifest wiring is the deliverable. Cost if wrong: shell may not build until hashes are filled by hand later.
- Ruling: T9 playground files remain uncommitted (git-ignored, R7) — plan Step 5's own conclusion; no deviation.

## Execution log
Task 1: complete (commits a5e1710..9ab5c62, review clean) — manifest + registry derivation; minor (informational, no action): claude-code verifiedDate now 2026-09-15 per manifest; playground/ gitignore line committed early (harmless, satisfies T9 requirement).
Task 2: complete (commits 9ab5c62..cd35c9f, review clean) — R10 renames incl. migrate.test.ts ruling; minor (deferred): skillFrontmatter CODE_TO_RULE_ID could be typed Record<FrontmatterIssue['code'], string> to compile-check keys.
Task 3: fix round 1/5 (2 addressed, 0 open — list sorted by id + meaningful sort test; commits 81bbff1..5ad3071)
Task 3: complete (commits cd35c9f..5ad3071, review clean after 1 fix round)
Task 3: minor (deferred): list.ts identity ternary no-op; info.ts unnecessary template literals; info.ts error message hardcodes valid-id list instead of ALL_HARNESS_IDS.join(', ')
Task 4: complete (commits 5ad3071..38de0df, review clean) — tools scaffold + primitives; minors (informational): agentDoc/raw identical impl (brief API), path.join separators vs POSIX test paths.
Task 5: Ruling: vitest.config.mjs addition blessed — resolve.extensions reorder ('.ts' first) is necessary for the brief-verbatim test to load (Vite resolves ./generate to the .mjs CLI shim first); editing the test was forbidden, renaming generate.mjs off-spec. Cost if wrong: future bare './x' import where both x.ts and x.mjs exist resolves to .ts — currently only `generate`, which is the desired direction.
Task 5: Ruling: unknown-harness-id includes validSkill() though the brief bullet omits it — keeps canon healthy so the config finding isn't masked by canon-presence noise; matches spec table intent. Cost if wrong: negligible, additive fixture.
Task 5: complete (commits 38de0df..aab0b16, review clean); minor (deferred): generate.ts parseArgs '--target' as final arg yields undefined target instead of usage error (brief-verbatim).
Task 5 (follow-up): Ruling: commit the working-tree deletion of vitest.config.ts — it is the second half of Task 5's blessed vitest.config.mjs deviation; with both files in HEAD vitest resolves .ts first, so fresh clones would miss the resolve.extensions reorder and tools tests would crash on the generate.mjs shim. State already test-verified (Tasks 5/6 ran full suite in this working-tree state). Cost if wrong: none, config-only.
Task 5 (follow-up, committed by controller): d77361c drops vitest.config.ts (second half of the blessed .mjs deviation; prevents fresh-clone config shadowing).
Task 6: complete (commits aab0b16..0e7c504, review clean) — detect tooling; implemented manifest-path probing + detectWith trim normalization (both required by brief's own test); minors (deferred): manifest probe could be shadowed by stray manifest in tools/, pad() doesn't truncate.
Task 7: Ruling: detect.ts cursor BINARY_CANDIDATES gains ~/.local/bin/agent — Task 7's brief-verbatim test calls the real resolveBinary and the machine's agent CLI lives at that path; purely additive candidate. Cost if wrong: one extra which/existsSync probe per cursor detection.
Task 7: complete (commits d77361c..08e6247, review clean); minor (deferred): probe defaultRunner ignores child exit status (non-zero exit without spawn error still yields success) — first-cut R4 behavior, harden later.
Task 8: Ruling: keep committed flake.lock — brief's "commit only flake.nix" didn't anticipate the lock nix generates; without it the nixpkgs pin is unreproducible. Cost if wrong: negligible, one-line revert.
Task 8: Ruling (pre-set, upheld): hash-fill loop best-effort, stopped at cap — fakeHash placeholders + documented HASH FILL procedure is the accepted first-cut state.
Task 8: complete (commits 08e6247..8fa043c, review clean); minors (deferred): aarch64-darwin hardcoded, npmDepsHash/fetchurl pairing approximate until loop completes.
Task 9: Ruling: resetTarget wiping playground/package.json+setup.sh on generate is a plan/spec interaction defect — spec R2 ("resets the target consumer repo to a clean baseline, then writes the scenario's assets") is the binding authority and the wipe is its literal behavior; the plan's smoke sequence (setup → generate → detect via npm scripts) is what's wrong. Ruled: keep spec behavior; the operational fix is documented (re-run `npm run setup` after generating; scenarios render anywhere via --target so scaffolding loss only affects in-place rendering). Cost if wrong: minor UX friction, not data loss (scaffolding is 2 small files recreated by setup).
Task 9: complete (no commit — playground git-ignored per R7; work state 8fa043c, review clean); minors (deferred): setup.sh [ ! -d .git ] existence-only guard; generate deletes playground npm scripts (re-run setup after generate — ruled spec-intended); probe exit-status propagation (Task 7 scope).
Final review: verdict "With fixes" — 4 Important: (1) probe discards resolved binary path; (2) list missing R8 trust-gate column; (3) probe lacks R9 shell check + setup.sh warn-only; (4) flake cursorFhs dead binding.
Final review: Ruling: R9 shell check = warning banner (non-silent), not refuse/re-exec — spec's invariant is "unpinned harnesses are never SILENTLY observed"; the plan fixed warn for setup.sh, banner in probe extends the same to the observation entrypoint; refuse would contradict R9's own carve-out allowing host-truth detect runs and break dev workflow. Cost if wrong: a user ignoring the banner observes unpinned harnesses — visible, their choice.
Final review: Ruling: flake cursorFhs becomes Linux-conditional (buildFHSUserEnv cannot build on aarch64-darwin) — keeps the spec's "try FHS wrapper" decision record reachable on Linux while darwin is honestly detection-only. Cost if wrong: none on darwin.
Final review: fix wave (1 commit, 29eb3f3): probe binary threading + exit-status propagation, list TRUST GATE column (+test, TDD), probe R9 warnIfUnpinned banner, flake cursorFhs Linux-conditional spliced into buildInputs. 33 files/164 tests green; typecheck, build:tools, nix parse OK.
Final review re-review: all 4 findings ADDRESSED, no new breakage — branch record: a5e1710..29eb3f3.
Artifacts promoted into this folder per AGENTS.md (ledger, tasks/{n}-{slug}/ briefs+reports+review diffs); scratch workspace removed.
Task 10 (unplanned final-fix): artifacts promoted from transcripts + git (brief = fix-wave dispatch 2026-09-21-0247, report = 2026-09-21-0252, diffs 8fa043c-29eb3f3.review.diff (fix wave) + a5e1710-8fa043c.review.diff (whole-branch review)) — recovered post-cleanup; scratch report was not promoted before scratch removal.
