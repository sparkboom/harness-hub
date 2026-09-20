# SDD ledger — plan: /Users/matt/Repos/ai/harness-hub/docs/current/2026-09-20-0021-harness-hub-mvp/harness-hub-mvp.plan.md

Repo: /Users/matt/Repos/ai/harness-hub — branch `initial-harness-hub` (working in place, user-approved)
BASE at start: 4a381bf (4a381bfdcf63aabf66f8366562e6f969913ea907)
Spec: docs/current/2026-09-20-0021-harness-hub-mvp/harness-hub-mvp.spec.md (read — binding authority)
Insight note: harness-doctor-architecture.insight.md (read — architecture guidance)

## Pre-flight conflict scan

Pairs sharing files/interfaces (producer → consumer), findings:

| Pair | Producer → consumer | Finding |
|---|---|---|
| T1→T23 | `getPackageVersion` → CLI `--version` | OK. `__dirname`-based path resolves correctly in both vitest (src/) and compiled dist/ (rootDir=src, outDir=dist). Watch: if vitest lacks `__dirname` shims, adapt while keeping export + behavior; note in report. |
| T2→T23 | `findRepoRoot` → all CLI commands | OK — walk-up to nearest `.git` (dir or file). |
| T3→T4,5,12,14,15,16 | `HarnessId`, `ALL_HARNESS_IDS`, `isHarnessId` | OK — no ordering constraint anywhere (T4 filters, order-independent). |
| T4→T12,14,15,16,19,20,21,22 | `HarnessEntry` registry | OK — single data source; tests pin claude-code as only symlink/migrate-symlink, hermes only trust-gate. |
| T5→T9,10,17,20,22 | `ConfigLoadResult`, `loadConfig`/`saveConfig` | OK — discriminated union (`ok`/`absent`/…); T20 only saves on success; T22 writes only on actual removal. |
| T6→T7,10,11,12,13,16,19 | canon functions | OK — `skillsRootDir`/`AGENTS_MD_FILENAME`/`readSkillFrontmatter` consumed as produced. |
| T7→T11 | `validateSkillFrontmatter`, `FrontmatterIssue` | OK. |
| T8→T12,13,16,19 | fs primitives | OK — `isSymlinkTo` compares raw link text to `relativeSymlinkTarget` output consistently (incl. nested `../.agents/skills`). |
| T9→T10–16,17,18,20 | `DoctorRule`/`runDoctor`/`findingsForHarness` | OK — T20 intentionally filters `f.harnessId === id` (strict) instead of `findingsForHarness` because canon-wide errors already aborted earlier; warnings don't block; consistent. |
| T10–T16 → T17 | rule registration | OK — ids: canon-presence, config-validity, skill-shape, skill-frontmatter, clobber-risk, skill-migration, trust-gate, generated-file-drift (verified against each rule's `id:` field). Note (cosmetic, not a conflict): `skill-migration` rule emits findings with ruleId `unmigrated-skills`/`skill-migration-collision` — matches T20 test expectations. |
| T13→T14,21 | `planSkillMigration` classifications | OK — same 'new'/'identical'/'collision' vocabulary both consumers. |
| T17→T18,20 | `buildDoctorContext`, `ALL_DOCTOR_RULES` | OK — `homeDir` plumb-through verified (T20 hermes tests). |
| T18→T23 | `runDoctorCommand` | OK — T18 test `output.toContain('AGENTS.md')` depends on T10 canon-presence message wording; both briefs carry the exact implementation. |
| T19→T20 | `wireMigrateSymlinkHarness` | OK — T19 assumes preconditions enforced upstream; T20 enforces them. |
| T20/21/22→T23 | command results | OK — result shapes and exit codes align with CLI wiring. |

Self-consistency rows:

| Task | Check | Finding |
|---|---|---|
| T1 | tsconfig excludes *.test.ts; vitest includes src/**/*.test.ts; bin→dist/bin.js matches T23's src/bin.ts | OK |
| T3 | tests vs code | OK (7 ids: claude-code, cursor, opencode, codex, hermes, pi, deepseek) |
| T5 | both-files/one-file/absent states vs spec §4 | OK — YAML default, JSON preserved if pre-existing |
| T9 | runner tests vs types | OK |
| T14 | applicability (configured∪pending) — plan-scoped choice, consistent with insight note's applicability predicate; spec doesn't forbid | OK |
| T15 | warning-on-unparseable vs spec §6 downgrade rule | OK |
| T20 | Resolved Ambiguities #1/#2 implemented (global abort / per-harness skip; all errors block; only clobber forceable) | OK |
| T22 | removeIfSymlink never deletes real dirs (spec: disable never touches canon) | OK |
| T23 | exitOverride + thrown parse errors → exit 1; help/version → 0; matches tests | OK |

Scan verdict: no conflicts. No plan-mandated rubric violations found (all tests assert real behavior).

## Model selection policy (user directive: "consider using z-ai/glm-5.3-flash")

- Available subagent slugs: `inherit` (= this session's z-ai/glm-5.3-flash) and `composer-2.5-fast`.
- Plan text contains complete code for every task → implementers = `composer-2.5-fast` (transcription + TDD).
- Task reviewers + final whole-branch review = `inherit` (glm-5.3-flash) — mid/high floor per skill.
- Fix rounds 4–5 escalation = `inherit`.

## Progress

Task 1: fix round 1/5 (2 addressed, 0 open; commits ce5e63c..a8cb808)
Task 1: Ruling: engines floor — plan Global Constraint says "Node.js ≥ 18" but plan-pinned commander@15 requires >=22.12.0 and vitest@5 requires ^22.12+ (verified in package-lock). Dep pins are the operative requirement; raised engines.node to ">=22.12.0", pins unchanged. Cost if wrong: declared floor is higher than intended (blocks older installs that the prose would have allowed) — visible at npm install, easily reverted.
Task 1: complete (commits 4a381bf..a8cb808, review clean after 1 fix round)
Task 2: complete (commits a8cb808..9d3284a, review clean)
Task 2: ⚠️ carried: "agrees with Hermes's own .git-ancestor resolution" — unverifiable here (Hermes source not in workspace); verify behaviorally at Task 15 (trust check) via its tests.
Task 2: minor (deferred): nonexistent start dir silently resolves to ancestor; symlinked start dir diverges from git realpath; EACCES swallowed during walk; relative startDir yields relative result — plan-mandated verbatim, revisit only if callers pass unvetted input (Task 23 passes process.cwd()).
Task 3: complete (commits 9d3284a..89064fb, review clean)
Task 3: minor (deferred): negative-test coverage thin (only one rejection string; 'PI'/'claude'/whitespace near-misses unexercised); "accepts every id" test feeds guard its own array (brief-verbatim).
Task 4: fix round 1/5 (1 addressed, 0 open; commits 73036c8..0151a84)
Task 4: Ruling: plan-mandated test gap — the plan's verbatim registry tests omit assertions pinning agentsDoc.symlinkPath='CLAUDE.md' / skills.symlinkPath='.claude/skills'. Spec §5/§6 name these exact paths, so adding the assertion test-only aligns the code with the spec; implementation data untouched. Cost if wrong: none — tests only constrain future edits.
Task 4: complete (commits 89064fb..0151a84, review clean after 1 fix round)
Task 4: minor (deferred): symlinkPath? optional rather than discriminated union — illegal {mode:'native',symlinkPath} state representable (plan-chosen shape; consumers branch on mode); report line-count nits.
Task 5: complete (commits 0151a84..bc29f0f, review clean)
Task 5: minor (deferred): extra top-level config keys tolerated (spec says harnesses is "the only key" — doctor rule doesn't flag); JSON parse-error + non-string/missing-key branches untested; duplicate ids pass through undeduped; readFileSync race can throw out of loadConfig; saveConfig into ambiguous both-files state writes YAML.
Task 6: fix round 1/5 (1 addressed, 0 open; commits a488f56..6a4cdbd)
Task 6: Ruling: malformed frontmatter crash — plan's verbatim readSkillFrontmatter let matter() throw on invalid YAML; spec §9 requires doctor to report skill-frontmatter problems as findings, so ruled the degraded shape { hasSkillMd: true, frontmatter: undefined } (Task 11's rule turns that into the missing-name/description error). Cost if wrong: a corrupted SKILL.md is reported as missing name/description rather than "unparseable frontmatter" — same blocking severity, slightly less precise message.
Task 6: complete (commits bc29f0f..6a4cdbd, review clean after 1 fix round)
Task 6: minor (deferred): hasAgentsMd true for a directory named AGENTS.md; .agents/skills as regular file → ENOTDIR throw from list fns; symlinked skill dirs classified as non-dir entries; readSkillFrontmatter does not validate name (callers must validate user-supplied names — none do yet; Task 23 passes only validated ids).
Task 7: complete (commits 6a4cdbd..8b0f22a, review clean)
Task 7: minor (deferred): name regex `$` accepts trailing newline (mitigated by name===dirName check unless dirName also carries one — dirNames come from the filesystem via listSkillDirNames, not user input); undefined-frontmatter path + boundary lengths untested (brief-verbatim test set); huge name values interpolate into messages.
Task 8: fix round 1/5 (1 addressed, 0 open; commits e10fe45..333ff60)
Task 8: Ruling: isSymlinkTo dangling-target semantics — brief's verbatim existsSync guard failed the brief's own dangling-link test; ruled the test defines the contract (a dangling link storing the expected target counts as ours; spec §10 ownership is stored-target equality). Accepted implementer's lstatSync+try/catch fix. Cost if wrong: a dangling generated link would be classified foreign → enable would clobber it instead of reporting drift — the stricter/behavior-tested reading is safer.
Task 8: Ruling: dirsByteIdentical symlink handling — brief's verbatim code read through symlinks (symlink-vs-file → wrongly identical; dangling → throw). Spec §6/§10 require kind-aware comparison; ruled lstat-first: kind mismatch false, symlink vs non-symlink false, symlink pair compares stored targets exactly, regular files Buffer.equals. Cost if wrong: migrate could classify a symlinked "skill" as adoptable content — now structurally impossible.
Task 8: complete (commits 8b0f22a..333ff60, review clean after 1 fix round)
Task 8: minor (deferred): copyDirRecursive throws EEXIST when destination entry exists (non-idempotent over-wire re-copy — migrate command only copies 'new' entries, so unreachable in practice); brief Step 4 miscounts (12 vs 13 tests); `let stat` evolving-any nit.
Task 9: complete (commits 333ff60..3e763cb, review clean)
Task 9: minor (deferred): findingsForHarness param typed string not HarnessId (typo'd id filters to canon-wide-only instead of erroring — brief-verbatim); empty-list/rule-order edges untested.
Task 10: complete (commits 3e763cb..fb6668c, review clean)
Task 10: minor (deferred): canon-presence test doesn't pin message text (Task 18's output test covers "AGENTS.md" downstream); config-validity tests don't assert ruleId/forceable; report lacked typecheck evidence (covered by npm run typecheck in other tasks).
Task 11: complete (commits fb6668c..d25c6fa, review clean)
Task 11: minor (deferred): malformed-YAML → missing-name/missing-description flow untested (verified by code reading only); multi-issue/multi-skill aggregation paths untested (brief-verbatim scope).
Task 12: Ruling: clobber-risk dangling-foreign-link semantics — brief's verbatim existsSync gate failed the brief's own dangling-foreign-symlink test; ruled (consistent with Task 8's stored-target ownership) that lstat-based pathPresent is correct: dangling link storing expected target = ours (no finding), dangling foreign link = clobber risk (finding). Cost if wrong: none observed — both semantics are the test-defined contract.
Task 12: complete (commits d25c6fa..c10f052, review clean)
Task 12: minor (deferred): unguarded second lstat in skills branch (ENOENT race if entry vanishes between checks); regular file at .claude/skills is owned by no rule (spec §8 enumerates only symlink-pointing-elsewhere — spec-enumeration gap, not code defect).
Task 13: complete (commits c10f052..3293062, review clean)
Task 13: minor (deferred): symlinked top-level entries under harness skills dir are filtered (never classified) per "only real directories" constraint; .claude/skills as symlink-to-file would throw ENOTDIR from readdirSync; symlink-vs-real branch of dirsByteIdentical untested through classifier.
Task 14: complete (commits 3293062..327b379, review clean)
Task 14: minor (deferred): collision test omits harnessId assertion (assertion asymmetry, brief-verbatim); applies/check relevance-predicate duplication; no multi-skill/multi-finding aggregation test (brief-mandated scope).
Task 15: complete (commits 327b379..4cfb564, review clean)
Task 15: minor (deferred): ruleId 'hermes-trust' is a literal not registry data (second trust-gated harness would be mislabeled — future-facing; spec pins the literal); read-phase EACCES/EISDIR labeled "failed to parse" (severity-safe, brief-verbatim); disclosed npm/vite noise in report evidence.
Task 16: complete (commits 4cfb564..0730fca, review clean)
Task 16: minor (deferred): warning test doesn't pin message strings (brief-mandated scope); pre-existing vitest/npm config noise in run output (disclosed).
Task 17: complete (commits 0730fca..f888c76, review clean)
Task 17: minor (deferred): degraded-config branch untested at context level (brief-verbatim; covered indirectly by config-validity rule suite); homeDir default only sanity-checked (toBeTruthy).
Task 18: complete (commits f888c76..95b4334, review clean)
Task 18: minor (deferred): formatFindings non-empty path only exercised indirectly (no direct unit test — brief-mandated 2-test set); pre-existing vitest/npm noise (disclosed).
Task 19: Ruling: ensureSymlink dangling-link idempotency — brief's verbatim existsSync checks failed the brief's own idempotency test (existsSync follows links; dangling-but-correct .claude/skills read as absent → re-symlink → EEXIST). Consistent with Task 8/12 rulings: stored-target equality via lstat defines ownership; accepted implementer's lstat pathPresent fix (implementation only, tests untouched, mirrors clobberRisk.ts). Cost if wrong: none observed — the stricter/behavior-tested reading is safer. Note: plan doc itself contains the bug (plan lines ~2950–2985); flagged for archive-note awareness, plan text not edited.
Task 19: complete (commits 95b4334..d432838, review clean after 1 ruled deviation)
Task 19: minor (deferred): pathPresent doc comment slightly imprecise; multi-link wiring non-atomic (skills link before agentsDoc link); pre-existing vitest/npm noise (disclosed).
Task 20: Deviations ruled: 3 test-fixture fixes (impl + assertions untouched) — (1) canon-side SKILL.md fixtures given valid frontmatter so canon-wide skill-frontmatter rule doesn't mask harness-scoped semantics (test 6 necessarily changed both sides for byte-identical classification; report misdescribes as canon-side only — cosmetic); (2) hermes untrusted test seeds definitive untrusted config — missing config.yaml is a warning per spec §6/trust-gate rule, so missing-config → warn-and-enable is spec-correct behavior (flagged for final review).
Task 20: complete (commits d432838..a21c754, review clean after ruled fixture deviations)
Task 20: minor (deferred): --force bypasses ALL forceable errors (only clobber-risk today — vacuously correct); global abort reports already-enabled as 'blocked' (spec §9 wording); saveConfig runs after interleaved wiring (no transactionality if wiring throws mid-loop); duplicate loadConfig (enable + buildDoctorContext).
Task 21: complete (commits a21c754..bfcebdf, review clean)
Task 21: minor (deferred): non-migrate-symlink harness → exit 1 with "nothing to do" message (mixed signal, plan-mandated string); copy loop not atomic against mid-loop I/O failure (collision-atomic only, as specified); no-op test doesn't assert second exitCode.
Task 22: complete (commits bfcebdf..a499de1, review clean)
Task 22: minor (deferred): dangling symlink survives disable (existsSync follows links — established precedent, self-healing on re-enable, plan-mandated); unknown harness id would throw TypeError (unreachable from CLI — Task 23 gates via isHarnessId); no-op still prints "disabled." message (plan-mandated UX).
Task 23: complete (commits a499de1..3e24cb4, review clean; smoke test independently replicated by reviewer)
Task 23: minor (deferred): no --help/--version/--force/blocked-formatting tests (beyond brief's 6); process.exit before stdout drain in bin.ts (tiny outputs, brief-verbatim); non-Error throwables exit 1 silently; findRepoRoot(process.cwd()) repeated in 4 actions (preAction hook candidate).

## All 23 plan tasks complete — final whole-branch review follows

Final whole-branch review (4a381bf..3e24cb4): NEEDS FIXES — 2 Important cross-task findings (verified by reviewer: 132/132 tests, typecheck+build clean, 5 live CLI probes).
Final review Finding 1 (Important): migrate adopts unvalidated content into canon — spec §6 requires validate-first (SKILL.md present + parseable + valid) with clobber-risk error; plan Task 21 omitted it (plan↔spec gap). Live probe: junk dir adopted, then canon-wide skill-shape error blocks all future enables.
Final review Finding 2 (Important): generated-file-drift remediation is a no-op — doctor says "re-run enable" but already-enabled short-circuit (enable.ts) makes it a no-op even with --force; violates spec §1 diagnosable→remediate + §8 "re-running refreshes the wiring". Only repair path today: disable→enable.
Final review Ruling (Fix 1): implement spec §6 validate-first in migrateHarness — validate every 'new' entry (readSkillFrontmatter + validateSkillFrontmatter via existing Task 6/7 modules) BEFORE the copy loop; invalid → error exit 1, atomic (nothing copied), message names clobber-risk. Update 'new'-skill fixtures to valid frontmatter (Task 20 fixture precedent). TDD: regression tests first.
Final review Ruling (Fix 2): implement spec §8 refresh semantics in enable's already-enabled path — re-wire (wireMigrateSymlinkHarness, idempotent) when generated-file-drift findings exist for that id AND blocking errors are empty (guard preserves foreign-file safety without --force; --force bypasses forceable clobber-risk per Resolved Ambiguity). Status stays 'already-enabled', config untouched. TDD: regression tests first (repair, foreign-file-preserved-no-force, foreign-file-replaced-with-force).
Final review minors (deferred): CLI migrate singular vs spec §8 variadic (plan-conformant; spec-plan reconciliation note for archive); hermes enabled-then-config-deleted → warning-only in doctor (spec-conformant seam); hasBlockingErrors/findingsForHarness production-dead (enable re-implements filtering); copyDirRecursive non-idempotent EEXIST (unreachable today); findRepoRoot repeated in 4 CLI actions (preAction candidate); .gitignore line-exact matching; plan Task 19 existsSync bug still verbatim in plan text (archive-note).
Final fix round: commits 2a189a4 (migrate validate-first, spec §6) + b7fd939 (enable drift-refresh, spec §8). Both verified by reviewer: SHIP IT — 26 files/138 tests, typecheck clean, no regressions. Intended behavior change: re-enable of already-enabled harness with foreign CLAUDE.md now blocks without --force (closes drift-era gap). FIX-ROUND CORRECTION: implementer's report claimed a private-reader precedent in skillMigrationPlan.ts — false (no such reader there); readHarnessSkillFrontmatter (migrate.ts:21-30) is the FIRST duplication of canon's reader (canon.ts:40-54), semantics byte-identical today. Follow-up: extract shared readSkillFrontmatterAt(skillMdPath) before a third consumer appears. Minor: refusal message conflates missing-file vs malformed-frontmatter.
