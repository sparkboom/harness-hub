# Commands / prompt templates — harness discovery research

**Type:** research insight · one of the per-asset insight files for harness-hub.
**Companion spec:** [`harness-wiring.spec.md`](./harness-wiring.spec.md) — implementation decisions live there.
**Asset:** markdown prompt-expanders invoked as `/name` ("slash commands"; Pi calls the same shape "prompt templates").
**Researched against the harness versions in** [`harness-versions.insight.md`](./harness-versions.insight.md).
**Re-verified 2026-09-15:** Claude Code commands↔skills merge; Cursor commands retirement; OpenCode skill slash-invocation; Pi `/skill:name`.

**Status: demoted asset (spec §6, resolved 2026-09-15).** Skills now cover the
user-invocation surface on every harness (coverage detail:
[`harness-skills.insight.md`](./harness-skills.insight.md) — "Command
coverage"). Commands remain a legacy compatibility surface; the repo
convention is migrate-to-skills. This file records the legacy machinery for
repos that still carry commands — primarily for positional-argument
substitution, the one capability skills lack.

## Matrix

| Harness | Terminology | Discovery | Caveats |
|---|---|---|---|
| Claude Code | Custom slash commands (merged into skills) | `.claude/commands/<name>.md` (project), `~/.claude/commands/` (user); nested dirs → namespaced names | Commands and skills "create the same `/name` and work the same way" — a command file and a skill of the same name collide (skills take precedence); existing files keep working; docs steer new work to skills |
| Cursor | Commands (legacy) | `.cursor/commands/<name>.md` (workspace), `~/.cursor/commands/` (user) | Legacy: docs page retired (as of mid-2026), files still load; `/migrate-to-skills` converts them, preserving manual-only invocation via `disable-model-invocation: true`; new slash workflows belong in skills |
| OpenCode | Commands | `.opencode/commands/<name>.md` (nested paths → `/`-separated names); JSON definitions in config | Markdown body = prompt template; JSON commands add `agent`/`model`/`subagent` routing; registry precedence project > global, nearer sources replace earlier ones; hot-reloads on save |
| Codex | — | Skills serve as commands | No separate file format |
| Hermes | Slash commands | Auto-generated from installed skills | No separate file format |
| Pi | Prompt templates | `.pi/prompts/*.md` (project, **non-recursive**), `~/.pi/agent/prompts/`, packages, settings, CLI | **Dropped from wiring (spec §6):** skills already register `/skill:name` with args; templates add only positional substitution, defaults, and slicing — redundant for our purposes; project loading gated on trust |
| DeepSeek | — | Skills/plugins serve as commands | No separate file format |

## Failure modes

Things that can go wrong with the commands asset, how each can be identified,
its impact, and possible resolutions. Resolutions are deliberately open — how
(any tooling) addresses them is an implementation concern, not research.

| Failure mode | What goes wrong | How to identify | Impact / consequence | Possible resolutions |
|---|---|---|---|---|
| **Duplicate command surface** | The same `/name` is registered by both a command file and a skill | Cross-scan command dirs and skill dirs per harness; also caught from the skills side (skills insight, "Duplicate command surface") | Double entries in catalogs; `/name` resolves to different machinery per harness (Claude Code: skills win; OpenCode: commands register over skills) | • One form per asset — never generate both<br>• Migrate the command to a skill and drop the file |
| **Argument-handling mismatch** | Command bodies substitute `$ARGUMENTS`/`$1`/`$N`; skill invocation passes trailing text as the user request and leaves placeholders literal — migrating a positional command to a skill verbatim breaks argument flow | Grep canon commands for `$ARGUMENTS`/`$N` before migration | Migrated command ignores or misplaces user args | • Rewrite the body to consume the trailing request<br>• Keep as legacy command while positional substitution is genuinely needed |
| **Frontmatter dialect drift** | Command dialects differ per harness: Claude (`description`, `argument-hint`, `allowed-tools`, `model`, `disable-model-invocation`), OpenCode file commands (`description`; routing fields live in JSON config), Pi (`argument-hint` + defaults/slicing), Cursor (none — filename is the name) | Diff canon command frontmatter against each target harness's dialect | Keys silently ignored (Cursor) or expected behavior missing (OpenCode JSON-only fields) | • Keep canon commands to the common subset<br>• Accept per-harness degradation knowingly<br>• Prefer skills, whose dialect is the Agent Skills standard |
| **Name/namespace collisions** | Nested command paths become namespaced names (`/dir:name` in Claude Code; `/`-separated in OpenCode); collisions with skills or between commands | Inventory command files including nested paths; compare names against skill names | Unexpected command names; shadowed entries | • Flat names for canon commands<br>• Dedupe against skills before wiring |
| **Config merge drift (OpenCode JSON)** | JSON-config commands (the only place `agent`/`model`/`subagent` routing exists) live in `opencode.json`, not files — generated entries need tracked key ownership | Compare harness-hub-owned config keys against the ownership ledger (spec §10) | `disable` leaves stale entries behind or removes user-owned keys | • Track key ownership; merge-edit preserving JSONC comments (spec §11.5) |
| **Pi trust gating** | `.pi/prompts/` loads only after the project is trusted | First-run session in an untrusted project | Commands silently absent on first run | • Dropped from wiring — moot unless a repo insists on Pi templates |

## Mechanics reference

**The command shape where it exists.** Markdown body = the prompt template;
frontmatter carries behavior hints; all fields are optional everywhere —
a bare markdown file is a valid command. Argument substitution conventions
overlap: `$ARGUMENTS` (all args), `$1`/`$2` (positional). Pi adds defaults
and slicing. Claude's `argument-hint` only documents autocomplete expectations.

**Frontmatter dialects (command flavor).**

- **Claude Code:** `description`, `argument-hint`, `allowed-tools` (a per-turn
  pre-approval grant that clears on the next message — not a restriction),
  `model` (per-invocation override, `inherit` to keep active), `disable-model-invocation`.
- **OpenCode:** file commands carry `description`; routing fields (`agent`,
  `model`, `subagent`) exist only in JSON config definitions.
- **Pi:** `argument-hint`, positional refs with defaults and slicing.
- **Cursor:** none — the filename is the command name, the body is the prompt.

Claude command bodies also support `@path` file references and `` !`cmd` ``
bash pre-execution — Claude-only syntax, literal noise elsewhere.

**Convergence & migration paths.** Claude Code merged commands into skills
(`/name` from either location; skills take collision precedence) and documents
commands as legacy-but-supported. Cursor retired the commands docs page; files
still load, and the built-in `/migrate-to-skills` converts commands while
keeping manual-only invocation. OpenCode skills are slash-invocable; file
commands remain the positional-substitution surface. Pi skills cover
invocation; templates remain for positional substitution and defaults. Codex,
Hermes, and DeepSeek never had a separate format — skills were always the
command surface.

**Why demoted, not deleted.** Everything a command does except positional
substitution (and OpenCode-style routing), a skill now does — with supporting
files, optional model-invocation, and cross-harness portability. Canon
`.agents/commands/` keeps legacy repos working; new assets belong in
`.agents/skills/` (spec §5).
