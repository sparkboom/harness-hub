# Task 10 Report: Full verification + build

- **Branch:** `harness-version-mgmt-plan-b` (starting HEAD `572fc0b`)
- **Date:** 2026-09-23
- **Result:** all 4 gates PASS → **DONE**
- **Commit:** `3dc7724` — `test: verify testbed + scenario framework end-to-end` (sentinel `--allow-empty`; tree was already clean, `test/tools/dist/` is git-ignored by design)

## Gate 1 — Full test suite — PASS

Command: `npm test` (from repo root)

Actual output:
```
Test Files  48 passed (48)
     Tests  236 passed (236)
```
Vitest exit code 0. All suites pass, including Plan A's.

## Gate 2 — Typecheck and build tools — PASS

Command: `npm run typecheck && npm run build:tools`

Actual output: both `tsc` invocations completed silently with exit code 0 (no diagnostics emitted).

Artifact check (`ls test/tools/dist/`):
- `dist/verify/` → `schema.js`, `snapshot.js`, `scenarios.js`, `runner.js`, `containerRunner.js`, `runner-human.js` ✓
- `dist/` root → `testbed.js`, `reconcile.js`, `report.js` ✓ (plus pre-existing `detect.js`, `env.js`, `fs.js`, `generate.js`, `manifest.js`, `primitives.js`, `probe.js`, `scenarios/`)

## Gate 3 — Smoke-test the shims — PASS

### 3a. `node test/tools/reconcile.mjs --check` (from repo root)

Actual output:
```
ID              LATEST        COVERED
claude-code     2.1.280       yes
codex           0.156.0       NO
cursor          ?             yes
cursor-cli      ?             yes
deepseek        0.1.5-rc.2    yes
hermes          0.21.4        yes
opencode        1.18.32       yes
pi              0.73.1        yes
```

Exit code: **1**.

Interpretation: the shim loaded the built dist and the drift gate behaved exactly as specified — `codex` has an upstream `LATEST` (0.156.0) reachable via the registry but no covered snapshot, so `COVERED = NO` → exit 1 = "drift". The `?` rows (`cursor`, `cursor-cli`) are the documented network-dependent unresolved-probe case. Exit 2 (upstream failure) did **not** occur — upstream metadata was reachable. This is a correct drift signal, not a tool failure.

### 3b. `node test/tools/testbed.mjs` (no args)

Actual output:
```
usage: testbed <command>
  testbed run     <harness> <version> --prompt "…" --repo <dir> --home <dir>
  testbed session <harness> <version> --resume <id> --prompt "…"
  testbed matrix  <harness> --versions a,b --prompt "…"
```

Exit code: **0** (within the brief's accepted outcomes: "exit 1 with no args, or 0"). Proves the shim loads the built dist.

## Gate 4 — Commit — PASS

Command: `git add -A && git commit -m "test: verify testbed + scenario framework end-to-end" --allow-empty`

Pre-state: `git status --porcelain` empty (working tree clean at `572fc0b`); `test/tools/dist/` confirmed git-ignored (`.gitignore:5`), so build outputs left no residual. Sentinel commit created: `3dc7724`. Post-state: clean tree.

## Concerns

None blocking.

- Note (expected behavior, not a failure): `reconcile --check` exits 1 because the `codex` manifest has no snapshot covering upstream latest 0.156.0. Recording a codex snapshot (via `--record`) is operational follow-up, out of Task 10 scope.
- The `?` rows for `cursor` / `cursor-cli` reflect upstream metadata not resolving in this environment; documented as network-dependent.