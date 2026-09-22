# Harness Version Management & Testbed Specification

Status: draft — ready for review

Supporting documents (same folder):
- [`scenarios.md`](./scenarios.md) — the convention-verification scenario suite.
- [`evidence-and-judges.md`](./evidence-and-judges.md) — the evidence ladder,
  canary discipline, judge backends, and confidence report.
- [`gateway.md`](./gateway.md) — the LLM gateway (Level-1 evidence) subsystem.
- [`agentfill.insight.md`](./agentfill.insight.md) — research note on a related
  tool and its gaps.

## Purpose

Turn harness-hub from a *snapshot* of "what we verified, once" into a system that
can **track harness releases over time, re-verify conventions against specific
versions, and record the handling mechanics per version range**. This is the
project's actual product surface: harnesses change behavior between releases, so
the repo must (a) periodically detect when an upstream release diverges from what
we've verified, (b) review the divergence, and (c) record the resulting mechanics
as data — not ad-hoc code edits.

Four coupled subsystems deliver this:

1. **Registry version-range model** (R1) — replace the single-point
   `verifiedVersion` with an ordered list of semver *ranges*, each bound to a
   named convention *profile* and a verification status.
2. **Docker testbed** (R2) — an instrument that runs a **specific harness
   version** headlessly to produce review evidence.
3. **Integration scenario framework** (R6) — reusable convention-verification
   scenarios that *prove* a convention works by observing a side effect (a file,
   a symlink, a config change), not by trusting the harness's self-report.
4. **Reconcile tool** (R3) — the trigger: compare upstream latest against the
   covered ranges, and write the outcome of a review back into `config.json`.
5. **LLM gateway** (R7) — optional strongest evidence source: capture the actual
   prompt/context sent to the model.

A core design line runs through all of it: **the system collects evidence and
produces a report; a human makes the call.** Automation stops at report
generation — flipping a range from `unverified` to `verified` is always an
explicit human action (`reconcile --record`), never an automated gate. Harness
behavior is stochastic, so no single pass/fail can be trusted to decide
`verified`; the evidence ladder exists to raise confidence, not to replace
judgment.

## Background & constraints

- The runtime CLI (`src/`) already consumes a manifest (`config/config.json`,
  nested `harness.versions`) and a hardcoded convention registry
  (`src/registry/data.ts`): per harness-id, an `agentsDoc` mode
  (`native` | `symlink`), a `skills` mode (`native` | `migrate-symlink`), and an
  optional `trustGate`. Today there is **no link** between "conventions verified
  at version X" and "conventions valid at version Y" — a harness bump silently
  reuses old mechanics until a human notices.
- The harnesses are **CLI-first**: the "GUI/TUI" is a terminal frontend over the
  same engine binary. Headless invocation (`claude -p`, `codex exec`,
  `opencode run`, `hermes run`, `pi -p`, `dsh run`, cursor's `agent -p`)
  exercises the same engine that reads AGENTS.md / `.agents/skills`. This is the
  core assumption that makes headless testing a valid stand-in for GUI/TUI
  behavior.
- **Cursor is the known exception**: its IDE and its `agent` CLI are *different
  products* with different permission/trust surfaces. The registry models them
  as **two separate harness entries** — `cursor` (the IDE) and `cursor-cli` (the
  headless `agent` CLI) — each with its own ranges, profile, and review modality
  (R5). Research (Cursor docs + [agentfill](https://github.com/nevir/agentfill))
  shows skills are native in *both* surfaces (`.agents/skills/`), but `AGENTS.md`
  auto-load is verified for the IDE and **disputed/not auto-preloaded** on the
  CLI — so the two surfaces must not be collapsed into one assumption.
- GUI-only surfaces (a future skill picker, a GUI trust dialog) are invisible to
  headless testing; they are out of scope for automated review but are covered
  by the manual review modality (R5).
- Docker is chosen as the testbed mechanism because it can pin **exact versions
  with zero hashes** (`npm i -g pkg@x.y.z` → tagged image), giving the version
  *matrix* that a single nixpkgs lock cannot provide. Nix is *not* the pinning
  instrument here; its reproducibility model (one lock, all packages move
  together) is the wrong shape for "compare 0.154.0 vs 0.155.0 side-by-side".
- The daily-driver interactive workflow (a human *using* a harness for an hour)
  stays native, not containerized — Docker serves the **review** and **CI**
  loops, not the interactive loop.

## Terminology

- **Harness id** — the stable key, from `src/harnesses.ts`. The set grows from
  seven to eight: `claude-code`, `cursor`, `cursor-cli` (new), `opencode`,
  `codex`, `hermes`, `pi`, `deepseek`. `cursor` is the IDE; `cursor-cli` is the
  headless `agent` CLI.
- **Convention profile** — a named, typed bundle of conventions (agentsDoc mode,
  skills mode, optional trustGate) living in code. Example:
  `claude-code-symlink-v1`.
- **Version range** — a semver bound (`min`, `max`, `max` nullable = open-ended)
  assigned to one profile, with a status and a `verifiedDate`.
- **Status** — one of:
  - `verified` — we've confirmed the profile holds across the range;
  - `unverified` — upstream is in this range but we have not re-verified yet;
  - `unrecognized` (a resolution outcome, not a stored status) — the installed
    version matches **no** range. This is deliberately distinct from
    `unverified`: `unrecognized` means the version could not be determined at
    test time (possibly a future release we've never seen), whereas `unverified`
    means "known to be in range, but not yet reviewed".
- **Testbed** — the Docker-based instrument that runs a pinned harness version
  headlessly.
- **Scenario** — a reusable convention-verification procedure (see
  [`scenarios.md`](./scenarios.md)).
- **Runner** — who executes a scenario's prompt: `container` (automated) or
  `human` (manual).
- **Evidence ladder** / **Judge** — see
  [`evidence-and-judges.md`](./evidence-and-judges.md).

## Detailed requirements

### R1 — registry: profiles in code, ranges in data

**Convention profiles stay in code.** Add a typed profile registry (extend
`src/registry/data.ts` or a sibling) mapping `profileName → { agentsDoc, skills }`
(the existing per-id blocks become named profiles). Code-shaped because
conventions encode behavior (`symlink` vs `native`, `migrate-symlink`), which
wants type safety and compile-time exhaustiveness.

**Version ranges move into `config/config.json`.** Each harness entry replaces
the single `version`/`verifiedDate` with an ordered `ranges` list:

```json
"codex": {
  "displayName": "Codex",
  "install": { "method": "npm", "package": "@openai/codex" },
  "ranges": [
    { "profile": "codex-native-v1", "min": "0.139.0", "max": "0.155.0",
      "status": "verified", "verifiedDate": "2026-09-03" },
    { "profile": "codex-native-v1", "min": "0.155.0", "max": null,
      "status": "unverified" }
  ]
}
```

- `min` inclusive, `max` exclusive (semver ranges), `max: null` = open-ended.
- `ranges` is ordered (lowest first); resolution finds the **first** range whose
  bounds contain the installed version, else "unrecognized".
- A `caveat` string is optional per range (used by `cursor` to record the
  "CLI ≡ IDE" assumption explicitly).
- `review` is an optional per-range field (R5): `automated` or `manual`.

**Resolution contract.** A shared resolver (used by `list`/`info`/`doctor` and
the test tooling) maps `(harnessId, installedVersion) → { profile, status }`:
- in-range + `verified` → `verified`;
- in-range + `unverified` → surfaced as "unverified (upstream moved)";
- no matching range → "unrecognized" (treated like today's unknown-id in
  `doctor`, but per-version).

**Compatibility.** The runtime registry (`HARNESS_REGISTRY`) must keep producing
its existing `HarnessEntry` shape (`displayName`, `verifiedVersion`,
`verifiedDate`, `agentsDoc`, `skills`) so `list`/`info` output does not
regress — `verifiedVersion` becomes "the newest `verified` range's `max` (or
`min` when open-ended)".

### R2 — Docker testbed (the instrument)

**Image identity.** One image per harness, tagged by exact version:
`harness-hub/<harness>:<version>` (e.g. `harness-hub/codex:0.155.1`). A generator
derives the Dockerfile from the harness's `install` method in `config.json`:
- `method: npm` → `npm install -g <package>@<version>` (exact, no hashes);
- `method: prebuilt-binary` (new method) → curl of the tagged release URL;
- `method: git` / other → the harness's own install path (e.g. hermes `git`).

**Runtime contract.** A thin CLI (`testbed`) with the session semantics already
in use:

```
testbed run     <harness> <version> --prompt "…"            # one-shot headless
testbed session <harness> <version> --resume <id> --prompt  # stateful
testbed matrix  <harness> --versions a,b --prompt "…"       # N versions, diff
```

Headless commands come from the existing `PROBE_COMMANDS` map and stay the
single source of truth, extended with session forms (`claude -p --cloud
--session <id>`, `opencode run --continue/--session <id>`, `cursor agent -p
--mode ask --trust --workspace`).

**State & credentials.** Session/trust state lives in `$HOME`; the contract must
mount it first-class (bind-mountable state dir, auth env-var forwarding) so
`session`/`--continue` testing cannot silently lose the trust ledger or session
identity.

**Two modes, one image.** `playground` (manual `-it`) and `integration`
(scripted, CI) use the same image with different orchestration.
Image-tag-per-version is canonical from day one.

**Runner interface.** The testbed is one of two scenario runners (R6); it
executes a scenario's prompt in a container for a pinned version and returns the
resulting repo state for predicate evaluation. The other runner is `human` (R5).

**macOS cost.** Bind-mount metadata perf on `aarch64-darwin` is accepted: the
testbed is for occasional headless review, not the interactive daily driver.

### R3 — reconcile tool (the trigger)

A `test/tools/reconcile` CLI (thin `.mjs` shim + `reconcile.ts` core) that
closes the loop:

- **`reconcile --check`** — for each harness, query upstream latest via its
  `install` method (`npm view <package> version`; `git ls-remote` / release URL
  for prebuilt; `brew info` for brew) and report "latest vs covered ranges" as a
  table; **non-zero exit when any harness's latest falls outside a `verified`
  range** (CI-able drift gate).
- **`reconcile --record <harness> <version>`** — after a review has completed
  (automated or manual), write the outcome back into `config.json`: either flip
  an `unverified` range to `verified` (with `verifiedDate` = today) or add a new
  range row. This is the only path that mutates `config.json`.

### R4 — product surface

- `list`/`info` gain a status signal per harness (verified / unverified /
  unrecognized) derived from the installed version vs ranges; no other output
  change.
- `doctor` gains a rule: installed version outside any `verified` range → warn
  with remediation ("run `reconcile --check`, then review the version — see
  [`scenarios.md`](./scenarios.md)").

### R5 — review modalities: automated vs manual (one scenario, two runners)

Ranges carry a `review` mode selecting which **runner** executes the scenario
suite. The scenario, predicate, and report are identical; only who executes the
prompt differs.

- **`automated`** — headless-capable harness; scenarios run in the Docker testbed
  (`container` runner). Applies to `claude-code`, `opencode`, `codex`, `hermes`,
  `pi`, `deepseek`, and `cursor-cli`.
- **`manual`** — a GUI/IDE surface (`cursor`). The `human` runner drives the
  same scenario:
  1. print the scenario's setup (files to create) and prompt to copy-paste;
  2. the human performs the setup + pastes the prompt into the IDE;
  3. the human signals completion once the harness has acted;
  4. the framework re-snapshots the repo and evaluates the same predicate;
  5. the result feeds the same report as the automated path.

The manual flow is **not a separate testing framework** — it is the same
scenario with a human in the execution slot. For gateway evidence (R7), the
human additionally points the IDE's custom OpenAPI-compatible model endpoint at
the harness-hub gateway (Cursor IDE supports this), so even GUI surfaces can
yield Level-1 evidence — see [`gateway.md`](./gateway.md).

### R6 — integration scenario framework

See [`scenarios.md`](./scenarios.md) for the scenario schema and suite, and
[`evidence-and-judges.md`](./evidence-and-judges.md) for the evidence ladder,
canary discipline, judge backends, and confidence report. Summary of contracts:

- **Scenario** = setup (files + optional canary) → prompt → deterministic
  `predicate(delta)` → optional `rubric` → `evidenceLevels`.
- **Runner** = `container` | `human` (R5).
- **Evidence ladder** = Level 1 gateway → Level 2 canary → Level 3 behavioral →
  Level 4 self-reported/rubric (details in the supporting doc).
- **Judge** = pluggable backend for rubric scoring (deterministic / human /
  LLM / structured-model), always optional.
- **Report** = per-version assembly of scenario results + evidence levels hit +
  confidence scores; advisory only, input to the human's `--record` decision.

### R7 — LLM gateway (Level-1 evidence)

See [`gateway.md`](./gateway.md) for the design. Summary: use **LiteLLM** (an
MIT-licensed, self-hosted, OpenAI-compatible proxy that logs every request and
already speaks Anthropic `/v1/messages` + OpenAI `/v1/chat/completions` +
`/v1/responses`) to capture the actual prompt/context sent to the model, so "was
AGENTS.md/skills in the request?" gets a ground-truth answer. A thin harness-hub
wrapper adds the convention-content inspection over LiteLLM's logged requests.
Ships inside the Docker testbed by default; for the Cursor IDE, the human points
the IDE's custom endpoint at the proxy and a self-test confirms the wiring.

## Target layout (net-new)

```
test/
  tools/
    reconcile.ts / reconcile.mjs   # new (R3)
    testbed.ts   / testbed.mjs     # new (R2) — container runner
    scenarios/                     # new (R6) — scenario definitions
    judge.ts                       # new (R6) — pluggable judge backends
    report.ts                      # new (R6) — confidence report assembly
    gateway.ts / gateway.mjs       # new (R7) — LLM gateway
  testbed/
    Dockerfile.<harness> template  # generated; git-ignored artifacts, committed templates
config/config.json                 # ranges replace single version (R1)
src/registry/
  profiles.ts                      # named convention profiles (R1)
  resolve.ts                       # (harnessId, version) → { profile, status } (R1)
  # The resolver lives in src/registry/ (product surface); test/tools/ imports it.
```

## Non-goals

- No GUI/IDE harness **automated** review — `cursor` is `manual` review only
  (R5); only `cursor-cli` is automated.
- No change to the interactive daily-driver workflow (stays native; nix devShell
  may remain for that, but not part of this deliverable).
- No actual upstream reviews are performed by this deliverable — it builds the
  *mechanism* to perform them. (The codex 0.155.x re-review is a follow-up.)
- The exact-pin question is answered by Docker (`npm i -g pkg@x`), not by nix
  overrides or per-harness nixpkgs inputs.

## Success criteria

1. `config.json` expresses ranges; `src/registry/resolve.ts` maps an installed
   version to `{ profile, status }`, and `list`/`info` surface verified vs
   unverified vs unrecognized without regressing existing output.
2. `testbed run/session/matrix` can execute a pinned version headlessly for at
   least `codex` and `claude-code`, honoring session/credential state.
3. A scenario suite exists covering AGENTS.md-load, skill-wiring,
   skill-invocation, skill-scoping, and the hermes trust gate (see
   [`scenarios.md`](./scenarios.md)); the framework produces a per-version
   confidence report.
4. `reconcile --check` exits non-zero when a harness's upstream latest is outside
   its `verified` ranges, and `--record` writes back a reviewed version.
5. The `manual` (`human`) runner executes the same scenarios for `cursor` without
   deploying a container, while `cursor-cli` runs them automatically.
6. Full test suite, `typecheck`, and `build:tools` remain green.

## Decomposition into implementation plans

This spec is deliberately one document but **decomposes into four plans** (each
owning one subsystem and its own supporting doc):

- **Plan A — registry ranges** (R1, R4): `config.json` ranges, `profiles.ts`,
  `resolve.ts`, the `list`/`info`/`doctor` status wiring.
- **Plan B — testbed + scenario framework** (R2, R3, R5, R6): Docker images,
  `testbed`, scenario suite, runners, report assembly.
- **Plan C — judges** (R6 judge layer): pluggable judge backends, rubric schema,
  confidence assembly, the optional structured-model adapter.
- **Plan D — gateway** (R7): the LLM passthrough gateway + its dialect
  adapters + runner integration.
