# harness-hub Playground & Test-Fixture Tooling Specification

## Purpose

harness-hub needs a way to exercise the CLI against *real* consumer repos —
repos containing `AGENTS.md`, `.agents/skills/`, and harness-specific files in
various states of health — so that wiring behavior, doctor rules, and
detection can be observed live, without polluting the harness-hub repository
itself.

This deliverable builds two things that belong together:

1. **A playground** — a folder that *behaves like a consumer repo*: the
   `harness-hub` CLI is available inside it, commands can be run against it
   in real time, and nothing it contains is ever committed to the
   harness-hub repo.
2. **Reusable test-fixture tooling** — the generator, detection, and probe
   machinery the playground consumes. This tooling is *committed* and lives
   outside the playground, because the next deliverable (integration tests)
   will import the same fixtures and tooling.

## Scope

**In scope:**

- A machine-readable `harness-versions.json` manifest — the single source of
  truth for harness versions, consumed by the nix flake and re-derived into
  `src/registry/data.ts`.
- A declarative, TypeScript **scenario generator** that renders dummy assets
  (`AGENTS.md`, `CLAUDE.md`, skills, override/local docs, invalid skills, …)
  into a target consumer repo, one named scenario at a time.
- **Detection** tooling that reports which harnesses are installed (and at
  what version) versus the research pins.
- **Probe** tooling that runs an installed harness inline with a minimal
  prompt to confirm it actually discovers the playground's `AGENTS.md` /
  skills.
- A **nix flake** (`devShells.default`) that provisions the npm-installable
  harnesses at their pinned versions, plus Cursor's headless CLI via an FHS
  wrapper.
- **`harness-hub list` and `harness-hub info <harness>`** — first-class CLI
  commands exposing the harness registry (a runtime CLI change, in scope).
- **Rule/finding name renames** — splitting ambiguous finding `ruleId`s into
  specific, failure-naming values (R10), so `doctor` output and scenario names
  stay unambiguous as rules grow.
- The **playground** itself: a git-ignored folder with its own `.git` (so
  `harness-hub` resolves it as a consumer repo), wired up via `package.json`
  npm scripts.

**Out of scope (deferred to later deliverables):**

- Integration tests that assert on harness-hub behavior. This deliverable
  builds the *fixtures and tooling* those tests will use; the tests themselves
  are a separate deliverable.
- The `AGENTS.md` templating deliverable.

## Background & constraints

### `findRepoRoot` and the nested-repo problem

harness-hub resolves "which repo am I in" by walking up from the current
directory to the nearest ancestor containing `.git` (`src/repo.ts`). Because
the playground lives *inside* the harness-hub working tree, a naive
`playground/` folder would cause every `harness-hub doctor/enable/…` run to
resolve to the harness-hub repo root — the playground would never behave like
a consumer repo.

**Resolution:** the playground gets its own `.git` (via `git init` in setup).
Because `playground/` is git-ignored by the outer repo, that nested repo is
invisible to harness-hub's own git state: nothing leaks, nothing is committed,
and the playground is a genuine, independent consumer repo.

### Harness versions — single source of truth

Today harness versions live in two places that can drift:

- `docs/…/harness-versions.insight.md` — prose research record.
- `src/registry/data.ts` — `verifiedVersion`/`verifiedDate` per harness entry.

This deliverable introduces **`harness-versions.json`** as the machine-readable
source of truth. The registry's `verifiedVersion`/`verifiedDate` are
re-derived from it (so code and manifest cannot disagree), and the nix flake
pins installs from it.

The research pins are:

| Harness | id | Version | Install |
|---|---|---|---|
| Claude Code | `claude-code` | 2.1.272 | npm `@anthropic-ai/claude-code` |
| Cursor | `cursor` | 3.x | curl script → headless CLI `agent` |
| OpenCode | `opencode` | 1.18.31 | npm `opencode-ai` |
| Codex | `codex` | 0.153.2 | npm `@openai/codex` |
| Hermes | `hermes` | 0.21.2 | npm `hermes-agent` |
| Pi | `pi` | 0.85.0 | npm `@mariozechner/pi-coding-agent` |
| DeepSeek (`dsh`) | `deepseek` | 0.1.5-rc.1 | npm `@deepseek-ai/dsh` |

Cursor is provisioned via an FHS wrapper running the curl installer (see
"Cursor: headless CLI, not the IDE" below).

### Cursor: headless CLI, not the IDE

Cursor has **two distinct entry points**, and the one on `PATH` locally is the
wrong one for testing:

- The **IDE** (`cursor`) — an Electron editor. Its flags are window/editor
  concerns (`--diff`, `--goto`, `--new-window`, `--chat`, …). It opens UI and
  is useless for scripted or CI-driven verification.
- The **headless CLI** (`agent`, formerly `cursor agent`) — a terminal-native,
  scriptable agent. Installed separately via `curl https://cursor.com/install
  -fsS | bash` (not npm, not nix). Supports exactly what we need:
  `-p/--print` (non-interactive), `--output-format json`, `--mode ask|plan`,
  `--trust` (headless trust), `--workspace <dir>`.

Consequences for this deliverable:

- Detection must look for the `agent` binary (or `cursor agent`), **not** the
  IDE `cursor` binary — otherwise detection false-positives on machines that
  have the editor but not the headless agent.
- Nix provisioning of Cursor uses a **Community FHS wrapper**
  (`buildFHSUserEnv`) that runs the curl installer inside an FHS-compatible
  sandbox, so the headless `agent` CLI becomes available in the devShell. This
  is *provisional*: the curl installer is side-effecting and not a clean nix
  package, so the wrapper is attempted and, **if it does not work, Cursor
  falls back to detection-only** rather than blocking the flake. The decision
  record is therefore: try FHS-wrapped install; on failure, detect-only.
- **Open verification item for the probe tooling:** does the headless `agent`
  read `AGENTS.md` and `.agents/skills/` the same way the IDE does? The
  registry's `cursor` entry assumes so, but this is exactly the kind of claim
  the playground's probe exists to confirm before integration tests rely on
  it.

### CLI command surface (verified against `src/cli.ts`)

The CLI's real commands are: `enable <harnesses…>`, `disable <harnesses…>`,
`migrate <harness>`, `doctor`. `enable`/`disable` take **harness ids**
(`claude-code`, `cursor`, `opencode`, `codex`, `hermes`, `pi`, `deepseek`), not
skill names. There is no `skills list` command. Tooling and docs must use the
correct surface.

This deliverable adds `list` and `info <harness>` (R8) to that surface — the
runtime CLI change is in scope, distinct from the dev-only playground tooling
(`detect`/`probe`).

## Requirements

### R1 — `harness-versions.json` manifest

- Machine-readable JSON at a stable, committed path (decided below).
- One entry per harness with at minimum: `displayName`, `version`,
  `verifiedDate`, and an `install` block (`method`, and `package` for npm
  installs).
- Cursor's `install.method` is `fhs-wrapper` (curl installer inside a
  `buildFHSUserEnv` wrapper; degrades to detection-only if the wrapper proves
  unreliable).
- `src/registry/data.ts` derives `verifiedVersion`/`verifiedDate` from this
  manifest so the two cannot drift. The manifest is authoritative for
  versions; the registry remains authoritative for *wiring conventions*
  (`agentsDoc.mode`, `skills.mode`, `trustGate`, symlink paths).

### R2 — declarative TypeScript scenario generator

- Lives in the shared `tools/` location (decided below), compiled with its own
  tsconfig and excluded from the published npm package.
- The generator is **layered on primitives**, so flexibility is not capped at
  the named scenarios (see R2a).
- Scenarios are TypeScript modules composed from primitives. Each scenario
  declares:
  - `name`, `description`;
  - `assets`: a list produced by primitive calls (a scenario may also drop to
    a raw `{ path, content }` for anything no primitive covers);
  - optionally `actions` (hooks the generator runs after rendering, for
    scenarios needing side effects).
- The generator is **idempotent**: rendering a scenario resets the target
  consumer repo to a clean baseline, then writes the scenario's assets. It
  never touches files outside the target.
- The generator accepts a `--target <dir>` so scenarios can render anywhere
  (the playground by default; tmp dirs for integration tests; ad-hoc parallel
  directories). See R6 for the layout consequence.
- Scenarios map **1:1 onto findings** (a rule's specific condition), not onto
  rule categories. The naming convention is in R2b. Only rules that exist in
  `src/doctor/rules/` get scenarios; future rules (e.g. precedence-interference,
  nested-inventory, intent-parity — full wiring spec §9, not yet implemented)
  get scenarios when their rules land.

  | Scenario | Exercises (actual rule → finding) |
  |---|---|
  | `baseline` | valid canon (`AGENTS.md` + valid `.agents/skills/`), nothing wired — no findings |
  | `missing-agents-md` | `canon-presence` → `canon-presence` (no `AGENTS.md`) |
  | `ambiguous-config` | `config-validity` → `config-ambiguous` (both `harness-hub.yaml` + `harness-hub.json`) |
  | `config-invalid-shape` | `config-validity` → `config-invalid-shape` (no `harnesses` array) |
  | `config-parse-error` | `config-validity` → `config-parse-error` (malformed YAML/JSON) |
  | `unknown-harness-id` | `config-validity` → `config-unknown-harness-id` (unrecognized id in list) |
  | `flat-skill-file` | `skill-shape` → `skill-flat-file` (`.agents/skills/foo.md` instead of `foo/SKILL.md`) |
  | `skill-missing-skill-md` | `skill-shape` → `skill-missing-skill-md` (dir with no `SKILL.md`) |
  | `skill-missing-name` | `skill-frontmatter` → `skill-missing-name` (`name` missing/empty) |
  | `skill-name-mismatch` | `skill-frontmatter` → `skill-name-mismatch` (`name` ≠ dir name) |
  | `skill-missing-description` | `skill-frontmatter` → `skill-missing-description` (`description` missing/empty) |
  | `claude-enable` | happy path: `enable claude-code` → `CLAUDE.md` + `.claude/skills/` symlinks |
  | `claude-md-clobber` | `clobber-risk` → `claude-md-clobber` (hand-written `CLAUDE.md` blocking the symlink) |
  | `claude-skills-clobber` | `clobber-risk` → `claude-skills-clobber` (`.claude/skills/` is a foreign symlink) |
  | `unmigrated-skills` | `skill-migration` → `unmigrated-skills` (`.claude/skills/<n>/` with no canon counterpart) |
  | `skill-migration-collision` | `skill-migration` → `skill-migration-collision` (copy differs from canon) |
  | `hermes-trust` | `trust-gate` → `hermes-trust` (enable `hermes` before `hermes skills trust`) |
  | `claude-drift` | `generated-file-drift` → `claude-drift` (symlinks removed/altered after enable) |
  | `multi` | several harnesses enabled at once (no single rule; composition) |

- The generator is importable as a module (not only a CLI), so integration
  tests can render scenarios programmatically.

#### R2a — primitives (the layer below scenarios)

Each primitive generates one *kind* of asset at an arbitrary path, and is
individually importable:

- `agentDoc({ path, content })` — an agent instruction doc at a given path
  (`AGENTS.md`, `CLAUDE.md`, `AGENTS.override.md`, `AGENTS.local.md`,
  `.hermes.md`, `CLAUDE.local.md`, nested `AGENTS.md`, …). A bare filename
  lands at the target root; a relative subpath lands nested.
- `skill({ name, location, frontmatter, body, valid })` — a `SKILL.md` at a
  given location (`location` ∈ canon `.agents/skills/` or any harness dir
  `.claude/skills/`, `.cursor/skills/`, `.codex/skills/`, …), with
  configurable frontmatter. `valid` controls whether the frontmatter satisfies
  the skills contract, so one primitive covers healthy skills and the
  `invalid-skills` variants alike (`name`≠dir, missing description, malformed
  YAML).
- `raw({ path, content })` — escape hatch for anything unmodeled.

This yields three tiers of flexibility:

1. **Named scenarios** (above) for the common doctor-rule failure modes.
2. **Ad-hoc one-offs** — compose primitives directly from a script for
   anything no scenario names ("put an invalid skill in `.cursor/skills/`").
3. **Integration-test fixtures** — tests import primitives and build bespoke
   fixtures programmatically, no named scenario required.

The `kind` tagging from earlier drafts is replaced by these primitives: the
primitive name *is* the reason the asset exists, so no separate `kind` field
is needed.

#### R2b — scenario & rule naming conventions

Scenario names must stay unambiguous as the rule set grows. The following
conventions apply and are the same discipline we apply to rule/finding names:

- **One scenario per finding condition, not per rule category.** A single rule
  often covers several distinct conditions (e.g. `clobber-risk` fires for
  `CLAUDE.md` *and* for `.claude/skills/`; `config-validity` covers four
  distinct malformations). Each gets its own scenario so a failure is
  attributable to a specific file/condition.
- **Name the asset, not the mechanism.** `claude-md-clobber` and
  `claude-skills-clobber`, never a bare `clobber` — "clobber" can happen on a
  growing set of files as more harnesses adopt `migrate-symlink` (and, in the
  future, more asset types). This is the same reasoning as scenario
  `claude-enable` (the action) over `claude-copy` (the mechanism, which was
  also wrong — the MVP symlinks, it doesn't copy).
- **Prefix with the harness id when the finding is harness-scoped**
  (`claude-md-clobber`, `hermes-trust`); no prefix for canon-wide findings
  (`missing-agents-md`, `flat-skill-file`).
- **Mirror the finding's `ruleId` where one exists.** Scenario names prefer to
  echo the `ruleId` string (`unmigrated-skills`, `skill-migration-collision`,
  `hermes-trust`) so the mapping scenario → finding is greppable. R10 makes the
  finding `ruleId`s themselves specific, so the scenario name and the finding
  `ruleId` coincide for every single-condition finding.

The rule/finding name *renames themselves* (splitting `clobber-risk`,
`config-validity`, `skill-shape`, `skill-frontmatter`, `generated-file-drift`
into specific finding ids, and aligning the `trust-gate` rule with its
`hermes-trust` finding) are specified in R10 — they are **in scope** for this
deliverable, not deferred.

### R3 — detection tooling

- `detect` prints a table of all seven harnesses: id, installed version (if
  present), research pin, and a mark for missing harnesses.
- Reads `harness-versions.json` for pins; never hardcodes versions.
- Detects the harness *binary*, not any same-name editor/UI binary. In
  particular, Cursor detection targets the headless `agent` CLI (`agent` /
  `cursor agent`), **not** the IDE `cursor` command (see "Cursor: headless
  CLI, not the IDE").
- Non-zero exit is *not* required for missing harnesses — detection is a
  report, not a gate.

### R4 — probe tooling

- `probe <harness-id>` runs an *installed* harness inline with a minimal
  prompt (e.g. "list your skills" / "summarize the AGENTS.md") so the user can
  observe whether the harness actually picks up the playground's `AGENTS.md`
  and skills.
- Skips missing harnesses with a clear message; never attempts install.
- Commands are discovered per harness (a small per-harness probe map), kept
  terse, and clearly marked as a *manual verification aid* — not an assertion.
- For Cursor the probe invokes the headless `agent -p … --mode ask --trust
  --workspace <dir>` form; this is also the verification of the open item in
  "Cursor: headless CLI, not the IDE".

### R5 — nix flake

- `flake.nix` with `devShells.default` provisioning the npm-installable
  harnesses at their pinned versions from `harness-versions.json`.
- Cursor is provisioned via a **Community FHS wrapper** (`buildFHSUserEnv`)
  running the curl installer — see "Cursor: headless CLI, not the IDE". If the
  wrapper proves unreliable, Cursor degrades to detection-only without
  blocking the shell.
- Entering the shell yields all provisioned harnesses on `PATH`, alongside
  `node` (for the harness-hub CLI itself).
- **The shell is a prerequisite, not an option (R9).** Scenario/playground
  runs must happen inside `nix develop` so the pinned harnesses — not any
  pre-existing install — are the ones observed.

### R6 — playground folder

- `playground/` is git-ignored by the outer harness-hub repo (already in
  `.gitignore`).
- Setup (`npm run setup`) performs, idempotently:
  1. `git init` inside `playground/` (the nested-repo step from "Background");
  2. `npm link` the harness-hub CLI so `harness-hub` is on `PATH` inside it.
- **Layout: a single default playground, not a managed subfolder tree.** The
  generator's `--target <dir>` flag already lets scenarios render anywhere
  (tmp dirs for integration tests; ad-hoc `playground/scenarios/<name>/`
  directories when you want to keep several around simultaneously). We do not
  build first-class subfolder management now — that is the over-engineering.
- `playground/package.json` exposes npm scripts (replacing the incorrect
  `test-commands.sh`). Scripts that observe harness behavior run through
  `nix develop` (R9):

  ```json
  {
    "scripts": {
      "setup": "sh setup.sh",
      "generate": "node ../tools/generate.mjs",
      "scenario": "node ../tools/generate.mjs",
      "detect": "node ../tools/detect.mjs",
      "probe": "node ../tools/probe.mjs",
      "reset": "git clean -fdX .",
      "shell": "nix develop"
    }
  }
  ```

- `harness-hub enable <harness-id>` is invoked directly with correct syntax
  (harness ids, not skill names).

### R7 — nothing committed

- No file under `playground/` is ever tracked by the outer harness-hub repo.
- The *tooling* (generator, detection, probe, flake, manifest) is committed
  and lives outside `playground/`.

### R8 — `harness-hub list` and `harness-hub info <harness>`

First-class runtime CLI commands exposing the harness registry. Distinct from
the dev-only `detect`/`probe` tooling (which probe the *environment*): these
commands report what harness-hub *knows* about harnesses, statically, from the
registry — they work anywhere, with no harnesses installed.

- `harness-hub list` — a table of all harnesses: id, display name, version
  (from the registry's `verifiedVersion`), and wiring convention summary
  (agent-doc mode, skills mode, trust gate). Sorted by id.
- `harness-hub info <harness>` — detail for one harness: everything `list`
  shows plus the full wiring convention (symlink paths, trust-gate details,
  trust command). Unknown id → clear error naming the valid ids (reuses
  `isHarnessId` / the same validation as `enable`/`disable`).
- Both are read-only and reflect registry state; they are the "static
  introspection" complement to the playground's "live environment probing"
  (`detect`/`probe`). `detect` may call `harness-hub list` and annotate it with
  installed-version data.
- Version data shown is sourced from the registry (which R1 derives from
  `harness-versions.json`), so `list`/`info` cannot drift from the manifest.

### R9 — the nix devShell is a prerequisite for *harness observation* (playground & integration tests only)

This check applies **only to the playground and the future integration tests**.
General users of `harness-hub` are **not** expected to run `nix develop` — the
nix shell is our own controlled environment for observing harness behavior
deterministically, not a requirement placed on end users.

Pre-existing, unpinned harness installs (e.g. `opencode 1.16.2` on `PATH`
today versus the 1.18.31 pin) would make scenario/probe results misleading:
the harness-hub rules are researched against specific versions
(`harness-versions.json`), so observing *some other* version is exactly the
confusion we want to avoid.

- In the **playground** and **integration tests**, scenario generation,
  `probe`, and any `harness-hub enable/doctor/…` run whose purpose is to
  observe harness behavior must happen **inside `nix develop`**, so the pinned
  harnesses shadow pre-existing installs on `PATH`.
- The playground setup script (`setup.sh`) and the observation entrypoints
  (`detect`, `probe`) check for the shell and, when it is absent, either (a)
  refuse with a clear "run `npm run shell` / `nix develop` first" message, or
  (b) re-exec themselves inside `nix develop`. Exact behavior (refuse vs
  auto-enter) is an implementation detail fixed in the plan; the invariant is
  that **unpinned harnesses are never silently observed**.
- `nix develop` is optional for work that does not observe harness behavior
  (e.g. pure asset generation, `list`/`info`, `detect`'s report of *what's on
  the host* when that's the explicit intent).

### R10 — rule & finding name renames (in scope)

To keep `doctor` output, scenario names, and future rule additions unambiguous,
the finding `ruleId`s are made **specific** — one `ruleId` per failure
condition, rather than one per rule object. This is a runtime change to
`src/doctor/rules/*` and is in scope for this deliverable.

Naming conventions applied (mirroring R2b):

- Finding `ruleId` names the **specific condition**, not the rule category.
- Harness-scoped findings are **prefixed with the harness id**; canon-wide
  findings are not.
- Where the finding is already specific, it is kept as-is.

| Rule (`id`) | Current finding `ruleId` | Renamed finding `ruleId` |
|---|---|---|
| `clobber-risk` | `clobber-risk` (both branches) | `claude-md-clobber` (agents-doc branch) · `claude-skills-clobber` (skills branch) |
| `config-validity` | `config-validity` (all four) | `config-ambiguous` · `config-parse-error` · `config-invalid-shape` · `config-unknown-harness-id` |
| `skill-shape` | `skill-shape` (both branches) | `skill-flat-file` · `skill-missing-skill-md` |
| `skill-frontmatter` | `skill-frontmatter` (all issues) | `skill-missing-name` · `skill-invalid-name-format` · `skill-name-mismatch` · `skill-missing-description` · `skill-description-length` |
| `generated-file-drift` | `generated-file-drift` | `claude-drift` |
| `trust-gate` | `hermes-trust` | `hermes-trust` (already specific — unchanged) |
| `canon-presence` | `canon-presence` | `canon-presence` (single condition — unchanged) |
| `skill-migration` | `unmigrated-skills` · `skill-migration-collision` | unchanged (already specific) |

The rule object `id` (the `DoctorRule.id` field) is **left unchanged** — it is
the rule's own stable identifier. The rename touches only the `ruleId` emitted
on `Finding` objects (the value shown in `doctor` output and matched by code).

**String-match audit (so renames don't silently break behavior):** the values
being renamed are consumed in three places in non-test code:

1. `src/commands/enable.ts` matches `f.ruleId === 'generated-file-drift'` to
   detect drift and re-wire — must become `claude-drift`.
2. `src/cli.ts` `--force` help text and `src/commands/migrate.ts` error text
   mention `clobber-risk` as prose — updated to the specific names for
   accuracy (cosmetic, user-facing).
3. `src/doctor/rules/*.test.ts` assert on the old `ruleId` strings — updated to
   the renamed values (tests are the rename's proof).

No persisted config, ledger, or generated-file content depends on these
strings, so the rename is source-only plus its test assertions.

## Location decisions

| Artifact | Location |
|---|---|
| `harness-versions.json` | repo root (adjacent to `package.json`) |
| Generator / detection / probe source | top-level `tools/` with its own `tsconfig.json` |
| Scenario modules | `tools/scenarios/` |
| Thin CLI entrypoints | `tools/generate.mjs`, `tools/detect.mjs`, `tools/probe.mjs` |
| `list` / `info` commands | `src/commands/list.ts`, `src/commands/info.ts` (runtime CLI, not `tools/`) |
| Nix flake | repo root `flake.nix` |
| Playground | `playground/` (git-ignored, own `.git`) |

Rationale: the tooling is dev-only and reused by the integration-tests
deliverable, so it lives in a stable, committed, importable location
(`tools/`) rather than inside the git-ignored playground. `tools/` is excluded
from the npm `files` array so it never ships in the published package.
`list`/`info` are runtime product surface and therefore live in `src/`,
shipping in the published package.

## Success criteria

1. `harness-versions.json` exists and `src/registry/data.ts` derives versions
   from it (no drift possible).
2. `npm run generate -- <scenario>` renders each scenario into the playground
   reproducibly and idempotently.
3. `npm run detect` reports installed vs pinned versions for all seven
   harnesses.
4. `npm run probe -- <harness-id>` runs an installed harness inline against
   the playground, visibly picking up (or failing to pick up) its assets.
5. `nix develop` yields the pinned harnesses on `PATH` (Cursor via the FHS
   wrapper, or detection-only if that proves unreliable).
6. Running `harness-hub doctor` / `enable` / `disable` from inside the
   playground resolves the playground as its own repo (nested `.git`), and
   `git status` in the outer repo shows no playground files.
7. The incorrect `test-commands.sh` and its fake sample assets are removed,
   replaced by the real tooling and corrected scripts.
8. `harness-hub list` and `harness-hub info <harness>` work with no harnesses
   installed, reading version data from the registry.
9. Running `detect`/`probe`/scenario observation outside `nix develop` is
   refused (or auto-re-executed inside the shell) rather than silently
   observing unpinned harnesses (R9) — in the playground/integration-tests
   only, never a requirement on general users.
10. `doctor` output emits the renamed, specific finding `ruleId`s (R10), the
    `enable` drift check matches `claude-drift`, and all rule tests pass
    against the renamed values.

## Non-goals

- No changes to harness-hub wiring logic or doctor *check semantics* (the
  runtime change is limited to the additive `list`/`info` commands and the R10
  finding-id renames — no behavioral changes to what each rule detects).
- No integration-test assertions (separate deliverable).
- No published-package impact from `tools/` (`tools/` excluded from `files`).
- If the FHS wrapper for Cursor proves unreliable, Cursor provisioning degrades
  to detection-only; making the wrapper robust is not a goal of its own.
