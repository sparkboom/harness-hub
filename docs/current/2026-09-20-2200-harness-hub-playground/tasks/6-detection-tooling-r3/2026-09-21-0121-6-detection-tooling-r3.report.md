# Task 6 Report: detection tooling (R3)

Status: DONE_WITH_CONCERNS (work complete and green; two small deviations from the brief's literal code, both required to make its own test pass — see Deviations)

## What you did

Executed Task 6 per the brief with strict TDD:

1. **RED**: Wrote `tools/detect.test.ts` verbatim from the brief; `npx vitest run tools/detect.test.ts` failed as expected (`Failed to resolve import "./detect"`).
2. Implemented `tools/manifest.ts`, `tools/detect.ts`, `tools/detect.mjs` (brief's code verbatim except the two binding/ruled deviations below).
3. First GREEN attempt failed at `loadManifest()` — `ENOENT: /Users/matt/Repos/ai/harness-versions.json`. Root cause: the brief's `MANIFEST_PATH = join(__dirname, '..', '..', 'harness-versions.json')` is only correct for the compiled layout (`tools/dist/` → package root). Under vitest, `tools/manifest.ts` runs from `<repo>/tools`, so two `..` segments exit the repo. This differs from `src/registry/versions.ts`, which uses the same join validly because both its source (`src/registry/`) and compiled (`dist/registry/`) locations are two levels below the package root; `tools/` source is one level deep. Fixed by probing candidate paths (`__dirname`, `__dirname/..`, `__dirname/../..`) and using the first that exists.
4. Second failure: brief's test injects runner returning `'1.16.2\n'` and expects `'1.16.2'`, but the brief's `detectWith` passes runner output through untrimmed — the brief is internally inconsistent (its own `runVersion` trims; the injected runner doesn't). Fixed minimally by normalizing runner output in `detectWith` (trim; empty → null), matching `runVersion`'s contract.
5. **GREEN**: 3/3 detect tests pass.
6. Full suite + build + real-entrypoint smoke test (below).
7. Committed exactly the four task files.

Binding deviations honored:
- `resolveBinary` is `export`ed (brief had it module-local; Task 7's `probe.ts` imports it).
- `BINARY_CANDIDATES` map verbatim, incl. Cursor → `['agent', join(homedir(), '.cursor', 'bin', 'agent')]` — never the `cursor` IDE binary (spec R3).
- `which()` via `sh -c 'command -v ...'`; 15s `--version` timeout; `DetectRow` shape; `formatDetect` column widths 14/18/14/40; `detectWith(runner)` injection seam; `detectInstalled()`; `main(argv)`.
- Non-zero exit NOT used for missing harnesses: `main` always returns 0; missing → `NOT INSTALLED` column.
- No new dependencies; versions read from `harness-versions.json` via the tools-side loader (no hardcoded versions).

## Files changed (commit `0e7c504`, branch `playground`)

- `tools/manifest.ts` (new, 27 lines) — `HarnessManifestEntry` interface, `loadManifest()`, probed `MANIFEST_PATH`.
- `tools/detect.ts` (new, 89 lines) — `DetectRow`, `BINARY_CANDIDATES`, `which`, exported `resolveBinary`, `runVersion`, `detectWith`, `detectInstalled`, `formatDetect`, `main`.
- `tools/detect.test.ts` (new, 26 lines) — brief's tests verbatim.
- `tools/detect.mjs` (new, 17 lines) — same shape as `generate.mjs`, loads `dist/detect.js`, exits 1 with a "tools not built" hint if absent.

Not touched: pre-existing unstaged tree changes (uncommitted `docs/ complete/` → `docs/complete/` move; deletion of root `vitest.config.ts` — a tracked `vitest.config.mjs` already exists). Nothing committed under `docs/`.

## Test commands run + output summary

- `npx vitest run tools/detect.test.ts` (Step 2): FAIL — unresolved import `./detect` (expected RED).
- Same command after implement: 3 failed — all `ENOENT .../Users/matt/Repos/ai/harness-versions.json` (manifest-path bug).
- Same after manifest fix: 1 failed | 2 passed — `'1.16.2\n'` vs `'1.16.2'` (normalization gap).
- Same after `detectWith` fix: **3 passed (3)**.
- `npx vitest run` (full suite): **Test Files 32 passed (32); Tests 160 passed (160)** — suite stays green.
- `npm run build:tools`: compiles clean (only a pre-existing unrelated npm config warning: unknown `devdir`); `tools/dist/detect.js` + `tools/dist/manifest.js` emitted.
- `node tools/detect.mjs` (smoke, compiled layout): exit 0; table lists all 7 harnesses sorted with pins, against the live system:
  - claude-code NOT INSTALLED; codex NOT INSTALLED; cursor NOT INSTALLED (correctly no false positive from the `cursor` IDE binary — R3 holds); deepseek `0.1.5-rc.1` (== pin); hermes `Hermes Agent v0.21.3 (2026.9.14)` (pin 0.21.2 — visible drift); opencode `1.16.2` (pin 1.18.31 — visible drift); pi NOT INSTALLED.
  - Also confirms the compiled `tools/dist/` manifest resolution (candidate index 2) works.

## Decisions/deviations

1. **`tools/manifest.ts` manifest path**: brief's static `join(__dirname, '..', '..')` replaced with a probed candidate list (first-existing of `__dirname`, `__dirname/..`, `__dirname/../..`; falls back to last candidate so the failure is the informative ENOENT). Rationale above; deviates from "follow the brief verbatim" but the brief's literal code cannot pass its own test under vitest. Source-vs-dist depth asymmetry documented in a comment, cross-referencing `src/registry/versions.ts`.
2. **`detectWith` normalizes runner output**: `v.trim() || null` (null passes through). Required by the brief's own test (injected `'1.16.2\n'` → `'1.16.2'`) and consistent with `runVersion`'s already-trimming contract. Effect on production: none (runVersion output is already trimmed/non-empty); effect for Task 7's `probe.ts`: a stub runner can no longer smuggle untrimmed strings into rows.
3. `resolveBinary` exported per controller ruling (the only intentional code-shape change vs the brief's listing).

## Concerns

1. **Cursor smoke shows NOT INSTALLED** despite Cursor being the active environment: this machine resolves `agent` via `command -v`? Apparently not in the sandbox PATH, and `~/.cursor/bin/agent` was not found. If `agent` normally lives elsewhere (e.g. version-managed shim) the candidates list may need a third location later — but per spec, `['agent', ~/.cursor/bin/agent]` is the pinned candidate set, so I left it verbatim. Cosmetic only (report tool), no exit-code impact by design.
2. Version strings are raw first-line output (e.g. hermes reports a longer banner string); comparison against pin is left to consumers — matches brief/plan scope.
3. Pre-existing unstaged changes in the working tree are not mine and were deliberately left uncommitted; the controller may want to disposition them separately.
