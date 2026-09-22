# Resolution note — test-environment-tooling

This deliverable is **complete** and is **partly superseded** by the
`harness-version-management` deliverable
(`deliverables/current/2026-09-21-2212-harness-version-management/`). This note
records what was delivered, what was abandoned and why, and what later work
superseded parts of it.

## Delivered

All seven planned tasks were implemented and merged into `playground`
(commits `ffbd2dc`…`3ff388a`), then carried forward through the `config`
relocation follow-ups (`5a48ae5`, `533813b`, `b9c5112`, `25d8831`,
`3ff388a`) and the merge-conflict/README commits (`dde5102`, `18dee9d`,
`f736f1a`):

- **`test/` restructure** — `flake.nix`/`flake.lock` moved from repo root to
  `test/`; dev tooling moved `tools/` → `test/tools/`; a committed static
  scaffold at `test/template/`; ephemeral environments live under
  `test/env/**` (git-ignored).
- **Environment manager** — `test/tools/env.ts` / `env.mjs` with
  `create`/`rm`/`ls`/`shell`/`generate`, cwd-independent resolution via
  `import.meta.url`, and the nix-shell observation gate (R7/R9).
- **Config relocation** — `harness-versions.json` → `config/config.json`,
  nested under `harness.versions`; both consumers
  (`src/registry/versions.ts`, `test/tools/manifest.ts`) updated.
- **Ignore boundaries + references sweep + probe text** (R4, R6, R7).
- **Full verification** — `npx vitest run`, `npm run typecheck`, and
  `npm run build:tools` green after the restructure.

The task briefs and progress ledger were promoted from the SDD scratch
workspace into `tasks/` beside this note.

## Abandoned / never completed

- **Nix hash-fill loop.** `flake.nix` shipped with `lib.fakeHash` placeholders
  for the npm-fetched harnesses; the one-run "`nix develop` → paste the
  reported hashes" procedure was never completed, so the pinned shell does not
  build until the hashes are filled. **Why abandoned:** exact harness-version
  pinning was re-architected toward Docker testbeds and a version-range model
  in `config.json` (see "Superseded" below), making the `buildNpmPackage`
  hash-fill approach obsolete rather than merely unfinished.
- **Cursor FHS wrapper.** The `cursorFhs` wrapper is Linux-only and was never
  proven on `aarch64-darwin` (cursor is detection-only there). Left as the
  spec's documented fallback, not removed.
- **Integration-test assertions.** This deliverable scoped itself to *fixtures
  and tooling* only; the actual test scenarios/assertions were always a
  separate future deliverable (now `harness-version-management`, living under
  the scenario framework rather than a bare `test/integration/`).

## Superseded by `harness-version-management`

| Item | This deliverable | Superseded by |
|---|---|---|
| Exact version pinning | Nix `buildNpmPackage` at pinned versions + hash fill | Docker testbeds targeting exact harness versions |
| `config.json` shape | flat `harness.versions` map with `install.method` | version **ranges** (`min`/`max`), convention profiles, review status (`verified`/`unverified`/`unrecognized`) |
| Review mechanics | `detect`/`probe` snapshot comparison | declarative scenario framework (`scenarios.md`), evidence ladder, `reconcile` tool |
| `test/integration/` home | a future folder for assertions | subsumed into the scenario/runner model |

## Still authoritative (preserved)

- The runtime CLI (`src/`: `list`/`info`, `doctor`, wiring, registry) — wholly
  unaffected.
- `config/config.json` as the single source of truth for harness versions —
  authoritative in *role*, though its schema is extended (not replaced) by the
  newer deliverable.
- `test/tools/` generator/detection/probe tooling and `test/template/` — still
  used; the newer deliverable builds the scenario framework alongside them.
