### Task 9: Full verification

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: PASS (all suites, including the registry/commands/doctor updates).

- [ ] **Step 2: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both clean.

- [ ] **Step 3: Smoke-test the CLI**

Run: `node dist/bin.js list` and `node dist/bin.js info codex`
Expected: `list` shows a STATUS column (unrecognized/verified/unverified per host); `info codex` shows a `status:` line. No crash.

- [ ] **Step 4: Commit any residual**

```bash
git add -A
git commit -m "test: verify registry-ranges deliverable end-to-end" --allow-empty
```

---

## Self-Review

**Spec coverage (R1, R4):**
- R1 profiles-in-code → Task 3 (`profiles.ts`).
- R1 ranges-in-data → Task 3 (`config.json` + `versions.ts`).
- R1 ordered ranges, min-inclusive/max-exclusive, first-match → Task 5.
- R1 resolution contract (`verified` / `unverified` / `unrecognized`) → Task 5.
- R1 compatibility (`verifiedVersion` = newest verified range's max/min) → Task 4.
- R1 `caveat` / `review` fields → Task 3 (schema + config).
- R4 list/info status → Task 7.
- R4 doctor rule → Task 8.
- Background `cursor`/`cursor-cli` split → Task 1.
- Success criterion 1 (ranges + resolver + no list/info regression) → Tasks 3–9.

**Placeholder scan:** no TBD/TODO; every code step has concrete code; tests are actual vitest code.

**Type consistency:** `VersionRange`, `HarnessVersionEntry`, `Resolution`, `ResolvedStatus`, `ConventionProfile` names are used consistently across Tasks 3–8; `resolveHarnessStatus`/`resolveVersion`/`detectInstalledVersions`/`detectWith` signatures are stable. `formatList` signature changes from `()` to `(installed)` and all callers/tests are updated in the same task.
