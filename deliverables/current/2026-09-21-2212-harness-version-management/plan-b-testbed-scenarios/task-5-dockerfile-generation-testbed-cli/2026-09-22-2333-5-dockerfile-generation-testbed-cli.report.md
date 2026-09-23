# Task 5 Report — Dockerfile generation + `testbed` CLI

**Status:** DONE_WITH_CONCERNS (complete and green; one deliberate deviation from the brief, flagged below)
**Commit:** `3045784` — `feat(testbed): Dockerfile generation and testbed run/session/matrix core` (branch `harness-version-mgmt-plan-b`, 5 files, +284)
**Test:** `npx vitest run test/tools/testbed.test.ts` → **9 passed (9)**; full suite `npx vitest run` → **227 passed (227 files 44)** — no regressions.

## What I did

1. **TDD, RED first.** Wrote `test/tools/testbed.test.ts` per the brief's Step 4 verbatim, plus the two `buildImage` tests the brief's (otherwise unused) `mkdtempSync`/`rmSync`/`tmpdir`/`join` imports hint at: a manifest-driven build test with a recording fake executor (asserts tag, context dir, generated Dockerfile content read back from disk, manifest-derived package name) and a failed-build propagation test. Also added an unknown-harness error test. Confirmed RED: `Cannot find module './testbed'` — fails for the right reason (feature missing, not a typo). No real docker anywhere: every executor is injected.
2. **GREEN.** Implemented `test/tools/testbed.ts` per brief Step 1 + Step 3: `imageTag`, `dockerfileFor` (npm / fhs-wrapper / git-unknown placeholder), `imageName`, `HEADLESS_COMMANDS` (8 entries, verbatim), `DockerExecutor` interface + real `dockerExecutor` wrapper (600s timeouts), `buildImage`, `runHarness`, `main(argv)` with the brief's USAGE. Only imports: `node:child_process`, `node:fs`, `node:path`, `./manifest` — no src/ imports (Task 1 ruling respected).
3. **Shim.** `test/tools/testbed.mjs` matches the existing `env.mjs`/`probe.mjs` pattern exactly (createRequire + `dist/testbed.js` + not-built guard), so no adaptation was needed — the brief's sketch already is the repo pattern. Verified after `npm run build:tools`: no args → usage, exit 0; bogus command → usage, exit 1.
4. **Templates.** `test/testbed/Dockerfile.template.npm` and `Dockerfile.template.git` exactly per brief Step 6.

## Manifest API check (per task instructions)

The real `test/tools/manifest.ts` `loadManifest()` is **synchronous** and returns `Record<string, HarnessManifestEntry>` with `install.{method,package,url}` — exactly what the brief's `buildImage` assumes. **No adaptation needed**; the brief's usage is verbatim-correct against the real API. (`config/config.json` has all eight harnesses; npm entries all carry `install.package`.)

## Deviations (and why)

1. **Arg rendering in `runHarness` (deliberate deviation from the brief's sketch).** The brief's sketch JSON-stringifies *all* args, which renders `claude "-p" "hi"` — but the brief's own Step 4 test requires the substring `claude -p` unquoted. The sketch and its test are mutually inconsistent; the test is the behavioral spec, so I made value tokens JSON-quoted and flag tokens (leading `-`) bare: `claude -p "hi"`, `agent -p "two words" --mode ask --trust --workspace "/repo"`. Added a dedicated test asserting this shape. Downside documented in code: value strings containing `$`/backticks would be shell-expanded by the `sh -c` entrypoint (acceptable for developer-provided prompts). If the controller prefers literal-quote-all, it's a one-line change — but then the brief's `expect(seen).toContain('claude -p')` must change too.
2. **Minor hardening of `dockerExecutor`:** `(r.stdout ?? '') + (r.stderr ?? '')` — under Node's `spawnSync`, `stdout`/`stderr` are `undefined` when the spawn itself fails (verified: `status: null, error: ENOTDIR`, sum would otherwise be the literal string `"undefined"`). Comment-only difference from the sketch.
3. **Test scope additions:** the two extra `buildImage` tests (justified by the brief's own unused imports, which I removed and replaced with `readFileSync`) and an fhs-wrapper dockerfile test. Brief Step 4's four tests are present verbatim.

## Concerns (for Task 6 / controller, non-blocking)

- **`session` and `matrix` are not implemented** — brief Step 3 declares them in USAGE only; `main` handles `run` and falls through to usage otherwise. The brief's Interfaces section mentions `testbedRun / testbedSession / testbedMatrix` core, but no Step specifies their code, and Task 6 consumes only `buildImage`/`runHarness`/`DockerExecutor`. Noted here per the instruction to follow the brief verbatim.
- `main` reads the version from `rest[0]`, so `testbed run codex --prompt "x" 0.155.1` (version not immediately after `run <harness>` order being flexible) parses `--prompt` as the version if flags come first. Matches the brief's sketch exactly; fine for its documented call order.
- The npm Dockerfile ignores the manifest's verified-range data (uses whatever version is passed); correct for this layer — range validation is the registry's job, and Task 6 consumes the tag opaquely.
- `dockerfileFor`'s git/unknown branch is an intentional placeholder (brief says so; template.git documents the same).

## Fix round 1

Review approved everything except one Important finding (controller ruling): `HEADLESS_COMMANDS['cursor']` departs from PROBE_COMMANDS mirroring by design, so it needed documentation. Added a comment block at the `cursor` entry in `test/tools/testbed.ts` stating: (a) cursor (IDE) is human-only (spec R5) and never dispatched through the container runner; (b) the entry documents the in-container agent CLI shape for completeness and departs from PROBE_COMMANDS mirroring — probe's 'cursor' entry is mirrored by 'cursor-cli'; (c) the entry is therefore never exercised by `testbed run`. Comment-only change: no behavior touched, no tests added, other entries untouched. Verified `npx vitest run test/tools/testbed.test.ts` → 9/9 pass.