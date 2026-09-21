# test/ Environment & Tooling Restructure Specification

Status: ready for review · Supersedes parts of `2026-09-20-2200-harness-hub-playground/harness-hub-playground.spec.md` (R6 layout clause, R7, and the `tools/`-location rationale).

## Purpose

Reorganize the dev-only, environment-scoped pieces of the repo so that:

1. The **Nix flake**, **environment tooling** (generator, detection, probe,
   and a new environment manager), and the **scaffold templates** live together
   under one committed, self-describing project folder (`test/`) — instead of
   the flake at root, the tooling at `tools/`, and the scaffold unrecoverably
   gitignored inside `playground/`.
2. The **scaffold is committed and reproducible** — fixing the defect where a
   scrapped playground left no in-repo source for its own `package.json` /
   `setup.sh`.
3. **Ephemeral test environments** are a first-class, on-demand concept:
   constructed into gitignored `test/env/{name}/` directories by a tooling
   entrypoint, used for both manual play and (future) integration tests.

This restructure supersedes the playground deliverable's "single default
`playground/`" layout and its "nothing under `playground/` is ever tracked"
invariant (R7) with a clearer boundary: **static tooling/templates are
committed under `test/`; only the throwaway environments under `test/env/**`
are git-ignored.**

## Background & constraints

- The shipped **runtime CLI** (`src/`, the `harness-hub` binary, `list`/`info`,
  `doctor`, `enable`/`disable`, `migrate`) is product surface and stays put.
  This restructure touches only dev/env tooling — nothing under `src/`.
- `harness-versions.json` is the single source of truth for harness versions
  and stays at repo root (it feeds the runtime registry in `src/registry/`,
  the tools manifest loader, and the flake). The flake and tools must keep
  resolving it correctly after moving.
- `tools/` is already dev-only, compiled separately (`build:tools`), and
  excluded from the npm `files` array; it is the committed home of the
  generator/detection/probe logic. This restructure relocates it to
  `test/tools/` and adds `env` management to it.
- The prior playground deliverable already built the generator
  (`generate.mjs`), detection (`detect.mjs`), and probe (`probe.mjs`) tooling
  and pinned snapshot scenarios (`tools/scenarios/`); those continue to work
  unchanged, only their on-disk home moves.

## Target layout

```
test/
  flake.nix              # moved from repo root — env-scoped provisioning
  flake.lock             # moved with it
  tools/                 # moved from tools/ (generate, detect, probe, env, scenarios/)
  template/              # committed static scaffold (copied into new envs)
    package.json
    AGENTS.md
  env/                   # git-ignored (test/env/**) — ephemeral environments
    playground/          # constructed on demand; never committed
    <name>/
# future: test/integration/ — assertion suites that reuse env/ + tools/
```

Everything under `test/env/` is ephemeral state (a nested consumer repo with
its own `.git`, generated scenario assets, npm-link wiring). `test/template/`,
`test/tools/`, and `test/flake*` are committed source.

## Detailed requirements

### R1 — committed scaffold templates (`test/template/`)

- `test/template/` holds the **static** files every ephemeral env starts from:
  - `package.json` — npm scripts with corrected relative paths (see below),
    name field templated per-env at construction time.
  - `AGENTS.md` — the minimal consumer-repo agent doc currently at
    `playground/AGENTS.md`.
- The scaffold contains **no setup shell script**: environment construction is
  tooling and belongs in `env.mjs` (R3). `playground/setup.sh` is subsumed and
  removed.
- Template files are **committed** and are the single in-repo source for an
  env's initial contents.

**Corrected relative paths.** Because an env now lives at
`test/env/{name}/` (one level deeper than the old `playground/`), every
`../` reference gains a level:

- `node ../tools/generate.mjs` →`node ../../tools/generate.mjs` (and same for
  `detect`/`probe`/`env`).
- `nix develop` (in the env's `shell` script) → the flake now lives in
  `test/`, so the env must invoke `nix --flake ../../` (pointing at `test/`),
  not a bare `nix develop` from `test/env/{name}/`.
- `sh setup.sh` → replaced by `node ../../tools/env.mjs create .` (or R3's
  chosen invoke form).

### R2 — moved Nix flake (`test/flake.nix`)

- Move `flake.nix` and `flake.lock` from root to `test/`.
- The flake's `builtins.readFile ./harness-versions.json` must become
  `../harness-versions.json` (the manifest stays at root).
- `description`, `shellHook` prose, and the `nix develop` doc references must
  reflect the new location. `npm run shell` in an env (and `env shell`, R3)
  must settle `nix develop` against `test/flake.nix`, not the root.
- No functional change to the pinned-harness provisioning, the
  Linux-conditional `cursorFhs`, or the HASH FILL procedure (still
  best-effort/placeholder hashes).

### R3 — environment manager tooling (`test/tools/env.mjs` / `env.ts`)

Add a fourth thin-CLI/importable-core pair, mirroring `generate`/`detect`/
`probe` (thin `env.mjs` loads compiled `dist/env.js`; logic in `env.ts`,
exported for tests).

Commands:

- **`env create <name>`** (alias `env init`) — idempotently construct an
  environment:
  1. create `test/env/<name>/`;
  2. `git init` inside it (nested consumer repo, per the playground spec's
     `findRepoRoot` need);
  3. copy `test/template/*` into it, templating the `package.json` `name`
     field to `harness-hub-env-<name>`;
  4. `npm link` at repo root so `harness-hub` is on the env's `PATH`
     (skip/keep if already linked);
  5. apply the R9 gate (R4).
- **`env rm <name>`** — remove `test/env/<name>/` entirely (with a
  confirmation-less `--yes` for scripting; refuse unknown names).
- **`env ls`** — list existing `test/env/*/` directories.
- **`env shell [<name>]`** — enter `nix develop` against `test/flake.nix`
  (optionally from a named env's cwd; the canonical pinned entrypoint).
- **`env generate <name> <scenario> [--target ...]`** — convenience
  chaining: `generate` the scenario into the named env (delegates to
  `generateScenario`), so `resetTarget` operates on `test/env/<name>/`.
- `env create` with no name defaults to `playground`, preserving the familiar
  manual-play entry point; the name must be a single non-dot, non-`..`
  path segment (defense against escaping `test/env/`). Names are otherwise
  free-form, and they must not collide with the future integration-tests env
  name (documented convention, not enforced).

**Env root resolution.** The default target for `test/env/{name}/` is resolved
relative to the `test/` folder (the manager knows its own location via
`import.meta.url`, not via `process.cwd()`), so `env` works when invoked from
any CWD. An `--root` override exercises the same paths against an
arbitrary directory (useful for tests).

### R4 — Git ignore boundaries

- Remove `playground/` and `tools/dist/` from `.gitignore`.
- Add `test/env/**` and `test/tools/dist/`.
- Net effect: `test/template/`, `test/tools/*.ts|*.mjs`, `test/flake*` are
  tracked; `test/env/**` and compiled tool output are ignored.
- Any stale on-disk `playground/` directory (currently git-ignored, contains
  untracked state) is **not** migrated; it is deleted by the developer and
  replaced by `env create playground` (or left until removed — it is outside
  version control and irrelevant to the repo).

### R6 — references to relocate

Repoint all in-repo references to `tools/` and the flake (verified surface
today is small):

- `package.json` `build:tools` → `tsc -p test/tools/tsconfig.json`.
- `test/tools/tsconfig.json` `outDir` → forms `test/tools/dist` (keeps its
  own `rootDir` layout inside `test/tools/`).
- `vitest.config.mjs` — its `resolve.extensions` reorder stays; the comment
  about `generate.mjs`/`generate.ts` stays valid (no path literal to the repo
  root to change; verify the tools tests still resolve `.ts` over `.mjs` after
  the move).
- `test/tools/manifest.ts` — the `harness-versions.json` candidate list is
  positional (`__dirname`, `__dirname/..`, `__dirname/../..`). After the move
  the manifest is one level further away: source layout (`__dirname =
  test/tools`) needs `../..`, compiled layout (`__dirname = test/tools/dist`)
  needs `../../..` — extend the candidate list by one level (to `../../..`)
  and keep it tolerant of source vs. compiled layouts.
- `test/flake.nix` — `./harness-versions.json` → `../harness-versions.json`.
- `test/template/package.json` — `../../tools/*` script paths (R1).
- Any `nix develop` / "repo root" doc prose in `AGENTS.md`, `README.md`,
  `docs/` that names `flake.nix` at root.

### R7 — R9 observation ownership (consolidation)

- The `nix develop` prerequisite (R9 in the playground spec) is enforced/
  warned at two points, without double-warning:
  - **`env.mjs`** owns the **gate** for environment construction/use
    (`create`, `shell`, `generate`): warn (and, for shell-pinned commands,
    refuse) outside `nix develop`.
  - **`probe.ts`** retains its existing `warnIfUnpinned()` stderr banner
    (observation entrypoint); text updated to reference the relocated
    shell form (`npm run shell` → `env shell` or the env's `npm run shell`).
- No net change to R9 semantics: unpinned harnesses are never silently
  observed; `env` hardening is additive, not a behaviour regression.

### R8 — product surface untouched

- `src/` (runtime CLI, `list`/`info`, `doctor`, wiring, registry) unchanged.
- `harness-hub` runtime behaviour (including `list`'s TRUST GATE column and
  `info`'s detail) is unaffected by this restructure.

## Supersedes / interaction with prior spec

- **`harness-hub-playground.spec.md` R6** — "single default playground, not a
  managed subfolder tree" is superseded; `env` management and the `test/env/`
  class are now first-class (the prior spec itself flagged "first-class
  subfolder management" as deferred over-engineering — this delivers it).
- **`harness-hub-playground.spec.md` R7** — "no file under `playground/` is
  ever tracked" is superseded by "`test/template/` is tracked; `test/env/**`
  is not."
- The prior deliverable's `docs/`  (spec/plan/progress/tasks) remain as
  historical record (unmodified; archive per AGENTS.md later, if desired).

## Non-goals

- No change to `harness-hub` runtime CLI behaviour or output.
- No integration-test *assertions* are authored here (that remains a future
  deliverable living under `test/integration/`); this restructure leaves a
  home for them. Only the ability to construct/teardown their environments.
- No nix hash-fill completion (still best-effort / known-pending).
- No churn in `docs/complete/` (pre-existing, out of scope).

## Success criteria

1. `test/` exists with `flake.nix`, `flake.lock`, `tools/` (moved whole),
   `template/` (committed scaffold), and `env/` (git-ignored).
2. `npm run build:tools` still emits `test/tools/dist/` and the `.mjs` shims
   resolve it.
3. `env create playground` produces `test/env/playground/` with a nested
   `.git`, `package.json`/`AGENTS.md` copied, `harness-hub` linked, and the
   R9 gate respected; `git status` shows **no** `test/env/` entries.
4. `env create foo && generate <scenario> --target test/env/foo && detect &&
   probe` works from outside `test/tools` (cwd-independent via `import.meta.url`).
5. `nix --flake test/ develop` (or `env shell`) enters the pinned shell;
   `../harness-versions.json` resolves.
6. The full test suite (`npx vitest run`), `npm run typecheck`, and
   `npm run build:tools` are green after the move.
7. `git status` is clean except the intentional removal of the old
   `playground/` (which is ignored anyway).