# harness-hub — Wiring & Setup Specification (First Draft)

**Status:** draft — implementation decisions for wiring repos to multiple harnesses; scoped to wire-in/setup/config (templating is a separate deliverable, see §12.8). The implementation stack is deliberately undecided pending a tooling research pass (§12.5)
**Date:** 2026-09-14
**Decided:** per-harness adapters · canon folder `.agents/` (fixed, not configurable — §3) · `AGENTS.md` as the agent doc ·
**skills canon at repo-root `.agents/skills/`** (§5, resolved 2026-09-15) ·
initial harnesses **Claude Code, Cursor, OpenCode** · future harnesses tracked now: **Codex, Hermes, Pi, DeepSeek** ·
scope narrowed 2026-09-19 to **agent doc, skills, commands, rules** (+doctor); subagents, hooks, docs deferred (§1.5, §8)

---

## 1. Purpose

harness-hub makes a repository **harness agnostic**. A consumer repo keeps its agent
assets (agent instructions, skills, commands, …) in one canon location, and
harness-hub wires whichever coding harnesses the developer enables to read from
that canon — so switching harnesses doesn't mean restructuring the repo.

Core promises:

1. **One canon.** Assets live once, in a single folder (default `.agents/`; skills standard-pinned at `.agents/skills/`, §5).
2. **One agent doc.** `AGENTS.md` at the repo root is the canonical agent
   instructions file.
3. **Easy enable/disable.** `harness-hub enable <harness>` wires a harness;
   `harness-hub disable <harness>` unwires it. Generated files are clearly marked
   and regenerable; canon content is never modified.
4. **Idempotent.** Running enable twice produces the same result; re-running after
   canon changes refreshes the wiring.
5. **Diagnosable.** `harness-hub doctor` verifies the wiring, detects
   interference and drift, and recommends remediation.

### Non-goals (first draft)

- Editing or generating canon content.
- Supporting every harness — three now, four more designed-for later.
- Nested/subdirectory canon — v1 wires only the root canon (§3). Nested
  instruction files are **detected and reported** by `doctor`, never wired or
  managed (§9, §11.9): harnesses discover nested files by different mechanics
  and at different times, so full support would fork the tool per harness.
- Assets beyond the wired ones (§1.5) — subagents, hooks, docs, workflows,
  memories, themes, MCP, LSP, permissions, routines — are deferred
  with their research in `../2026-09-19-1046-harness-deferred-assets/`
  (`harness-subagents`, `harness-hooks`, `harness-quirks-out-of-scope`
  insight files); see §8.
- User/global-level (`~/`) wiring — project repo only.

---

## 1.5 Scope (narrowed 2026-09-19)

The original draft targeted all asset types at once. This deliverable is
narrowed to **agent doc, skills, commands, rules, and the doctor
infrastructure guarding them** (§9). Deferred assets stay listed in §8 with the
decisions already reached, so nothing re-derived when they return as their own
deliverables (each starting from its insight file in
`../2026-09-19-1046-harness-deferred-assets/`).

---

## 2. Wiring strategies & discovery research

**Discovery research** — how each harness finds assets and what it calls them —
lives in one insight file per asset type, `harness-{type}.insight.md`, ordered
easiest-first (terminology, discovery mechanics, caveats, nuances). Insight
files for deferred assets live in
`../2026-09-19-1046-harness-deferred-assets/`. The spec below records only
**implementation decisions**.

| Insight file | Asset |
|---|---|
| `harness-agent-doc.insight.md` | Agent doc (`AGENTS.md`) |
| `harness-skills.insight.md` | Skills |
| `harness-commands.insight.md` | Commands / prompt templates |
| [`../2026-09-19-1046-harness-deferred-assets/harness-subagents.insight.md`](../2026-09-19-1046-harness-deferred-assets/harness-subagents.insight.md) | Subagents (deferred — §8) |
| `harness-rules.insight.md` | Rules (in scope — §7) |
| [`../2026-09-19-1046-harness-deferred-assets/harness-hooks.insight.md`](../2026-09-19-1046-harness-deferred-assets/harness-hooks.insight.md) | Hooks (deferred — §8) |
| [`../2026-09-19-1046-harness-deferred-assets/harness-quirks-out-of-scope.insight.md`](../2026-09-19-1046-harness-deferred-assets/harness-quirks-out-of-scope.insight.md) | Workflows, memories, themes, MCP, LSP, permissions, routines, … (deferred — §8) |
| `harness-versions.insight.md` | Research currency: harness roster + versions the research reflects |

Wiring strategies used in this spec (cheapest sufficient one wins — this is
where the hybrid model lives):

- **native** — harness already reads the canon asset as-is; generate nothing.
- **pointer** — generate a tiny file that points at the canon asset.
- **copy** — generate a copy of the canon asset in the harness's directory.
- **config** — merge-edit the harness's config file to reference canon.
- **notice** — no mechanism; print an explanation and skip.
- **defer** — needs its own design pass (see the asset's section).

---

## 3. Canon layout

```
repo/
  AGENTS.md                  # canonical agent doc (root)
  .agents/                   # canon folder (fixed — see "One canon root" below)
    skills/
      <name>/SKILL.md        # canonical skills (Agent Skills standard; §5)
      <name>/scripts/…       # optional supporting files, copied with the skill
    commands/
      <name>.md              # canonical commands (legacy — migrate to skills, §5)
    agents/
      <name>.md              # canonical subagents (where supported)
    rules/                   # in scope — §7 (strategy pending)
    hooks/                   # (deferred — §8)
  harness-hub.json           # harness-hub state, committed to the repo
```

Empty directories in `.agents/` are optional; harness-hub only wires what exists.

**One canon root, fixed.** `.agents/skills/` is simultaneously the skills
canon (§5) and the standard's community directory; the other assets live
alongside it under the same root. The canon root is **not configurable**:
skills are pinned to `.agents/skills/` by the standard no matter what, so a
movable root would relocate only some assets and split canon in two.
`harness-hub.json` therefore carries only the harness list. (Revisit only on
a concrete user request — §12.6.)

```json
// harness-hub.json
{ "harnesses": ["claude-code", "cursor", "opencode"] }
```

---

## 4. Asset: Agent doc (`AGENTS.md`) — decided

The easiest asset: six of seven harnesses read `AGENTS.md` natively
(discovery detail: `harness-agent-doc.insight.md`).

| Harness | Wiring |
|---|---|
| Claude Code | **pointer**: generate `CLAUDE.md` = `@AGENTS.md` (official import syntax) |
| Cursor, OpenCode, Codex, Hermes, Pi, DeepSeek | **native** — nothing generated |

Canon `AGENTS.md` is **never modified** by harness-hub.

Claude Code specifics: if a user-authored `CLAUDE.md` already exists and doesn't
look generated, `enable` refuses (§10 safety).

---

## 5. Asset: Skills — decided (canon-aligned: `.agents/skills/`)

`SKILL.md` is the universal currency: all seven harnesses consume it, and it is
formalizing as the [Agent Skills standard](https://agentskills.io) (Pi implements
it; Codex, Cursor, Hermes are compatible) — discovery detail: `harness-skills.insight.md`.
Canon skills are standard-format `SKILL.md` directories; canon tolerates
harness-specific frontmatter keys, and adapters copy frontmatter through
untouched (unknown keys are the author's business, not the adapter's).

**Canon location: repo-root `.agents/skills/` (resolved 2026-09-15).** The
Agent Skills standard designates `.agents/skills/` as the community directory,
and Codex (cwd→repo-root walk), Cursor, Pi, DeepSeek, and OpenCode (compat
source) all read it natively — five harnesses wire with zero generated files.
Claude Code is the single holdout (reads `.claude/skills/` only; support
requested in [#31005](https://github.com/anthropics/claude-code/issues/31005)),
so it is the sole copy target. This is §5(a) from the earlier draft.

**Canon skills-contract** (enforced by `doctor` — the `.agents/skills/`
native-read bargain only holds if the folder obeys the standard):

- One skill per directory, named for the skill; `SKILL.md` inside;
  frontmatter `name` **must equal** the parent directory name (the standard's
  strictest rule — Pi tolerates violations, nothing else does).
- `name`: 1–64 chars, lowercase a-z/0-9/hyphens, no leading/trailing/consecutive
  hyphens; `description`: 1–1024 chars, non-empty (the discovery lever).
- Optional standard keys: `license`, `compatibility`, `metadata`, `allowed-tools`;
  harness-specific keys and extra files (e.g. Codex `agents/openai.yaml`
  sidecars) pass through untouched — the standard allows any additional files,
  and adapters never modify frontmatter or generate sidecars.

**Intent parity: authored by default, `--fix` for derivable artifacts
(resolved 2026-09-15; supersedes the same-day authored-only decision).**
Frontmatter parity keys (OpenCode `metadata.opencode/autoinvoke`) are always
author-authored — `SKILL.md` is never edited by harness-hub. The one
out-of-frontmatter channel, the Codex sidecar, is **derivable**: when canon
frontmatter says `disable-model-invocation: true` and the skill has no
`agents/openai.yaml`, `doctor --fix` may generate one containing exactly
`policy.allow_implicit_invocation: false` (plus a `#` marker comment). When
Codex is disabled or the frontmatter intent disappears, `doctor --fix`
removes sidecars that byte-match their derivation ("orphaned derivations").
Ownership is **content-derived**: byte-identical to the derivation =
harness-hub's; anything else = user-authored and never touched — so no ledger
memory is needed for these files (§10). Other routes (e.g. `opencode.json`
permissions) remain unwired, manual.
- Optional supporting dirs per the standard: `scripts/`, `references/`,
  `assets/`; relative paths from `SKILL.md` must survive any copy (§11.8).
- Harness-only layouts (Cursor/OpenCode/Pi flat or grouped `.md` files, HTTP
  catalog forms) are **not** canon layouts — canon is the portable subset;
  machine-generated forms are migration inputs at best.

**Migration convention (encouraged, not enforced).** Commands are a deprecating
pattern: every harness that has file-based commands either merges them into
skills (Claude Code) or marks them legacy (Cursor's `/migrate-to-skills`), and
skills are now user-invocable in every harness that matters (§6). Consumer
repos are encouraged to migrate `.agents/commands/` into canon skills; harness-hub
may offer a `migrate-commands` assist later. Legacy wiring (§6) keeps existing
repos working meanwhile.

| Harness | Wiring |
|---|---|
| Claude Code | **copy** → `.claude/skills/` (the only generated skills tree; refresh on re-enable/sync) |
| Cursor | **native** via `.agents/skills/` |
| OpenCode | **native** via `.agents/skills/` |
| Codex | **native** via `.agents/skills/` |
| Hermes | **defer** — install/hub model; project-local dir unverified |
| Pi | **native** via `.agents/skills/` |
| DeepSeek | **native** via `.agents/skills/` |

**Benign duplicates.** With canon at `.agents/skills/` and a Claude Code copy
at `.claude/skills/`, compat readers (Cursor, OpenCode) see each skill from two
roots. The copies are byte-identical to canon, so precedence is behaviorally
irrelevant — accepted and kept that way by the drift check (§9).

Copies include the whole skill directory (scripts/, references/, assets/) so
relative paths survive. Enabled skills are marked generated (§10) and refreshed
on re-enable/sync.

---

## 6. Asset: Commands — demoted (skills are the command surface)

Every harness now exposes skills to the user invocation surface, which is what
a command was (re-verified 2026-09-15; coverage detail in
`harness-skills.insight.md` — "Command coverage"):

- Claude Code: custom commands merged into skills; `/name` invokes a skill.
- Cursor: commands legacy; `/migrate-to-skills` converts them.
- OpenCode: every skill is `/name`-invocable; trailing text passes as the user
  request; `slash: false` opts out.
- Pi: skills register as `/skill:name` (leading or mid-prompt form; args pass
  through) — **no prompt-template rendering needed** for user invocation.
- Codex, Hermes, DeepSeek: skills are the command surface; no separate format.

Residual gaps, and the only reasons legacy command wiring still exists:

1. **Positional argument substitution.** Command files substitute `$ARGUMENTS`
   /`$N`; skill invocation passes trailing text as the user request and leaves
   placeholders literal.
2. **OpenCode JSON-config commands** can route (`agent`, `model`, `subagent`) —
   not expressible as a skill.

Command-frontmatter dialects differ per harness (Claude: `description`,
`argument-hint`, `allowed-tools`, `model`; OpenCode: file frontmatter is
`description`-only, routing fields live in JSON config; Pi: `argument-hint`
plus defaults/slicing; Cursor: none — filename is the name) — dialect detail:
`harness-commands.insight.md`. Canon commands stay on the common subset;
per-harness degradation is accepted knowingly.

First-draft wiring, therefore support-level rather than encouragement:

| Harness | Wiring |
|---|---|
| Claude Code | **copy** → `.claude/commands/` (only for canon commands that truly need it) |
| Cursor | **copy** → `.cursor/commands/` (legacy surface) |
| OpenCode | **copy** → `.opencode/commands/` (legacy surface) |
| Codex, Hermes, DeepSeek | **notice** — no separate command format exists |
| Pi | **notice** — no prompt-template wiring (dropped 2026-09-15: skills cover `/skill:name` invocation with args; templates add only positional substitution/defaults, and canon skills are the portable answer) |

Canon `.agents/commands/` remains wired for repos that have it, but the convention
is **migrate to skills** (§5). Never generate both forms for the same asset —
the duplicate-`/deploy` failure mode (`harness-skills.insight.md`) applies.

---

## 7. Asset: Rules — in scope, strategy decision pending

The first asset where formats genuinely diverge, and the reason the spec is
organized per-asset: the right strategy may differ per harness (hybrid).
Discovery detail: `harness-rules.insight.md`.

| Harness | Wiring |
|---|---|
| Claude Code | **defer** — format closest to canon |
| Cursor | **defer** — required frontmatter + `.mdc` extension |
| OpenCode | **defer** — no rules dir; `instructions` mechanism unverified |
| Codex, DeepSeek | **notice** (inline option D exists, see below) |
| Hermes, Pi | **notice** — no channel |

**Options:**

- **A — passthrough.** Wire only where formats align (Claude Code; Cursor if
  authors keep Cursor-compatible frontmatter in canon and the adapter renames
  `.md`→`.mdc`). Minimal machinery; OpenCode/Codex hand-wired.
- **B — compile/translate.** Neutral canon frontmatter (`title`, `description`,
  `globs`, `always`); each adapter compiles to its native format. One source of
  truth; harness-hub owns a translator per harness.
- **C — per-harness subtrees.** `.agents/<harness>/rules/…` copied verbatim. No
  translator, but content forks per harness.
- **D — inline.** For harnesses with *no* rules mechanism (Codex), a compiled
  `rules` appendix section inside the generated portion of `AGENTS.md` — note
  this touches the "canon AGENTS.md is never modified" promise: the appendix
  would be a generated, clearly-delimited section, or a separate `@import`-ed
  file referenced from `AGENTS.md`.

Recommendation: **hybrid — B as default for the three initial harnesses, C as
explicit escape hatch, D only if Codex support is added and wanted.** OpenCode
degrades to a notice if `instructions` remains unresolved. The strategy choice
(§12.2) is the main rules open question for the implementation plan.

---

## 8. Deferred assets (subagents, hooks, docs) — out of scope

**2026-09-19: this deliverable is narrowed to agent doc, skills, commands,
rules, and the doctor infrastructure that guards them (§1.5).** The per-asset
sections for subagents, hooks, and docs are removed; their research insight
files live under `../2026-09-19-1046-harness-deferred-assets/`. Decisions
already reached are summarized here so nothing is re-derived when an asset
returns as its own deliverable:

- **Subagents** — `../2026-09-19-1046-harness-deferred-assets/harness-subagents.insight.md`.
  Was §7, marked decided but not built: copy → `.claude/agents/` and
  `.opencode/agents/`; notice for Cursor/Pi (no equivalent); defer for
  Codex/Hermes/DeepSeek (config-declared, schema unverified). Canon:
  `.agents/agents/<name>.md`.
- **Hooks** — `../2026-09-19-1046-harness-deferred-assets/harness-hooks.insight.md`.
  Was §9: formats diverge in shape and semantics; likely out of scope whenever
  it returns. Canon may hold `hooks/` for manual wiring, unwired.
- **Docs** — was §10: no wiring (referenced from `AGENTS.md` or read on
  demand); document chaining stays a repo convention (plain relative paths,
  critical guidance never only behind a reference). Doctor's import-line and
  doc-reference checks still apply to the wired assets (§9).

---

## 9. CLI surface (first draft)

- `harness-hub init` — create `.agents/` skeleton + `harness-hub.json`.
- `harness-hub enable <harness>…` — wire one or more harnesses. Runs the doctor
  pre-flight first (see below).
- `harness-hub disable <harness>…` — unwire, removing only generated files.
- `harness-hub status` — passive state summary: canon location, enabled
  harnesses, drift report.
- `harness-hub doctor` — active health checks: verifies the configuration, flags
  risks with recommended remediation (see "Doctor checks").

### Doctor checks

`doctor` is read-only — it never modifies files; every finding carries a
recommended remediation the user applies themselves (the `--fix` flag below is
the narrow exception). It runs standalone on demand and as a **pre-flight
before `enable`**: warnings are surfaced but don't block; blocking conditions
remain the §10 refusal rules.

| Check | What it detects | Example remediation |
|---|---|---|
| **Precedence interference** | Files that silently outrank or amend `AGENTS.md` for enabled harnesses: `AGENTS.override.md` (Codex, Pi), `AGENTS.local.md` (DeepSeek), `.hermes.md` (Hermes), `CLAUDE.local.md` (Claude Code), `.cursorrules` | Remove the file, gitignore it, or merge its content into canon `AGENTS.md` |
| **Nested file inventory** | Instruction files below the root (nested `AGENTS.md`/`CLAUDE.md`, override/local variants) that harnesses discover by their own mechanics — combined, chained, or lazily (see `harness-agent-doc.insight.md`). Inventory is inherently incomplete for harnesses whose discovery reaches above the repo root (Pi, Claude Code). **Advisory only — nested canon is out of scope (§1); harness-hub never wires or manages these files** | Keep general guidance root-only; subtree files only for genuinely scoped rules; remove nested override files unless intentional; align nested content with canon (dedupe) |
| **Import lines in canon** | `@path`-style import lines in canon `AGENTS.md`: they expand into context in Claude Code only and are literal noise elsewhere (Hermes has an equivalent in flight — `harness-agent-doc.insight.md`); also flags import targets that don't exist or resolve outside the repo | Inline the content into the doc, keep it as a documented Claude-only addition, or convert to a plain relative-path reference |
| **Doc references** | Relative-path references from canon to docs that are missing or moved; sections of critical guidance (verification, safety, conventions) that live *only* behind references — no harness auto-loads them | Fix the path; inline critical guidance; keep references for supplementary depth only (§8) |
| **Clobber risk** | Non-generated harness files `enable` would refuse to touch (hand-written `CLAUDE.md`, existing skills named like canon skills) | Adopt into canon manually, rename, or accept the refusal |
| **Drift** | Canon changed since last enable; generated files missing or hand-modified | Re-run `enable` to refresh the wiring |
| **Size caps** | `AGENTS.md` byte size vs the smallest known cap among enabled harnesses (Codex 32 KiB default; Hermes dynamic; DeepSeek bounded), warning at a threshold (e.g. 80%) | Trim the doc; move guidance into skills/rules |
| **Canon asset validity** | Skills-contract violations (spec §5): `SKILL.md` missing required `name`/`description`, malformed frontmatter, `name` ≠ parent directory name, non-portable layouts (flat/grouped `.md`), empty asset dirs | Fix frontmatter, rename the directory, or remove the asset |
| **Intent-key parity** | Canon skills whose invocation intent is spelled for some harnesses but not others (recipe table in `harness-skills.insight.md`): `disable-model-invocation: true` without sidecar `allow_implicit_invocation: false` (Codex auto-invokes what everything else keeps manual); sidecar `false` without frontmatter `true` (the reverse); OpenCode `autoinvoke` missing where the intent is user-only | Add the missing spellings to canon (frontmatter keys are author-edited; the Codex sidecar is derivable — `doctor --fix` generates/removes it when unambiguous, §5), or accept the divergence knowingly |
| **Config merge integrity** | Harness-hub-owned keys in merge-edited configs (`opencode.json` etc.) missing or altered, vs the ownership ledger in `harness-hub.json` | Re-run `enable` to re-apply, or hand-reconcile |
| **Canon layout** | `harness-hub.json` unparseable; canon root (`.agents/`) missing; stray files inside generated target directories | Clean up, or re-init |

Findings carry severity (`error` / `warning` / `info`); exit code is non-zero
when errors are present, so `doctor` can gate scripts or CI.

`doctor --fix` applies remediations where **the fix is unambiguous**: the
artifact to write must be fully derivable from canon (content-derived
ownership), and removal applies only to artifacts that byte-match their
derivation. Everything else — ambiguous, judgment-dependent, or
user-authored-looking — is reported with the recommended remediation and left
for the author. Today's derivable set: the Codex sidecar for user-only intent
(§5); future entries join only if they meet the same bar. `--fix` never edits
`SKILL.md`, canon docs, or any frontmatter.

Per-asset failure modes — what can go wrong with each asset, how to identify
it, and possible resolutions — live in the corresponding insight file (e.g.
agent-doc failure modes in `harness-agent-doc.insight.md`). Insight files are
research only; how harness-hub addresses a failure mode is decided in the spec
and pinned to the harness versions recorded in
`harness-versions.insight.md`.

---

## 10. Generated-file conventions & safety

- Generated files carry a header:
  `<!-- generated by harness-hub; source: .agents/...; do not edit -->` (ownership of
  merge-edited config keys is tracked in `harness-hub.json` instead of comments).
- **Canon is read-only to harness-hub.** Only generated files are removed/rewritten.
- `enable` on an existing non-generated harness file (hand-written `CLAUDE.md`,
  populated `.claude/skills/`) **fails with a clear message** rather than
  clobbering; `--force` overrides; `--adopt` (future) ingests existing files into canon.
- `disable` removes only harness-hub-generated files for that harness; merge-edited
  configs lose exactly the keys harness-hub added.
- `status` reports drift (canon changed since last enable; generated files
  missing or hand-modified).

---

## 11. Challenges not yet encountered (risk register)

1. **Name collisions.** Canon skill `deploy` copied into `.claude/skills/` where a
   user-authored `deploy` already exists → shadowing or clobber. Rule: never
   overwrite non-generated files; collision = hard error naming both paths.
2. **Frontmatter dialect drift.** Harnesses are extending `SKILL.md` frontmatter
   (Hermes: `platforms`, `requires_toolsets`; Claude/Cursor:
   `disable-model-invocation`; Codex: `agents/openai.yaml` sidecars). Canon must
   pass unknown keys through untouched, and adapters must ignore rather than
   choke. The Agent Skills standard is the anchor; anything beyond it is
   best-effort per harness.
3. **Size caps.** Codex caps `AGENTS.md` guidance at 32KiB by default (configurable);
   Hermes caps context files dynamically; DeepSeek bounds its instruction chain.
   If canon `AGENTS.md` grows, harnesses truncate **silently and differently**.
   `doctor` measures and warns near the smallest known cap (§9).
4. **First-match-wins interference.** Hermes loads `.hermes.md` over `AGENTS.md`;
   Codex/Pi prefer `AGENTS.override.md`; DeepSeek loads `AGENTS.local.md`
   additively. Leftover override/local files mean canon guidance is silently
   amended or replaced.    `doctor` detects higher-precedence files and recommends
   remediation (§9).
5. **Config merge drift.** Merge-editing `opencode.json` (JSONC — comments possible)
   and later TOML/JSON harness configs requires comment/format-preserving edits
   and tracked key ownership so `disable` removes exactly what was added.
6. **Commands convergence.** Claude and Cursor are folding commands into skills;
   generating both forms risks `/deploy` appearing twice per harness. Decide
   generate-as-skills vs legacy dirs per harness (§12.3), don't do both.
7. **Copy drift & regeneration triggers.** Copy-based wiring diverges from canon
   the moment canon changes. Options: manual re-enable, `sync` command, file
   watcher, or pre-commit/git hook. First draft: manual re-enable + `status`
   / `doctor` drift report.
8. **Skills with supporting files.** `SKILL.md` dirs may contain `scripts/`,
   `references/`, `assets/` — copies must be whole-directory and preserve
   relative paths; collision rules from (1) apply per file, not per skill.
9. **Nested repos / monorepos.** Nested `AGENTS.md`/`CLAUDE.md` files are
   discovered below the root by all three mechanics (combined: Cursor; chained:
   Codex, DeepSeek, Pi; lazy/progressive: Claude Code, OpenCode, Hermes) —
   per-subdirectory canon is **out of scope for v1** (§1): harness-hub
   wires only root canon and never manages nested files. `doctor` inventories
   them and warns (§9); wiring them would mean adopting per-harness discovery
   mechanics — combine/chain/lazy — into the tool. A v2 that adds nested canon
   must first earn its place with a concrete workflow need, not anticipatory
   design.
10. **Canon location vs emerging standards.** Canon is `.agents/` itself —
    the standard's community directory — so standard churn in `.agents/`
    would touch canon layout directly. The root is deliberately fixed (§3),
    so the response to churn is a spec decision, not a per-repo config;
    revisit if the standard adds more fixed subpaths. Considered and rejected
    (2026-09-15): inverting ownership — user canon at `.ai/`, `.agents/`
    fully generated — for categorical ownership and free per-harness
    enrichment. Rejected because it re-splits canon into two roots,
    copy-wires every harness, and claims as generated a directory foreign
    tooling (skill installers) also writes into; author-authored parity plus
    doctor detection (§5) achieves the same safety without the machinery.
11. **Unverified mechanisms.** Hermes project-level skill dirs need hands-on
    verification before the Hermes skill adapter is built; it is marked
    defer/notice until then. Unverified mechanisms belonging to deferred
    assets (OpenCode `instructions`, Codex subagent config, Hermes delegation
    config) moved with those assets to
    `../2026-09-19-1046-harness-deferred-assets/` (§8).
12. **Windows/symlinks.** Copies chosen over symlinks partly for this; keep it
    that way (§10) so generated trees survive Windows checkouts and odd git configs.
13. **Generated markers vs YAML frontmatter.** The §10 header comment
    (`<!-- generated by harness-hub; source: … -->`) cannot precede frontmatter:
    YAML frontmatter must start at byte 0, so a leading comment would break
    `SKILL.md` parsing in every harness. Whole-directory skill copies multiply
    the problem (markers inside scripts/references are noise). Resolution
    direction: ownership of generated skill trees is tracked in the
    `harness-hub.json` ledger (as with merge-edited config keys), not in-file;
    in-file markers only where a file has no frontmatter (e.g. copied command
    markdown, subagent docs).

---

## 12. Open questions & settled directions

Resolved items stay listed here with their resolution until the follow-on
spec/plan absorbs them (see §12.8).

1. **Skills canon alignment** — **resolved (2026-09-15): canon at
   repo-root `.agents/skills/` (§5a).** Claude Code is the only copy target;
   the skills-contract in §5 makes the native-read bargain explicit.
2. **Rules strategy** — A, B, C, D or hybrid (§7). Recommendation: hybrid B + C
   escape hatch; verify OpenCode `instructions` before committing.
3. **Commands** — **resolved (2026-09-15): demoted (§6).** Skills are the
   command surface everywhere (Pi included — `/skill:name` needs no prompt
   templates); legacy copy wiring survives only for positional-argument
   commands; the repo convention is migrate-to-skills.
4. **Hooks** — **deferred with the asset (2026-09-19, §8);** was pending
   confirmation of first-draft scope.
5. **Implementation stack, packaging & install** — deliberately undecided.
   Language, libraries, packaging, and distribution all wait for a
   tooling/software/libs research pass, run **after the harness assets are
   settled**; this spec is stack-neutral by design.
6. **Canon folder default** — **resolved (2026-09-15): `.agents/` is the
   canon root, fixed (not configurable).** Skills are standard-pinned at
   `.agents/skills/`; a movable root would split canon (skills can't follow),
   so `harness-hub.json` carries only the harness list. Revisit only on a
   concrete user request.
7. **Future-harness admission** — when Codex/Hermes/Pi/DeepSeek adapters are
   wanted, each starts as a verification spike (§11.11) before an adapter spec.
9. **Generated-file markers & ownership classes** — §11.13 surfaced that the
   §10 header can't live on frontmatter-bearing files. Confirm in the
   implementation plan: (a) ledger-based ownership for generated trees
   outside canon (`.claude/skills/` copies, command copies) with marker
   placement rules per file type; (b) content-derived ownership for the
   in-canon derivable sidecar (§5) and its exact derivation format
   (field order, marker comment) so byte-match comparison is stable; (c) the
   `doctor --fix` derivable-artifact list and its removal rules. In-file
   markers on subagent docs are moot this draft — subagents are deferred (§8).
8. **AGENTS.md templating** — **extracted to its own deliverable:**
   [`2026-09-15-0932-agents-md-templating/agents-md-templating.spec.md`](../2026-09-15-0932-agents-md-templating/agents-md-templating.spec.md).
   Summary of the settled model (2026-09-15): optional templating mode where
   template + values are canon and the rendered `AGENTS.md` is a generated
   §10-contract artifact — template engine TBD (tooling research deferred,
   see the follow-up spec), harness-agnostic render inputs, explicit
   render command with render-drift doctor check, `disable` never removes the
   rendered doc. The follow-up spec owns the details; this spec's scope stays
   wire-in/setup/config.
