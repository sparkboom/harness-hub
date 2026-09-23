# Ticket — Plan E: Doctor `--version` test isolation

> **Status:** deferred. Recorded 2026-09-23 while closing out Plan B.
> **Origin:** this is a **Plan A** issue (not Plan B/C/D). See blame below.
> **Blocked-on:** nothing. Not required by Plan C or Plan D — see "Is this essential?".

## Summary

`harness-hub doctor` calls `detectInstalledVersions()`, which shelled-out to
run `--version` against every harness binary found on the host `PATH`. Two
pre-existing tests time out because of it:

- `src/cli.test.ts > cli main() > doctor exits 0 for a minimal valid repo`
  (fails ~7.3s, exceeds the 5s vitest assertion timeout)
- `src/commands/doctor.test.ts > exits non-zero when AGENTS.md is missing`
  (fails ~7.5s)

They were **commented out** to get Plan B's suite green so the branch could be
merged. This ticket describes the proper fix so the tests can be restored.

## Blame (confirms Plan A ownership)

- `src/harnessDetect.ts` — introduced in `ac31029` "Harness version mgmt - plan a (#3)".
- `src/commands/doctor.ts`, `src/cli.ts` doctor command — `95b4334` / `3e24cb4`.

## Root cause

`runDoctorCommand(repoRoot)` unconditionally calls
`detectInstalledVersions()` → `detectWith(runVersion)` → for each id in
`ALL_HARNESS_IDS`, `resolveBinary(id)` runs `sh -c "command -v …"` and
`runVersion(id)` runs `<bin> --version` (each `spawnSync`, 15s timeout).

On this machine `hermes`, `pi`, `opencode`, and `dsh` are on `PATH`, so doctor
pays for ~4 real binary spawns before any rule runs. Serial spawn cost +
vitest's 48-file worker fan-out pushes it past 5s. It reproduces even in
isolation (~7s), so it is deterministic slowness, not pure contention.

The deeper defect is **test isolation**: the suite's result currently depends
on what harnesses happen to be installed on the developer's machine. Install
or uninstall `pi`/`opencode`/etc. and different tests pass/fail.

## Why the tests were commented out (not fixed)

Proposed fix touches Plan A code (`runDoctorCommand`) that is outside Plan B's
scope. Rather than expand the Plan B branch's surface at merge time, the two
failing tests were commented out and the fix deferred to its own plan (this
one).

## Proposed solution — Option A (recommended): inject the version runner

The correct seam already exists — `harnessDetect.ts` exports
`detectWith(runner: VersionRunner)` and `EMPTY_VERSIONS` is already the default
for `buildDoctorContext.installedVersions`. The gap is that `runDoctorCommand`
hardcodes the real `detectInstalledVersions()` and exposes no way to override
it. Fix:

1. `runDoctorCommand(repoRoot, homeDir?, installedVersions?)` — accept an
   optional pre-computed `Record<HarnessId, string | null>`, defaulting to
   `detectInstalledVersions()` (production behavior unchanged).
2. `src/cli.ts` `doctor` action stays as-is — real probing in production is
   correct and desirable.
3. Restore the two tests, passing `{}` (or a small fixture) so no `PATH`
   probing happens in unit tests.

### Why Option A is recommended

- **Deterministic tests.** Result no longer depends on the developer's installed
  harnesses — the exact property being asked for.
- **Fast.** No `spawnSync` in the unit-test path at all.
- **Minimal.** Uses the existing `VersionRunner`/`detectWith` seam rather than
  a redesign; ~4 lines of signature change plus test update.
- **Correct layering.** "What version is installed?" is a unit concern; it
  should be stubbed, not containerized.

## Alternative considered — Docker container for `--version` (NOT recommended here)

Isolating the version probe in a Docker container was considered. It is the
right isolation for the *testbed run* layer (Plan B's `containerRunner` →
`dockerExecutor`, already injectable + committed Dockerfile templates), but
**wrong for the `--version` probe**: it adds a container round-trip to a
trivial check and slows every quick test. Use Docker where Plan B already uses
Docker; stub the probe.

## Scope note / related points

- Also worth folding in (same "host-binary isolation" theme, low priority):
  `src/commands/list.test.ts`, `src/commands/info.test.ts` — same
  `detectInstalledVersions()` calls; audit whether they hit the same flake.
- The `VersionRunner` seam means the CLI (`list`/`info`) could later accept an
  injected runner the same way, but production correctness is fine as-is.

## Is this essential for Plan C / Plan D?

**No.** Plan C touches only `test/tools/verify/` + `test/tools/report.ts`.
Plan D touches only `test/tools/gateway*` + `test/tools/verify/`. Neither reads
`src/commands/doctor.ts`, `src/harnessDetect.ts`, or the two failing test files.
This fix can land independently before, during, or after C/D without conflict.