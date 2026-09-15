# AGENTS.md Templating — Specification (First Draft)

**Status:** draft — model settled in the wiring-spec session (2026-09-15); implementation decisions here, per-asset discovery research stays in the wiring deliverable's insight files
**Date:** 2026-09-15
**Extracted from:** [`../2026-09-14-2211-harness-hub/harness-wiring.spec.md`](../2026-09-14-2211-harness-hub/harness-wiring.spec.md) §14.8 (where it was recorded as a settled direction)
**Depends on:** the wiring deliverable (`harness-hub` CLI, wiring spec §12 generated-file conventions, doctor infrastructure). Design proceeds after wiring ships; this spec owns the details.

---

## 1. Purpose

Give authors optional tooling to construct a concise, well-ordered `AGENTS.md`
— the file every harness consumes — without forking the asset per harness.

Goals:

1. **Concise conventions.** Express what matters: what the repo is/does,
   important git and branching context, where supporting docs live.
2. **Most-important-first.** Front-load critical guidance — this is
   truncation defense, not aesthetics (Hermes truncates 70% head / 20% tail;
   Codex drops the tail past 32 KiB — see the wiring deliverable's
   `harness-agent-doc.insight.md`).
3. **Generated ToC.** Build a table of contents / supporting-docs index from
   the docs the template references, rendered at render time.
4. **One flat output.** The rendered `AGENTS.md` is plain markdown, consumed
   identically by all seven harnesses.

### Non-goals

- **No discovery-rule DSL.** Plain markdown references in the *rendered
  output* remain the portable discovery convention (wiring spec §10). The
  template composes; it does not describe harness behavior.
- **No per-harness conditionals in the doc.** Render inputs must stay
  **harness-agnostic** (repo facts only). A `{{ if claude }}` fork in the
  template would fork the one asset that must be identical across harnesses —
  per-harness variation is the adapters' job, never the doc's.
- **No content authoring by harness-hub.** The user authors template + values;
  harness-hub renders and manages the output artifact.

## 2. Authorship modes

Canon follows authorship mode — nothing is ever both canon and generated:

| Mode | Canon | Generated | Compat with wiring spec promises |
|---|---|---|---|
| **Self-authored** (default, current) | `AGENTS.md` itself | nothing | wiring spec §4/§12 "canon never modified" stands untouched |
| **Templated** (optional, opt-in) | `template + values` | rendered `AGENTS.md` | rendered doc joins the wiring spec §12 generated-file contract (marked, regenerable, never hand-edited) |

Switching modes is explicit: adopt-templating (self-authored doc becomes the
initial template/values) and un-template/adopt-back (rendered output becomes
self-authored canon again; template machinery removed). Neither runs as a side
effect of `enable`/`disable`.

## 3. Engine & inputs — deliberately undecided

The template engine, data format for values, and file layout are **not
chosen yet** — they wait for the tooling/software/libs research pass that the
wiring spec defers (§14.5 there; this spec inherits the deferral). What is
settled is what the engine must *support*:

- Variables and composition (includes/partials) — the mechanism behind
  render-time expansion (§5).
- Loops/iteration — required for ToC generation from referenced docs.
- Deterministic, byte-idempotent output (§4) — no timestamps, stable ordering.
- Sandboxing/limits appropriate for rendering a file that agents consume.

**Layout (tentative shape, names TBD):**

  ```
  repo/
    AGENTS.md                    # rendered output (generated, wiring-spec §12 contract)
    .ai/
      agents-md/
        <template>               # template (canon)
        <values>                 # values (canon)
  ```

- Config in `harness-hub.json` gains an `agentsMd: { templated: true }` key.

## 4. Rendering lifecycle

- **Explicit render command** (name TBD in plan — `harness-hub render`):
  regenerates `AGENTS.md` from template + values on demand.
- **Pre-flight integration:** `enable` and `doctor` run the render as a
  pre-flight step and flag **render drift** — template/values changed since
  last render, or output stale — as a new doctor check (mirrors the copy-drift
  check for skills/commands).
- **Lifecycle:** the rendered doc is consumed by *all* harnesses, so
  `disable <harness>` must **not** remove it. It leaves only via the explicit
  un-template/adopt-back action (§2).
- **Idempotence:** re-render with unchanged template + values produces a
  byte-identical file (stable ordering everywhere; no timestamps in output).

## 5. Why templating earns its place

- **Render-time expansion is the portable answer to the import problem.**
  `@path` imports expand in Claude Code only (`harness-agent-doc.insight.md`);
  harness-hub expands composition *before any harness sees the file* — every
  harness consumes flat markdown.
- **ToC generation** from referenced docs (wiring spec §10's referenced-docs
  convention) is the piece hand-maintaining a doc does badly and a render step
  does trivially.
- **Structure discipline** (purpose, git/branching context,
  most-important-first) gets scaffolded by the template instead of negotiated
  per repo.

## 6. Open questions

1. **Command name & surface** — `render` vs `build`; flags (e.g. `--check`
   for CI drift detection).
2. **Engine, values format & layout** — pick via the tooling research pass
   (with the wiring deliverable's), against the §3 requirements; includes
   whether values are free-form or a light required set (`purpose`,
   `git.branching`) that drives the default template.
3. **Include boundaries** — can templates include files outside
   `.ai/agents-md/` (e.g. pull a summary from `docs/`)? Symlink-escape and
   Windows concerns mirror wiring spec §13.12.
4. **Doctor severity** — render drift: error or warning?
5. **Adopt-back mechanics** — how un-template rewrites history-free canon
   (straight copy vs cleaned-up render).
