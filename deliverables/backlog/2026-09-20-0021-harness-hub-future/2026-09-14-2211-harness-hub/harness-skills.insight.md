# Skills — harness discovery research

**Type:** research insight · one of the per-asset insight files for harness-hub.
**Companion spec:** [`harness-wiring.spec.md`](./harness-wiring.spec.md) — implementation decisions live there.
**Asset:** `SKILL.md` directories (Agent Skills standard, [agentskills.io](https://agentskills.io)).
**Researched against the harness versions in** [`harness-versions.insight.md`](./harness-versions.insight.md).
**Re-verified 2026-09-15:** OpenCode skill slash-invocation + compat directories; Claude Code's continued absence of `.agents/skills/` support.
**Re-verified 2026-09-20:** Hermes project-local skills. Previously flagged
"unverified"; confirmed shipped (project-local skills epic, PR #88566,
completed by v0.20.4/2026-08-18 — predates the pinned 0.21.2 research
checkpoint in `harness-versions.insight.md`, so the fix was simply
under-researched, not unreleased). Hermes now reads `.agents/skills/` and
`.hermes/skills/` from the nearest git root, gated behind a one-time
per-repo `hermes skills trust` — details below and in the updated matrix
row/Mechanics sections.

This document is a **research insight, not a decision record**. Each mechanic
below describes how harnesses vary in handling it and what harness-hub would
need to account for — the choice of how harness-hub handles each mechanic
belongs in the spec.

## Matrix

A lightweight per-harness summary focused on **discovery**. Other mechanic
concerns (scoping, invocation, permissions) get their own columns with terse
entries; the deep dive lives in the Mechanics sections below.

| Harness | Terminology | Discovery | Scoping | Model invocation | User invocation | Permissions | Caveats |
|---|---|---|---|---|---|---|---|
| Claude Code | Skills (legacy commands merged in) | `.claude/skills/<name>/SKILL.md` in the start dir + every parent up to repo root; nested `.claude/skills/` load **lazily** on first file touch in the subtree; `--add-dir` dirs' skills load too | `paths` globs gate auto-activation | Default; `disable-model-invocation: true` opt-out (honored) | Slash `/name` (skills win collisions with legacy commands) | *(none per-skill)* | Does **not** read `.agents/skills/` ([#31005](https://github.com/anthropics/claude-code/issues/31005) open — Anthropic created the standard it skips); watches skill dirs but change detection covers `SKILL.md` only |
| Cursor | Agent Skills | `.cursor/skills/`, **`.agents/skills/`**, compat `.claude/skills/` + `.codex/skills/`; nested project dirs auto-scoped; category folders OK (walks down to `SKILL.md`) | `paths` globs gate auto-activation | Default; `disable-model-invocation: true` opt-out (honored) | Slash (commands legacy; `/migrate-to-skills`) | *(none per-skill)* | Multiple compat roots make same-name duplicates possible |
| OpenCode | Skills | `.opencode/skills/` + compat `.claude/skills/` and **`.agents/skills/`** (project: walk-up from cwd to worktree root; global equivalents of all three) | *(no key exists)* | Default; `metadata.opencode/autoinvoke: "false"` opt-out | **Every skill is slash-invocable** (`/name`, trailing text becomes the user request) | Per-skill `allow`/`deny`/`ask` in `opencode.json` | Knobs: `slash: false` hides from slash catalogs; HTTP-catalog skills pin by `version`; V1/V2 behavior split — verify the train before trusting details |
| Codex | Skills ("reusable workflows") | **`.agents/skills/`** (walk cwd → repo root), `$HOME/.agents/skills/` (user) | `[[skills.config]]` per-path disable in `config.toml` | Default; **ignores `disable-model-invocation`** — sidecar `allow_implicit_invocation: false` is the only opt-out | `$skill-name` (always works); UI metadata in `agents/openai.yaml` sidecar | Sidecar `policy.allow_implicit_invocation` | Same-name skills across levels are **not merged** — both appear in selectors |
| Hermes | Skills (hub/install model + project-local) | `~/.hermes/skills/` (primary, read-write); **`.agents/skills/` and `.hermes/skills/`** from the nearest git root, **trust-gated** (`hermes skills trust`, one-time per repo); `external_dirs` in `~/.hermes/config.yaml` for other shared roots | `platforms` (bare top-level); `metadata.hermes.{requires_toolsets,requires_tools,fallback_for_toolsets,tags,related_skills,config}` | Default; platform/tool gating via frontmatter | Auto-exposed as slash commands (up to 5 chained) | Declared config settings stored under `skills.config`; project skills are read-only to autonomous maintenance | Project skills are **highest-precedence** (project → local → external_dirs); scan-quarantined at load time (same scanner as hub installs); untrusted repos get a one-line banner notice, never auto-load |
| Pi | Skills (`/skill:name`) | **`.agents/skills/`** (cwd + ancestors to git root; project load **gated on trust**), `.pi/skills/`, `~/.pi/agent/skills/`, `~/.agents/skills/`, packages, settings, CLI | *(no key exists)* | Default; `disable-model-invocation: true` honored | `/skill:name` (leading or mid-prompt; args pass through) | *(none per-skill)* | Implements the Agent Skills standard; lenient — notably allows `name` ≠ directory name |
| DeepSeek | Skills | **`.agents/skills/`**, `.dsh/skills/`, `~/.dsh/skills/`, `~/.agents/skills/` | *(no key exists)* | Default | Slash (skills are the command surface) | *(none per-skill)* | Skills are a plugin capability; developer-preview harness — re-verify every claim on touch |

## Mechanics

Each mechanic is a distinct concern with real variability across harnesses.
Descriptions are research, not decisions.

### Discovery & directory layout

**The shared `.agents/skills/` convention.**
`.agents/skills/<name>/SKILL.md` is the emerging cross-harness location: read
natively by Codex (cwd→repo-root walk, plus `$HOME/.agents/skills/`), Cursor,
Pi (cwd + ancestors, trust-gated), DeepSeek, OpenCode (compat source), and
**Hermes** (nearest git root, trust-gated — confirmed 2026-09-20, previously
unverified). The holdout is Claude Code, which reads only `.claude/skills/`
despite Anthropic having created the standard. Consequence for canon design:
skills canon at `.agents/skills/` wires every harness except Claude Code with
zero generated files; Claude Code becomes the sole divergent harness. Once
Claude Code copies exist alongside canon, compat readers (Cursor, OpenCode)
see each skill from two roots — content-identical duplicates make that
benign.

**Hermes's trust gate is a genuine wiring consideration, not just a caveat.**
Unlike every other native reader, Hermes discovers `.agents/skills/` but
refuses to *load* it until a human runs `hermes skills trust` inside the
repo (once per clone, stored in that user's `~/.hermes/config.yaml` — a
per-machine decision, not repo state). This is deliberate: skills are
executable procedure documents, so Hermes won't auto-run them from an
untrusted clone. A wiring tool cannot and should not automate this decision
away — the honest wiring is still "native" (nothing generated), paired with
a one-time, human-run trust step that's outside the tool's reach entirely
(it can't be verified from repo-local state either, since the trust ledger
lives in the user's home directory, not the repo).

**The folder contract that makes `.agents/skills/` work.** Native multi-harness
discovery only functions if the directory obeys one shared shape — every
harness parses it under the Agent Skills standard's rules, and harness-only
layouts exist precisely outside it:

- **One skill = one directory named for the skill, containing `SKILL.md`.**
  This is the only layout every `.agents/skills/` reader agrees on.
- **Layout features that are NOT portable, and where they'd backfire in canon:**
  - *Flat root `.md` files* (a skill as `foo.md` instead of `foo/SKILL.md`) —
    OpenCode V2 catalogs use them (HTTP-sourced); **Pi silently ignores root
    `.md` in `.agents/skills/`**, so a flat-form skill is invisible there.
  - *Grouped/nested `.md` without directories* — Pi discovers nested
    frontmatter-bearing `.md` in grouping folders, but Codex and Cursor do
    not advertise this; not a safe canon shape.
  - *HTTP-catalog artifacts* (`git-release.md`-style entries whose ID derives
    from the filename, yielding the literal ID `SKILL` for root `SKILL.md`)
    — machine-generated migration inputs, never hand-written canon.
- **Frontmatter contract** — see the frontmatter section below: Tier 1 keys
  per the standard, `name` == directory name, `description` non-empty;
  Tier 2 harness keys ride in `metadata` namespacing or pass through.
- **Supporting dirs** `scripts/` / `references/` / `assets/` with relative
  paths from `SKILL.md` (standard-recommended; any whole-directory transfer
  must preserve them).
- **Validation tooling exists:** `skills-ref validate ./my-skill` (the
  standard's reference library) checks frontmatter and naming conventions —
  the natural engine behind a `doctor` skills-contract check.

Rule of thumb: **canon is the portable subset.** Anything a specific harness
invents beyond the standard belongs in that harness's own directory (or as
pass-through frontmatter), never as the canon shape.

**Walk-up and nesting semantics differ** and constrain where canon can live:

- **Cursor** — nested project skill dirs auto-scope; category folders walked
  to `SKILL.md`.
- **OpenCode** — project walk-up from cwd to the git worktree root.
- **Codex** — cwd → repo root in one pass; user-level separate, same names
  never merged across levels.
- **Claude Code** — start dir + parents to repo root at startup; nested
  `.claude/skills/` load lazily when the agent first touches that subtree.
- **Pi / DeepSeek** — fixed additional roots (`.pi/skills/`, `.dsh/skills/`)
  alongside `.agents/skills/` and user-level.
- **Hermes** — project root is the nearest ancestor directory containing
  `.git` (worktrees and submodules count); reads `.hermes/skills/` and
  `.agents/skills/` there, but only after `hermes skills trust`. Project
  skills outrank local (`~/.hermes/skills/`) and `external_dirs` — the only
  harness where project-scoped skills take precedence over the user's own
  global skills rather than the reverse.

### Scoping

Gating *when* a skill is relevant, beyond plain name/description matching.

- **Claude Code + Cursor** — `paths` frontmatter: glob patterns (comma string
  or YAML list) gating **automatic activation**; the skill auto-loads/surfaces
  only when working with matching files. Explicit invocation is unaffected per
  current docs. Near-identical syntax in both — de facto portable between the
  two, though not part of the standard.
- **Codex** — no frontmatter equivalent; per-path disable via
  `[[skills.config]]` in `config.toml` (a global config mechanism, not a
  per-skill file attribute).
- **Hermes** — `platforms` (bare) plus `metadata.hermes.{requires_toolsets,
  requires_tools,fallback_for_toolsets}` gate by environment rather than by
  file path.
- **Everywhere else** — the only scoping lever is the `description`'s
  "when to use it" clause.

Harness-hub consideration: `paths` is portable between exactly two harnesses;
for the rest, file-path scoping is inexpressible. Any parity handling must
decide whether that divergence is accepted or approximated via description
authoring conventions.

### Model invocation (agent-initiated activation)

Model invocation is the default everywhere: the harness lists `name` +
`description` to the agent, which may load the full skill when the task
matches. The variability is in the **opt-out**:

- **Claude Code, Cursor, Pi** — honor `disable-model-invocation: true`
  (standard-adjacent key); the skill becomes user-invocation-only.
- **OpenCode** — equivalent intent spelled `metadata: { opencode/autoinvoke:
  "false" }`; the skill is omitted from model-facing discovery.
- **Codex** — **ignores** `disable-model-invocation` (verified 2026-09-15);
  the only channel for this intent is the `agents/openai.yaml` sidecar's
  `policy.allow_implicit_invocation: false` (default `true`; explicit
  `$skill-name` invocation always works).
- **Hermes / DeepSeek** — no observed user-only opt-out (Hermes gates by
  platform/tool instead).

Consequence: a "user-only" skill is expressible everywhere, but Codex needs a
non-frontmatter channel; see the intent recipe in the frontmatter section.

### User invocation (slash commands)

"Command" is increasingly an invocation *mode* of a skill rather than a
separate asset:

- **Claude Code** merged custom commands into skills; skills win name
  collisions.
- **OpenCode** makes every skill `/name`-invocable, with trailing text passed
  as the user request; `slash: false` (or `metadata.opencode/slash: "false"`)
  hides it from slash catalogs — the only harness with an *agent-only* knob
  (hidden from users, still model-invocable).
- **Hermes** auto-exposes installed skills as slash commands (up to 5 chained).
- **Pi** registers skills as `/skill:name` commands (leading or mid-prompt;
  args pass through — no prompt-template rendering required for user
  invocation).
- **Codex** — `$skill-name` invocation always works regardless of policy.
- **DeepSeek** — skills are the command surface.
- **Cursor** — commands are legacy; `/migrate-to-skills` converts them.

**Do skills replace commands?** Verdict per harness:

- *Fully covered:* Claude Code (commands merged into skills), Codex, Hermes,
  DeepSeek (skills are the command surface), Cursor (commands legacy;
  `/migrate-to-skills`).
- *Mostly covered:* OpenCode — skills are slash-invocable, but JSON-config
  commands still add `agent`/`model`/`subagent` routing, and legacy
  `.opencode/commands/` keeps positional substitution.
- *Not covered:* Pi — prompt templates (`.pi/prompts/`) remain a separate
  format with `argument-hint`, positional refs, defaults, and slicing. Note
  (verified 2026-09-15): this no longer blocks *user invocation* — skills
  already register as `/skill:name` commands with args; prompt templates only
  add positional substitution and defaults.

The residual gap is positional-argument templating; everything else a command
did, a skill now does. Spec §12.3 is **resolved (2026-09-15): commands
demoted** — legacy wiring survives only for repos that need positional
substitution, and the repo convention is migrate-to-skills. Remaining
verification (OpenCode V1/V2 split) gates any legacy adapters, not the
demotion itself. Hermes project-local skill dirs were the other item in this
list — verified 2026-09-20 (see the Discovery & directory layout section
above), no longer a gate.

**Argument-handling note.** Skill slash-invocation passes trailing text as
the user request and leaves `$ARGUMENTS`/`$1` **literal** (OpenCode's fixed
behavior); legacy commands substitute positionally. Skills authored with
`$ARGUMENTS`/`$N` bodies lose those arguments when invoked as skills.

### Per-skill permissions

Rare, and expressed in different layers:

- **OpenCode** — per-skill `allow`/`deny`/`ask` permissions declared in
  `opencode.json` (config file, not frontmatter).
- **Codex** — invocation policy (`allow_implicit_invocation`) in the
  `agents/openai.yaml` sidecar; plus `[[skills.config]]` disables in
  `config.toml`.
- **Hermes** — declared config settings under `skills.config`.
- **Claude Code / Cursor / Pi / DeepSeek** — no per-skill permission mechanism
  observed (Claude Code's `allowed-tools` frontmatter pre-approves tools for
  the skill, which is adjacent but not access control).

Harness-hub consideration: where permission knobs exist they live in harness
config or sidecars, never in portable frontmatter — so canon cannot express
permissions portably.

### Progressive disclosure

Three stages per the standard: *discovery* (only `name` + `description` load
at startup — the entire idle context cost), *activation* (the full `SKILL.md`
body loads when the task matches or the user invokes), *execution* (bundled
scripts run and referenced files are read on demand). The `description` is the
discovery lever — its quality is an authoring concern, not a tooling one.
OpenCode additionally surfaces a sample of up to ten supporting-file paths at
activation; contents never auto-load.

### Supporting files & script-first authoring

Standard layout: `SKILL.md` + optional `scripts/`, `references/`, `assets/` —
relative paths from `SKILL.md` must survive any transfer of a skill dir.
Recommended authoring pattern (repo convention): deterministic action lives in
code under `scripts/`, and the `SKILL.md` is a light wrapper that says when
and how to run it. Purely deterministic actions need no skill at all —
reference the script from `AGENTS.md` (or a docs page) and let the agent
execute it; a skill earns its wrapper when the agent must *discover* the
procedure or the procedure contains judgment.

### Management & lifecycle

- **Codex** — per-path disable via `[[skills.config]]`.
- **Cursor** — `/migrate-to-skills` converts legacy rules/commands into skills.
- **Hermes** — hub install model (`browse`/`search`/`install` with security
  scan), agent-managed via `skill_manage`, declared settings under
  `skills.config`. Project-local skills add their own lifecycle:
  `hermes skills trust [path]` / `hermes skills untrust` (per-repo, stored in
  `~/.hermes/config.yaml`'s `skills.trusted_project_dirs`); a repo's project
  skills are re-scanned by the security scanner on every content change
  (`git pull` included) even after trust is granted, and a dangerous verdict
  quarantines that skill regardless of trust state. `skills.project_discovery:
  false` disables the whole feature.
- **OpenCode** — HTTP-catalog skills cache until `version` increments.
- **Claude Code** — directory watching with the `SKILL.md`-only
  change-detection caveat (other files, `agents/`, `output-styles/` need
  reload); skills appearing mid-session may not register.

## Frontmatter — canon vs harness-specific

Frontmatter is itself the mechanism through which several mechanics above
(scoping, invocation policy) are expressed — this section records what keys
each harness supports.

**Tier 1 — standard, broadly supported (safe for canon).** Fields defined by
the [Agent Skills specification](https://agentskills.io/specification) and
consumed by every implementing harness:

| Field | Standard constraints | Support notes |
|---|---|---|
| `name` (required) | 1–64 chars; lowercase a-z/0-9/hyphens; no leading/trailing/consecutive hyphens; **must match parent directory name** | Universal; Pi alone tolerates `name` ≠ directory (it says the standard requirement is suboptimal for shared skill dirs) — canon must not rely on that leniency |
| `description` (required) | 1–1024 chars, non-empty; describes what + when to use it | Universal; the entire discovery surface in every harness — its quality decides whether the skill ever activates |
| `license` | License name or reference to a bundled file | Universal, informational |
| `compatibility` | 1–500 chars; environment requirements (product, packages, network) | Universal, informational; most skills don't need it |
| `metadata` | Map of string→string; harnesses store their own extensions under namespaced keys (e.g. OpenCode reads `metadata.opencode/slash`, `metadata.opencode/autoinvoke`) | Standard mechanism for harness-specific values — pass through untouched |
| `allowed-tools` | Space-separated pre-approved tools (experimental) | Support varies by harness; verify per harness before relying on it |
| `disable-model-invocation` | When `true`, hidden from model discovery; user-invocation only | Honored by Claude Code, Cursor, Pi; OpenCode equivalent is `metadata.opencode/autoinvoke: "false"`; **Codex ignores it** (verified 2026-09-15) — the `agents/openai.yaml` sidecar is Codex's only channel for this intent |

**Tier 2 — harness-specific extensions (pass through untouched, never relied
on for canon correctness):**

| Key(s) | Harness | Effect |
|---|---|---|
| `paths` | Claude Code, Cursor | Glob patterns (comma string or YAML list) gating **automatic activation**: the skill auto-loads/surfaces only when working with matching files; explicit invocation unaffected per current docs. Near-identical syntax in both — de facto portable between the two, though not part of the standard |
| `slash` / `metadata.opencode/slash` | OpenCode | Hides the skill from slash-command catalogs |
| `metadata.opencode/autoinvoke` | OpenCode | `"false"` = omitted from model-facing discovery |
| `platforms` (bare top-level); `metadata.hermes.{requires_toolsets,requires_tools,fallback_for_toolsets,tags,related_skills,config}` | Hermes | Platform/tool gating, settings, install prompts; namespaced under `metadata.hermes.*` per the standard's `metadata` mechanism (re-verified 2026-09-20 — only `platforms` stayed a bare top-level key) |
| sidecar `agents/openai.yaml` | Codex | **Complement, not alternative:** Codex honors standard frontmatter for `name`/`description` but silently ignores `disable-model-invocation`; the sidecar is its only channel for that intent (`policy.allow_implicit_invocation: false`, default `true`; explicit `$skill-name` invocation always works). Also carries UI metadata (`display_name`, `short_description`, icons, `brand_color`, `default_prompt`) and MCP `dependencies.tools` |

Codex is the outlier architecturally: UI metadata and invocation policy live
in a separate sidecar file, not frontmatter — and for user-only invocation the
sidecar is Codex's *only* channel (frontmatter `disable-model-invocation` is
ignored). Canon tolerates extra files per the standard ("any additional files
or directories"), so sidecars ride along intact; a sidecar may be derivable
when its content is fully determined by frontmatter intent (whether harness-hub
derives or merely validates them is a spec decision).

**Intent recipes — one intent, several spellings.** For canon skills whose
behavior must be identical across harnesses, the recipe table maps an intent
to every key that expresses it (write all, or accept divergence knowingly).

| Intent | Claude Code / Cursor / Pi | OpenCode | Codex |
|---|---|---|---|
| **user-only** (hide from model; user invocation only) | `disable-model-invocation: true` | `metadata: { opencode/autoinvoke: "false" }` | sidecar `policy.allow_implicit_invocation: false` |
| **agent-only** (hide from user catalogs; model may auto-apply) | *(no key exists — always user-invocable)* | `slash: false` (or `metadata: { opencode/slash: "false" }`) | *(no key exists)* |
| **repo-scope** (surface only for matching files) | `paths: <globs>` (Claude Code + Cursor) | *(no key exists)* | *(no key exists)* |

`paths` (Claude Code + Cursor) gates automatic activation by glob; elsewhere
the portable approximation is the `description`'s "when to use it" clause.
Agent-only is inherently inexpressible outside OpenCode — accepted divergence.

## Failure modes

### Implementation-independent failure modes

These apply to the skills asset regardless of how harness-hub implements
wiring — they stem from harness behavior and repo content. Resolutions are
deliberately open: how (any tooling) addresses them is an implementation
concern.

Note that several of these are **non-issues under certain configurations**: the
set of enabled harnesses, their versions, and repo conventions determine whether
a failure mode applies at all. Examples: collisions only matter when a harness
actually reads multiple roots (compat dirs, user + project levels); dialect
drift only for extensions an author actually uses. Version drift can also
*retire* a failure mode — Claude Code gaining `.agents/skills/` support would
retire its divergence ([#31005](https://github.com/anthropics/claude-code/issues/31005)).
This research is pinned to the versions in `harness-versions.insight.md`.

| Failure mode | What goes wrong | How to identify | Impact / consequence | Possible resolutions |
|---|---|---|---|---|
| **Name collisions & shadowing** | One harness sees the same skill name from two roots: canon vs a user-authored skill in a harness dir; compat roots (Cursor: `.agents/` + `.claude/` + `.codex/`; OpenCode: three roots); project vs user level (Codex lists both, never merges) | Scan every discovery root of each enabled harness for duplicate names; flag duplicates whose content differs | Shadowed or duplicated skills; which wins is harness-specific; Codex surfaces ambiguous duplicates in selectors | • Adopt the stray skill into canon, or rename one side<br>• Remove stale user-authored copies<br>• Keep any generated duplicates content-identical to canon so they're benign<br>• Accept documented precedence (project over user) |
| **Frontmatter dialect drift** | Harness extensions beyond the standard: `disable-model-invocation`, `paths` (Claude/Cursor); `slash`, `metadata.opencode/*` (OpenCode); Hermes `platforms` (bare) plus `metadata.hermes.*` (namespaced); Codex keeps UI metadata in the `agents/openai.yaml` sidecar | Scan canon frontmatter for non-standard keys; check each enabled harness's parser tolerance | Unknown keys are usually ignored, but strict parsers can reject; an extension silently does nothing where unsupported | • Canon holds standard keys; pass unknown keys through untouched<br>• Document per-harness keys alongside the skill<br>• Verify parser strictness before relying on an extension |
| **`name` ≠ directory name** | The standard requires the frontmatter `name` to equal the parent directory; Pi tolerates a mismatch; OpenCode derives IDs from paths (flat-form catalog files) | Compare frontmatter `name` against the parent directory for every canon skill | Skill unreachable or double-listed on strict harnesses; silently fine on lenient ones | • Enforce `name` == directory name in canon |
| **Stale / mid-session registration** | Claude Code watches skill dirs but change detection covers `SKILL.md` only; skills appearing mid-session may not register; OpenCode HTTP-catalog skills refresh only on a `version` bump | Newly added or edited skill invisible in a running session; catalog cache age vs file changes | Agent works from stale instructions or misses new skills entirely | • Restart the session after structural changes<br>• Bump `version` for catalog-sourced skills<br>• Note the constraint in the skill's docs |
| **Duplicate command surface** | A skill and a legacy command share a name → `/deploy` appears twice in catalogs (Claude Code: skills win; OpenCode: commands register over skills) | Same name present in both skills and commands locations for an enabled harness | Confusing double entries; `/name` resolves to different machinery per harness | • Pick one form per harness (spec §12.3) — never both<br>• Drop the legacy dir once skills cover the need |
| **Argument-handling mismatch** | Skill slash-invocation passes trailing text as the user request and leaves `$ARGUMENTS`/`$1` **literal** (OpenCode's fixed behavior); legacy commands substitute positionally | Skill bodies containing `$ARGUMENTS`/`$N` that get invoked via `/name` | Author expecting positional substitution gets arguments ignored or misplaced | • Author skills for trailing-text invocation<br>• Keep positional-argument assets as legacy commands where truly needed |
| **Intent-key divergence** | The same invocation intent is expressed per-harness (recipe table above); a skill carrying one spelling but not another behaves differently per harness — e.g. `disable-model-invocation: true` with no sidecar means manual-only on Claude/Cursor/Pi but **auto-invoked by Codex** (which ignores the frontmatter key) | For each canon skill, look up known intent keys across the recipe table and compare presence/absence against enabled harnesses | Silent behavioral divergence: a "user-only" skill fires automatically on Codex, or an auto skill is hidden from OpenCode's model discovery | • Add the missing spelling(s) to canon from the recipe table (frontmatter keys are author-edited)<br>• Handle derivable sidecars per the spec's ownership rules<br>• Accept the divergence knowingly (documented) |
| **Missing/invalid frontmatter** | `SKILL.md` lacks required `name`/`description`, or frontmatter is malformed YAML | Parse frontmatter of every canon skill | Skill not discovered, or rejected outright by strict parsers | • Fix the frontmatter before wiring |
| **Supporting-file breakage** | Skill body references `scripts/foo.sh` or `references/x.md`; any transfer that skips non-`SKILL.md` files or rewrites relative paths leaves them missing | Tree-diff canon skill dir vs whatever the harness sees; extract relative refs from the body and check they exist | Skill instructions load but the bundled script doesn't — the agent improvises | • Preserve whole directories with relative paths<br>• Validate referenced paths exist in canon |

### Failure modes dependent on implementation decisions

These apply only if the spec adopts the corresponding implementation choice.
Listed here for insight; the adopt/deny call and this table's final home belong
to the spec.

| Implementation decision | If adopted, this failure mode appears | What goes wrong | How to identify | Possible resolutions |
|---|---|---|---|---|
| **Copy canon into a harness dir** (e.g. canon at `.agents/skills/`, Claude Code copies into `.claude/skills/`) | **Copy drift** | Copies diverge from canon the moment canon changes | Byte-compare generated skill trees vs canon | • Re-run enable/sync to refresh<br>• Drift check with a remediation hint<br>• Shrink the copy surface (canon-alignment leaves one copy target) |
| **Copy into dirs read alongside canon** (compat roots) | **Benign-looking duplicates rot** | Cursor/OpenCode see each skill from two roots; a stale or hand-edited copy shadows or duplicates canon | Duplicate-name scan across a harness's roots with content comparison | • Keep generated copies byte-identical to canon (drift detection then equals copy-drift detection)<br>• Document precedence so duplicates are known-benign<br>• Generalize `harness-hub migrate <harness>` (introduced in `harness-hub-mvp.spec.md` §6/§8 for Claude Code only) to also *adopt* a compat root's pre-existing content into canon on request, rather than only auto-detecting drift |
| **Derive sidecars from frontmatter** (e.g. Codex `agents/openai.yaml` generated from `disable-model-invocation`) | **Derivation drift / ownership confusion** | Sidecar and frontmatter disagree; unclear whether a sidecar is tool-owned or user-authored | Regenerate the sidecar and byte-compare; match ⇒ tool-owned, mismatch ⇒ user-authored | • `doctor --fix` may generate/remove derivable sidecars only (content-derived ownership, spec §5, §9)<br>• Flag any sidecar not matching its derivation as user-authored and untouched |
| **Sync/skip supporting files selectively** (transferring only `SKILL.md`, or rewriting relative paths) | **Broken supporting files in targets** | Referenced `scripts/`/`references/` missing in the harness-visible copy | Tree-diff per skill dir; check relative refs resolve | • Whole-directory transfer preserving relative paths<br>• Validate referenced paths exist in canon before transfer |
