# harness-hub — Specification (First Draft)

**Status:** draft — organized by asset type; straightforward assets decided, nuanced assets carry open decisions
**Date:** 2026-09-14
**Decided:** Python CLI · per-harness adapters · canon folder `.ai/` (configurable) · `AGENTS.md` as the agent doc ·
initial harnesses **Claude Code, Cursor, OpenCode** · future harnesses tracked now: **Codex, Hermes, Pi, DeepSeek**

---

## 1. Purpose

harness-hub makes a repository **harness agnostic**. A consumer repo keeps its agent
assets (agent instructions, skills, commands, …) in one canon location, and
harness-hub wires whichever coding harnesses the developer enables to read from
that canon — so switching harnesses doesn't mean restructuring the repo.

Core promises:

1. **One canon.** Assets live once, in a single folder (default `.ai/`).
2. **One agent doc.** `AGENTS.md` at the repo root is the canonical agent
   instructions file.
3. **Easy enable/disable.** `harness-hub enable <harness>` wires a harness;
   `harness-hub disable <harness>` unwires it. Generated files are clearly marked
   and regenerable; canon content is never modified.
4. **Idempotent.** Running enable twice produces the same result; re-running after
   canon changes refreshes the wiring.

### Non-goals (first draft)

- Editing or generating canon content.
- Supporting every harness — three now, four more designed-for later.
- Subset-supported and divergent assets — MCP, LSP, permissions, routines,
  themes/memories — are researched in `harness-quirks-out-of-scope.insight.md`
  but out of implementation scope for the first draft.
- User/global-level (`~/`) wiring — project repo only.

---

## 2. Wiring strategies & discovery research

**Discovery research** — how each harness finds assets and what it calls them —
lives in one insight file per asset type, `harness-{type}.insight.md`, ordered
easiest-first (terminology, discovery mechanics, caveats, nuances). A
`harness-quirks-out-of-scope.insight.md` records out-of-scope assets and naming
traps. The spec below records only **implementation decisions**.

| Insight file | Asset |
|---|---|
| `harness-agent-doc.insight.md` | Agent doc (`AGENTS.md`) |
| `harness-skills.insight.md` | Skills |
| `harness-commands.insight.md` | Commands / prompt templates |
| `harness-subagents.insight.md` | Subagents |
| `harness-rules.insight.md` | Rules |
| `harness-hooks.insight.md` | Hooks |
| `harness-quirks-out-of-scope.insight.md` | Workflows, memories, themes, MCP, LSP, permissions, routines, … |

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
  .ai/                       # canon folder (configurable via harness-hub.json)
    skills/
      <name>/SKILL.md        # canonical skills (Agent Skills standard)
      <name>/scripts/…       # optional supporting files, copied with the skill
    commands/
      <name>.md              # canonical commands
    agents/
      <name>.md              # canonical subagents (where supported)
    rules/                   # (deferred — §8)
    hooks/                   # (deferred — §9)
  harness-hub.json           # harness-hub state, committed to the repo
```

Empty directories in `.ai/` are optional; harness-hub only wires what exists.

```json
// harness-hub.json
{ "canon": ".ai", "harnesses": ["claude-code", "cursor", "opencode"] }
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
look generated, `enable` refuses (§12 safety).

---

## 5. Asset: Skills — decided (copy-based), with an alignment question

`SKILL.md` is the universal currency: all seven harnesses consume it, and it is
formalizing as the [Agent Skills standard](https://agentskills.io) (Pi implements
it; Codex, Cursor, Hermes are compatible) — discovery detail: `harness-skills.insight.md`.
Canon skills are standard-format `SKILL.md` directories; canon tolerates
harness-specific frontmatter keys, and adapters copy frontmatter through
untouched (unknown keys are the author's business, not the adapter's).

| Harness | Wiring |
|---|---|
| Claude Code | **copy** → `.claude/skills/` |
| Cursor | **copy** → `.cursor/skills/` (or native via `.agents/skills/`, below) |
| OpenCode | **copy** → `.opencode/skills/` |
| Codex | **native** via `.agents/skills/` |
| Hermes | **defer** — install/hub model; project-local dir unverified |
| Pi | **native** via `.agents/skills/` |
| DeepSeek | **native** via `.agents/skills/` |

**The `.agents/skills/` alignment question (open).** Codex, DeepSeek, Cursor, and
Pi all read `.agents/skills/` natively. Two ways to exploit that:

- **(a) Canon-aligned:** canon skills live at `.agents/skills/` (canonical name
  `.ai/skills/` remains a configured alias that, if used, is copied there).
  Claude Code and OpenCode adapters copy into their dirs; four harnesses wire
  with zero generated files.
- **(b) Copy-only:** canon stays `.ai/skills/`; every adapter copies (Cursor
  included). Uniform, one mechanism, but four copy targets instead of two.

Recommendation: **(a)** — adopt `.agents/skills/` as the physical canon for
skills (`.ai/` remains the umbrella and home for everything without a
cross-harness home). But this trades the "everything under `.ai/`" story for
less machinery; needs the user's call.

Copies include the whole skill directory (scripts/, references/, assets/) so
relative paths survive. Enabled skills are marked generated (§12) and refreshed
on re-enable/sync.

---

## 6. Asset: Commands — decided (copy where possible)

Three harnesses have file-based markdown commands; the rest expose skills as
commands or use extension code (`harness-commands.insight.md` — Pi's "prompt
templates" are the same asset under another name).

| Harness | Wiring |
|---|---|
| Claude Code | **copy** → `.claude/commands/` |
| Cursor | **copy** → `.cursor/commands/` |
| OpenCode | **copy** → `.opencode/commands/` |
| Codex, Hermes, Pi, DeepSeek | **notice** — skills serve as the command surface (Pi: extension-registered) |

All three initial harnesses use the same markdown-command shape → pure passthrough.
Given Claude/Cursor are both converging commands into skills, a later draft may
flip Claude Code and Cursor to "generate as skills" and drop the legacy dirs
entirely (open question §14.3).

---

## 7. Asset: Subagents — decided (copy + notice)

| Harness | Wiring |
|---|---|
| Claude Code | **copy** → `.claude/agents/` |
| OpenCode | **copy** → `.opencode/agents/` |
| Cursor, Pi | **notice** — no equivalent today |
| Codex, Hermes, DeepSeek | **defer** — config/plugin-declared; verify schema (`harness-subagents.insight.md`) |

Canon: `.ai/agents/<name>.md`. When canon agents exist and a notice-harness is
enabled, the notice names the canon path so the author knows what isn't wired.

---

## 8. Asset: Rules — deferred, decision pending

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
- **C — per-harness subtrees.** `.ai/<harness>/rules/…` copied verbatim. No
  translator, but content forks per harness.
- **D — inline.** For harnesses with *no* rules mechanism (Codex), a compiled
  `rules` appendix section inside the generated portion of `AGENTS.md` — note
  this touches the "canon AGENTS.md is never modified" promise: the appendix
  would be a generated, clearly-delimited section, or a separate `@import`-ed
  file referenced from `AGENTS.md`.

Recommendation: **hybrid — B as default for the three initial harnesses, C as
explicit escape hatch, D only if Codex support is added and wanted.** OpenCode
degrades to a notice if `instructions` remains unresolved.

---

## 9. Asset: Hooks — deferred, likely out of first-draft scope

Formats diverge in both shape and semantics (`harness-hooks.insight.md`).

| Harness | Wiring |
|---|---|
| Claude Code | **defer** — merge-edit into `.claude/settings.json` |
| Cursor | **defer** — standalone `.cursor/hooks.json`, cleanly generatable |
| OpenCode, Pi, DeepSeek | **notice/defer** — plugin/extension code, not declarative files |
| Codex | **notice** — nothing declarative |
| Hermes | **notice** — hooks live user-level |

Hooks differ not just in format but in **semantics** (event names, payload
contracts, allow/deny powers). A canon hook likely needs per-harness definitions
regardless. Candidate design (deferred): canon hook scripts + per-harness wiring
manifests. First draft: out of scope; canon may hold a `hooks/` folder for
manual wiring, unwired.

---

## 10. Asset: Docs

Treated as no-wiring: docs referenced from `AGENTS.md` (all harnesses load it)
or read by the agent on demand. OpenCode's `instructions` globs could wire
`docs/*.md` into context, but that rides on the same unverified mechanism as
rules (§8). No canon `docs/` folder in the first draft — confirm intent before
designing one.

---

## 11. CLI surface (first draft)

- `harness-hub init` — create `.ai/` skeleton + `harness-hub.json`.
- `harness-hub enable <harness>…` — wire one or more harnesses.
- `harness-hub disable <harness>…` — unwire, removing only generated files.
- `harness-hub status` — canon location, enabled harnesses, drift report, and
  **interference warnings** (see §13.4).

---

## 12. Generated-file conventions & safety

- Generated files carry a header:
  `<!-- generated by harness-hub; source: .ai/...; do not edit -->` (ownership of
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

## 13. Challenges not yet encountered (risk register)

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
   `status` should measure and warn near the smallest known cap.
4. **First-match-wins interference.** Hermes loads `.hermes.md` over `AGENTS.md`;
   Codex/Pi prefer `AGENTS.override.md`; DeepSeek loads `AGENTS.local.md`
   additively. Leftover override/local files mean canon guidance is silently
   amended or replaced. `status` must detect higher-precedence files and warn.
5. **Config merge drift.** Merge-editing `opencode.json` (JSONC — comments possible)
   and later TOML/JSON harness configs requires comment/format-preserving edits
   and tracked key ownership so `disable` removes exactly what was added.
6. **Commands convergence.** Claude and Cursor are folding commands into skills;
   generating both forms risks `/deploy` appearing twice per harness. Decide
   generate-as-skills vs legacy dirs per harness (§14.3), don't do both.
7. **Copy drift & regeneration triggers.** Copy-based wiring diverges from canon
   the moment canon changes. Options: manual re-enable, `sync` command, file
   watcher, or pre-commit/git hook. First draft: manual + `status` drift report.
8. **Skills with supporting files.** `SKILL.md` dirs may contain `scripts/`,
   `references/`, `assets/` — copies must be whole-directory and preserve
   relative paths; collision rules from (1) apply per file, not per skill.
9. **Nested repos / monorepos.** Nested `AGENTS.md` (Cursor, Codex, Hermes, Pi)
   and per-subdirectory canon are a likely v2; root-only canon keeps v1 honest.
10. **Canon location vs emerging standards.** `.agents/skills/` is becoming a
    shared convention; `.ai/` is ours. Canon-alignment (§5a) reduces generated
    files but entangles canon layout with harness conventions — revisit if more
    assets gain native shared locations.
11. **Unverified mechanisms.** OpenCode `instructions` resolution (V2), Hermes
    project-level skill dirs, Codex subagent config, Hermes delegation config —
    each needs hands-on verification before its adapter is built; all are marked
    defer/notice until then.
12. **Windows/symlinks.** Copies chosen over symlinks partly for this; keep it
    that way (§12) so generated trees survive Windows checkouts and odd git configs.

---

## 14. Open questions

1. **Skills canon alignment** — adopt `.agents/skills/` as physical canon (§5a)
   or copy-only from `.ai/skills/` (§5b)? Recommendation: (a).
2. **Rules strategy** — A, B, C, D or hybrid (§8). Recommendation: hybrid B + C
   escape hatch; verify OpenCode `instructions` before committing.
3. **Commands** — keep legacy dirs (copy) or generate-as-skills for Claude Code
   and Cursor now (§6)?
4. **Hooks** — confirm out of first-draft scope (§9).
5. **Package/install** — `harness-hub` console script on PyPI, run via
   `uvx harness-hub`.
6. **Canon folder default** — `.ai/` as umbrella for assets without a shared
   home; configurable in `harness-hub.json`. If §14.1 → (a), skills canon is
   repo-root `.agents/skills/` instead of `.ai/skills/`.
7. **Future-harness admission** — when Codex/Hermes/Pi/DeepSeek adapters are
   wanted, each starts as a verification spike (§13.11) before an adapter spec.
