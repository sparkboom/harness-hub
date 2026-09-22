# SDD ledger — plan: deliverables/current/2026-09-21-2212-harness-version-management/plan-b-testbed-scenarios/plan-b-testbed-scenarios.plan.md

Branch: harness-version-mgmt-plan-b (user-directed: use current branch, no worktree)
Started: 2026-09-22

## Pre-flight scan

| Pair | Producer → Consumer | Finding | Ruling |
|---|---|---|---|
| T1→T2 | `Snapshot`/`FileEntry` (T1 schema) → snapshot.ts (T2) | T2's walk skips `.git` — intentional per plan; symlink target test expects relative `target-dir` from `readlinkSync` (matches `symlinkSync(join(root,'target-dir'), …)` since readlink returns the literal target string). Consistent. | none |
| T1→T3 | `Scenario`, `Predicate`, `ScenarioContext` → scenarios.ts | T3 imports `HarnessId` from `../../src/harnesses` as type-only; plan documents this as safe (erased at compile). Harness ids used: claude-code, codex, opencode, hermes, pi, deepseek, cursor-cli, cursor — must exist in src/harnesses union. | verify ids exist at dispatch |
| T3→T4 | `SCENARIO_SUITE` → runner.ts / runner.test.ts | runner.ts imports `writeAssets` from `../fs` — plan says reuse writeAssets/resetTarget from test/tools/fs.ts. setup.files with `kind:'symlink'` write into repoRoot only (home setup unused by suite). Consistent. | none |
| T4→T5 | `RunResult` shape {status,output,error?} → testbed executor returns {status,output} | testbed's DockerExecutor returns 2-field results; Runner.run returns RunResult (3-field). containerRunner adapts. Consistent. | none |
| T5→T6 | `buildImage`/`runHarness`/`DockerExecutor` → containerRunner | containerRunner calls buildImage with exec possibly undefined then runHarness with same. buildImage loads manifest — needs manifest entries for harness; test injects executor but loadManifest() still called at runtime for real harness ids. Test in T5 uses 'claude-code' via runHarness only (no buildImage) — runHarness does not load manifest. OK. | none |
| T4→T7 | `Runner` interface → runner-human | humanRunner takes injectable io; default stdinIO. Test injects io. Consistent. | none |
| T1→T8 | `ScenarioOutcome` → report.ts | LEVEL_RANK maps all five levels; unknown level → 4 (rubric rank) as fallback. Consistent. | none |
| T9 | manifest.ts extension → reconcile.ts | reconcile reads config/config.json directly via __dirname; manifest.loadManifest reads the same file — two read paths but same source of truth. recordReview writes JSON with 2-space indent + newline; must match existing config.json formatting to avoid churn. | implementer to confirm existing config.json shape (raw.harness.versions) before writing; plan text is verbatim authority |
| T5 | testbed.ts `main()` — session/matrix | Plan self-review says session/matrix are stubs of run with documented flag surface. main() in Step 3 implements only `run` + usage. Accepted per plan's own Self-Review ("session/matrix are stubs of run with the documented flag surface"). | none — plan-mandated |

Task 1: complete (commits ac31029..8d1cf02, review clean)
Task 2: complete (commits 8d1cf02..4e253ec, review clean)
Task 3: complete (commits 4e253ec..8132d6c, review clean)
Task 4: fix round 0 — review returned 1 Important finding (plan-mandated): runner.ts:58 `await runner.run(ctx)` has no try/catch; a throwing runner loses the outcome entirely. Ruling: amend the plan-verbatim code minimally — wrap the run call in try/catch → `result = { status: 'failed', output: '', error: String(e) }` and continue to snapshots/predicate, preserving brief behavior for non-throwing runners. Rationale: RunResult already defines 'failed' status for exactly this; the spec's purpose (capture failed-run evidence) outweighs verbatim fidelity, and the amendment costs nothing downstream. Cost if wrong: negligible — catch path only triggers on runner crashes the brief never contemplated.
Task 3: minor (deferred): SCENARIO_SUITE key↔id correspondence not compile-checked (Record<string, Scenario>) — candidate invariant test in runner task.
Task 3: minor (deferred): agentsdoc-load-canary fileInDelta regex unanchored (scenarios.ts:113).
Task 3: minor (deferred): missing trailing newline at EOF in scenarios.ts/.test.ts.
Task 3: minor (deferred): skill-wiring prompt:'' — runner tasks must special-case empty prompts; add one-line comment when runner consumes it.
Task 2: minor (deferred): snapshot() catch too broad — mid-walk fs errors yield silently truncated snapshots (snapshot.ts:33-35); consider ENOENT-only narrowing.
Task 2: minor (deferred): trailing-slash root path slicing edge (snapshot.ts:10); `relative(base, full)` would be robust.
Task 2: minor (deferred): untested diffFiles changed-entry branch + empty-snapshot-on-missing-root path.
Task 2: minor (deferred): FileEntry.target mixed semantics (root-relative normalized vs link-dir-relative raw) — document in schema when convenient.
Ruling (Task 4): brief's symlink test self-inconsistency analog — none; see Task 4 fix ruling above.
Task 4: fix round 1/5 (1 addressed, 0 open — throwing-runner rejection; commits 7c35fe1..3355572)
Task 4: complete (commits 8132d6c..3355572, review clean after 1 fix round)
Task 4: minor (deferred): runner.ts symlink setup branch is dead code today (no scenario uses kind:'symlink'); missing symlinkTarget throws cryptic EINVAL — guard with clear message or add a symlink-setup test before Task 6/7 exercise it.
Ruling (Task 5): HEADLESS_COMMANDS['cursor'] (cmd 'agent', args ['-p', p]) mirrors nothing in PROBE_COMMANDS (probe's 'cursor' entry — the standalone agent CLI with --mode ask --trust --workspace — is mirrored by testbed's 'cursor-cli' instead). Plan text (verbatim brief map) conflicts with the Global Constraint ("mirrors PROBE_COMMANDS' shapes"). Resolved: keep the verbatim cursor entry, document the intentional departure in-code; cursor is human-only and never dispatched by the container runner, so runtime impact is nil. Cost if wrong: someone dispatches the container runner for the IDE harness — guarded by harnessCompat (cursor absent from container scenarios) and Task 6's runner wiring.
Task 5: fix round 1/5 (1 addressed, 0 open — cursor mirroring departure documented; commits 3045784..f7f2c24)
Task 5: complete (commits 3355572..f7f2c24, review clean after 1 fix round)
Task 5: minor (deferred): dockerfileFor npm branch with pkg undefined renders `npm install -g undefined@<version>` — no guard/test for npm entry missing package.
Task 5: minor (deferred): main() version parsed from rest[0] breaks if flags precede version; rest[indexOf('--prompt')+1] can be undefined when flag is last.
Task 6: complete (commits f7f2c24..cc1499e, review clean)
Task 6: minor (deferred): containerRunner.test.ts covers happy path only — build-failure, run-failure, and catch branches untested.
Task 6: minor (deferred): hh-testbed-* temp dirs never cleaned up on any path (brief-inherent; `finally` cleanup would fix).
Task 7: fix round 1/5 (1 addressed, 0 open — test now asserts the human ack is awaited; commits dc0a18a..a1f07f1)
Task 7: complete (commits cc1499e..a1f07f1, review clean after 1 fix round)
Ruling (Task 7): brief's `import { readline } from 'node:readline'` invalid (no such export) — corrected to `import { createInterface }`; plus Task-4 never-throw try/catch amendment applied as pre-approved. Cost if wrong: none beyond style; behavior verified by injected-io test.
Task 8: complete (commits a1f07f1..c0b686b, review clean)
Task 8: minor (deferred): empty/empty-evidence outcomes → confidence 'low' via threshold fallthrough (safe but implicit; comment when Plan C revisits).
Rulings (Task 9, from review findings — all plan-mandated brief defects):
Ruling (Task 9a): recordReview crashes on empty `ranges` array (`entry.ranges[length-1].profile` → TypeError). Ruled: FIX — guard with a clear `reconcile:`-prefixed error. The spec's intent (sole mutation path, legible errors) outweighs verbatim fidelity; a fresh entry without ranges is a plausible first-use state. Cost if wrong: none — an entry with no ranges can't produce a meaningful profile anyway.
Ruling (Task 9b): npm failure (spawn error/timeout) silently reads as latest=null → covered=true → drift gate exits 0 (silent green). Ruled: FIX — distinguish spawn failure from empty result: on r.error or non-zero exit, throw/propagate a failure (resolver returns null only for genuinely missing package). The --check gate's core purpose is detecting drift; silent green on infrastructure failure defeats R3. Cost if wrong: offline users see failures instead of a clean pass — acceptable, documented.
Ruling (Task 9c): config.json formatting churn (~130-line diff per write). Ruled: KEEP VERBATIM (defers to a follow-up normalization; the plan says reconcile is the sole mutation path and Plan C/D builds on the shape). Cost if wrong: noisy diffs on future --record runs — visible and reversible.
Task 9: fix round 1/5 (2 addressed, 0 open — empty-ranges guard + loud upstream errors; commits 8489bc5..572fc0b)
Task 9: complete (commits c0b686b..572fc0b, review clean after 1 fix round)
Task 9: minor (deferred): config.json formatting churn on --record writes (~130-line diff per write; JSON.stringify(raw,null,2)) — ruled KEEP VERBATIM; candidate follow-up normalization commit.
Task 9: minor (deferred): sort comparator `(a,b)=>a.min<b.min?-1:1` unstable for equal mins (brief-verbatim).
Task 9: minor (deferred): no automated tests for recordReview/npmUpstream missing-package branch (config writes and network excluded by constraint; covered by manual smokes).
## Final review (whole-branch ac31029..3dc7724) — verdict: With fixes

Ruling (Final-I1, from Task 2/4 deferred minors): symlink setup guard + test — FIX before merge. runner.ts symlinkSync(f.symlinkTarget ?? '') throws cryptic EINVAL; no symlink round-trip test exists; FileEntry.target semantics undocumented. Cost if wrong: first symlink-scenario consumer hits it blind.
Ruling (Final-I2, skill-wiring tautology): PARKED — reviewer's critique is contestable against scenarios.md:94-110, which defines S3a as "no model invocation at all... validates harness-hub's own output rather than the harness's behavior". In Plan B's framework the setup step represents harness-hub's wiring output; predicate-true-on-setup is the intended deterministic smoke semantics, not a defect. The claudeOk symlink branch being dead code today is accepted (no symlink setup is exercised yet; I1's test will exercise the machinery). Empty-prompt dispatch (prompt:'' → `claude -p ""`) IS a real hazard — folded into the fix wave as a containerRunner guard (skip dispatch when prompt is empty; deterministic scenario). Cost if wrong: if Plan C expects S3a to verify live wiring performed during the run, it will need a predicate revision — recorded here for Plan C.
Ruling (Final-I3, hermes trust-gate): PARTIAL — reviewer's mismatch 1 REJECTED: `-v ${homeDir}:/root` maps container /root onto the host homeDir, so hermes writes inside the container DO surface in ctx.home snapshot; the reviewer missed the bind-mount. Mismatch 2 ACCEPTED: a containerized hermes records the mount path '/repo', not the host repoRoot, so the predicate's `cfg.content.includes(ctx.repoRoot)` fails in container mode even on correct behavior. FIX: predicate accepts either ctx.repoRoot (human mode) or '/repo' (container mode). Cost if wrong: predicate could pass on a ledger that trusts /repo but not the real repo — acceptable for a behavioral-level scenario whose verdict feeds a human report.
Ruling (Final-I4, checkLatest test coupled to live config.json): FIX before merge — pass explicit entries in the drift test; live-config coupling makes the unit test red on unrelated config edits. Cost if wrong: none.
Task 11 (unplanned final-review fix wave): fixes I1 (symlink setup guard + round-trip test + FileEntry.target doc), I3-partial (trust-gate predicate accepts /repo container mount), I4 (hermetic reconcile drift test), plus folded empty-prompt dispatch guard from parked I2; commit 75d4ff2; re-review: ALL ADDRESSED, no new breakage.
Final review: clean after 1 fix wave (commits 3dc7724..75d4ff2). Ready to merge per reviewer's assessment.
Final review: minor (deferred): trailing newlines across ~12 files — one sweep commit candidate.
Final review: minor (deferred): dockerfileFor npm-branch pkg guard (testbed.ts) — one-line throw at buildImage.
Final review: minor (deferred): main() flag-aware arg parsing (version/position parsing edges).
Final review: minor (deferred): reconcile bare RangeError on non-comparable min (wrap with reconcile: prefix to match tool error style).
Final review: minor (deferred): snapshot() broad catch compounds quiet predicates (M6) — narrow to ENOENT when convenient.
Final review: minor (deferred): hh-testbed-* temp dir cleanup via finally when matrix runner lands.
Final review: note (plan-text): Self-Review's "session/matrix are stubs of run" overstates — main() implements only `run`; session/matrix fall through to usage. Recorded here so the record is accurate; plan text left as-is (ledger + this note are the correction).
Note: Task 10 had no dedicated task-reviewer dispatch (verification-only task, sentinel --allow-empty commit; its scope was fully covered by the final whole-branch review).

Task 1: complete (commits ac31029..8d1cf02, review clean)
Ruling: `import type { HarnessId } from '../../src/harnesses'` (brief-verbatim) breaks `npm run build:tools` — tools tsconfig rootDir pulls imported files into the program regardless of `import type` (TS6059). Applied the plan's pre-authorized alternative: local HarnessId union in schema.ts + drift-guard test vs ALL_HARNESS_IDS. Carries forward: Tasks 3 & 4 must import HarnessId from `./schema` (not from src) — same reasoning applies to their verbatim code. Cost if wrong: drift between two unions — mitigated by the runtime drift-guard test.
