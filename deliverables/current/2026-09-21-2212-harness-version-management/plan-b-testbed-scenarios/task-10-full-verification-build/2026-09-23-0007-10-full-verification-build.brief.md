### Task 10: Full verification + build

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: PASS (all suites including Plan A's).

- [ ] **Step 2: Typecheck and build tools**

Run: `npm run typecheck && npm run build:tools`
Expected: both clean; `test/tools/dist/` gains `verify/*.js`, `testbed.js`, `reconcile.js`, `report.js`.

- [ ] **Step 3: Smoke-test the shims**

Run: `node test/tools/reconcile.mjs --check` (from repo root)
Expected: prints a table (network-dependent; may show `?` for offline). Exit code reflects drift. This exercises the shim end-to-end.

- [ ] **Step 4: Commit any residual**

```bash
git add -A
git commit -m "test: verify testbed + scenario framework end-to-end" --allow-empty
```

---

## Self-Review

**Spec coverage (R2, R3, R5, R6):**
- R2 image identity + generator from install method → Task 5 (`dockerfileFor`, `imageTag`, templates).
- R2 runtime contract `testbed run/session/matrix` → Task 5 (`main` + core). `session`/`matrix` are stubs of `run` with the documented flag surface; session-state mounting is honored via the `--home` bind-mount (Task 5 `dockerExecutor.run`).
- R2 state & credentials first-class → `--home` bind-mount + `homeDir` through the whole chain (Tasks 4, 5, 6).
- R3 `reconcile --check` drift gate + non-zero exit → Task 9.
- R3 `reconcile --record` sole mutation path → Task 9.
- R5 automated vs manual runners, one scenario → Tasks 6, 7 + Task 4's `Runner` abstraction.
- R6 scenario schema → Task 1; suite S1–S5 → Task 3; execution primitive → Task 4; evidence ladder → schema + report; report assembly → Task 8.
- Success criteria 2 (testbed executes codex/claude-code), 3 (suite + report), 4 (`--check` exit + `--record`), 5 (human runner) → covered.

**Placeholder scan:** The only intentional placeholders are (a) the git/fhs Dockerfile install steps (documented as harness-specific, matching the spec's "the harness's own install path"), and (b) the `TODO(plan-c)` confidence formula (explicitly deferred to Plan C per evidence-and-judges.md). No TBD in test code.

**Type consistency:** `Scenario`, `Snapshot`, `ScenarioContext`, `ScenarioOutcome`, `Runner`, `RunContext`, `RunResult`, `DockerExecutor`, `ManifestRange`, `CheckRow`, `Report` names are used consistently across Tasks 1–9. `runScenario`'s signature and `containerRunner`/`humanRunner` return `Runner` (not `containerRunner`/`humanRunner` types) so `Runner` stays the single abstraction.
