# Resolution note — harness-hub-playground

This deliverable is **complete** and is **partly superseded** by the
`test-environment-tooling` deliverable
(`deliverables/current/2026-09-21-0807-test-environment-tooling/`). This note
records what was overridden by that newer work and what was never constructed.

## Overridden / superseded by `test-environment-tooling`

| Item | Original requirement | Superseded by |
|---|---|---|
| R6 "Layout" | A single default `playground/`; no first-class subfolder management (explicitly deferred as over-engineering) | `env` management + `test/env/{name}/` ephemeral environments |
| R7 "nothing committed" | No file under `playground/` is ever tracked | `test/template/` is tracked; only `test/env/**` is git-ignored |
| `tools/` location | Dev tooling at top-level `tools/` | Relocates to `test/tools/` |
| `flake.nix` location | Repo root | Relocates to `test/flake.nix` |
| `playground/setup.sh` | Shell scaffolding script | Subsumed by the `test/tools/env.mjs` environment manager |

## Never constructed (deferred / not realized)

- **Integration-test assertions** — this deliverable was scoped to build the
  *fixtures and tooling* only; the tests themselves were always a separate
  future deliverable (now expected to live under `test/integration/`).
- **Nix HASH FILL loop** — `flake.nix` shipped with `lib.fakeHash`
  placeholders; the one-run hash-fill procedure (`nix develop` → paste the
  reported hashes) was never completed. The pinned shell does not build until
  the hashes are filled.
- **Cursor FHS wrapper reliability** — the `cursorFhs` wrapper is Linux-only
  and unverified on aarch64-darwin (cursor is detection-only there). The
  spec's "try FHS wrapper, degrade to detection-only" decision is recorded but
  the wrapper was never proven on this machine.

## Still authoritative (preserved)

- The scenario generator, detection, and probe tooling (now relocated under
  `test/tools/`).
- The runtime CLI (`src/`: `list`/`info`, `doctor`, wiring, registry) — wholly
  unaffected by the newer deliverable.
- `harness-versions.json` as the single source of truth for harness versions
  — still authoritative in shape, but the newer deliverable relocates it into
  `config/config.json` with a nested `harness.versions` property.
