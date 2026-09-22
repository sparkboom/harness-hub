# Task 9 Report: playground folder + scripts + setup (R6, R9)

## What I did

1. Created `playground/package.json` verbatim from the brief (scripts: setup, generate, scenario, detect, probe, reset, shell).
2. Created `playground/setup.sh` verbatim from the brief (nested-git init, `npm link` guard for the CLI, R9 IN_NIX_SHELL warning) and made it executable (`chmod +x`).
3. Verified `.gitignore` already contains `playground/` (line 4, pre-existing from Task 1) — no modification needed.
4. Ran the smoke sequence (`npm run build:tools`, then setup → generate → doctor → detect, plus probe), diagnosed and worked through two environment findings (below), and verified R7 (nothing under playground/ tracked) and the full test suite.

## Files created (all untracked, git-ignored per R7)

- `playground/package.json` — created on disk, untracked.
- `playground/setup.sh` — created on disk, executable (`-rwxr-xr-x`), untracked.
- `playground/.git/` — nested consumer repo, created by `setup.sh` at run time.
- `playground/AGENTS.md`, `playground/.agents/skills/writing-tests/SKILL.md` — written by the smoke `generate baseline` run.

## Verification commands run + output summary

| Command | Result |
|---|---|
| `npm run build:tools` | exit 0, tools compiled to `tools/dist/` |
| `npm run setup` (in playground/) | exit 0; final clean run printed "initialized nested git repo", CLI path, R9 warning, ready line |
| `git -C playground rev-parse --show-toplevel` | `/Users/matt/Repos/ai/harness-hub/playground` — nested repo resolves to itself (spec §6 `findRepoRoot` contract) |
| `npm run generate -- baseline` | exit 0, "generated \"baseline\" into …/playground"; produced `AGENTS.md` + `.agents/skills/writing-tests/SKILL.md` exactly as the brief expects |
| `harness-hub doctor` (in playground/) | exit 0, "harness-hub doctor: no issues found." — resolves playground as its own repo, no issues for baseline (run again after restore, same result) |
| `npm run detect` | exit 0, full 7-harness table (claude-code, codex, cursor, deepseek, hermes, opencode, pi) with pin vs installed columns — matches brief expectation |
| `npm run probe -- hermes` | exit 0, spawned the real hermes binary (see note 3) |
| `npm run probe -- cursor` | exit 1, "spawnSync agent ENOTDIR" — consistent with R9 unpinned-host caveat (provisional cursor invocation is not expected to work on the host) |
| `git status --short` (outer repo) | **no playground/ entries**; only pre-existing docs/ moves present before this task started |
| `git check-ignore -v playground/package.json playground/setup.sh playground/AGENTS.md playground/.git` | all four matched by `.gitignore:4:playground/` |
| `git status --short --untracked-files=all -- playground/` | empty — R7 proven even with untracked-files=all |
| `git log --oneline -1` / `git rev-parse HEAD` | `8fa043c feat: add nix devShell pinning harness versions` — Tasks 1–8 all committed, no new commit created (Step 5 conclusion honored) |
| `npx vitest run` | **33 files / 163 tests, all passed**, 970ms |

## Decisions / deviations

1. **Broken nested `.git` from a sandboxed first run — removed and recreated.** The first `npm run setup` ran inside the tool sandbox, which killed `git init` after it had written only `description` and `info/` ("Operation not permitted" on `.git/hooks/`). Setup's `[ ! -d .git ]` guard then saw the partial `.git` and skipped re-init, and `git rev-parse` walked up to the outer repo. Fix: deleted the partial `playground/.git`, re-ran setup outside the sandbox; `git init` then completed ("initialized nested git repo") and the nested repo resolves to itself. This was environment-induced, not a script bug; the shipped `setup.sh` is correct but **will silently keep a corrupt partial `.git` if `git init` dies mid-run** (guard is `[ ! -d .git ]` — noted as a concern, not changed: the brief's script is verbatim-binding).

2. **`npm link` branch not exercised — global CLI was already linked to this repo.** `command -v harness-hub` found `/Users/matt/.npm-packages/bin/harness-hub`, a symlink → `../lib/node_modules/harness-hub` → `/Users/matt/Repos/ai/harness-hub` (created Sep 20 22:04, before this task — likely from earlier MVP work). The setup script's guard correctly skipped `npm link`, and the smoke used that global shim, which execs `dist/bin.js` from this working tree. Per the controller ruling I did not force global npm state; the live `harness-hub doctor` / `harness-hub` invocations above are the CLI-equivalent smoke (same `src/cli.ts` → `dist/bin.js` entry the `npm link` shim would provide). A fresh-machine `npm link` path itself remains unsmoked (no clean environment available here).

3. **Generator wipes playground scaffolding — spec-intended, restored afterwards.** `npm run generate -- baseline` calls `resetTarget`, which deletes everything under the target except `.git` — including `playground/package.json` and `setup.sh` (that is why the brief's smoke order puts `detect` before nothing — it just deletes the npm scripts mid-sequence, so `npm run detect` initially failed with "Missing script"). The spec (line 172–174: "rendering a scenario resets the target consumer repo to a clean baseline … never touches files outside the target") makes this intended behavior. I restored `package.json` + `setup.sh` byte-identical, re-ran `npm run setup` to prove idempotence (no re-init, exit 0), and completed `detect`/`doctor` on the restored state. **Practical implication for users: after `npm run generate`, re-run `npm run setup` before using the npm-script entrypoints.** The doctor/detect smoke used the node `../tools/*.mjs` path and global CLI, unaffected.

4. **Test-count expectation: 33 files / 163 tests, not 32 / 160.** The controller constraint said "32 files/160 tests"; actual inventory is 29 `src/*.test.ts` + 4 `tools/*.test.ts` = 33 files, 163 tests, all green. Tasks 4–8 added tools tests after the expectation was written; everything passes and no non-task-9 sources were touched, so this is reported as a discrepancy in the expectation, not a failure.

## Concerns

1. **Setup's idempotence guard can mask a corrupt partial `.git`** (see decision 1): `[ ! -d .git ]` checks existence, not validity. Low severity (only hits if `git init` is killed mid-run), and the script text is fixed by the brief — flagging for the controller in case a follow-up wants `git -C . rev-parse >/dev/null 2>&1` as the guard.
2. **Post-generate UX**: `generate` deletes the playground's own npm scripts; users must re-run `npm run setup` after generating (spec-consistent reset semantics, but worth documenting in the playground's eventual README).
3. **Probe exit-code fidelity** (pre-existing from Task 7, observed here): `defaultRunner` ignores `r.status`, so `probe hermes` exits 0 even though hermes itself rejected its provisional `run` subcommand. The R4-drift point stands; exit-code propagation would need a Task 7 follow-up. Not in this task's scope.
4. **Provisional invocations confirmed as drifted on host**: hermes has no `run` subcommand; cursor's headless `agent` fails with `ENOTDIR` outside the pinned shell. Both match the spec's provisional framing for hermes/pi/deepseek probe invocations and the R9 warning — no action for this task.

## Status summary

All 9 tasks' work is committed (HEAD `8fa043c`, Task 8); Task 9's deliverables (`playground/package.json`, `playground/setup.sh`) exist on disk as git-ignored untracked content exactly per R6/R7 — no commit was created, which is the brief's Step 5 conclusion. Smoke loop green: build:tools → setup (nested git + CLI + R9 warning) → generate baseline → doctor (no issues) → detect (7-harness table). Full suite: 33 files / 163 tests passed.
