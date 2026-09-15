# Commands / prompt templates — harness discovery research

**Type:** research insight · one of the per-asset insight files for harness-hub.
**Companion spec:** [`harness-hub.spec.md`](./harness-hub.spec.md) — implementation decisions live there.
**Researched against the harness versions in** [`harness-versions.insight.md`](./harness-versions.insight.md).
**Asset:** markdown prompt-expanders invoked as `/name`. Pi's "prompt templates"
are the same asset under another name.

## Matrix

| Harness | Terminology | Discovery | Caveats |
|---|---|---|---|
| Claude Code | Custom slash commands | `.claude/commands/<name>.md` | Legacy but supported; converging into skills; `name`/`paths` frontmatter ignored |
| Cursor | Commands (legacy) | `.cursor/commands/` | Legacy; `/migrate-to-skills` converts them |
| OpenCode | Commands | `.opencode/commands/<name>.md` (nested paths → `/`-separated names); JSON definitions via config | Markdown body = prompt template |
| Codex | — | Skills serve as commands | No separate file format |
| Hermes | Slash commands | Auto-generated from installed skills | No separate file format |
| Pi | **Prompt templates** | `.pi/prompts/*.md` (project, **non-recursive**), `~/.pi/agent/prompts/`, packages, settings, CLI | Subdirectories must be added explicitly; project loading gated on trust |
| DeepSeek | — | Skills/plugins serve as commands | No separate file format |

## Nuances

**Same shape where it exists.** Markdown body = the prompt; frontmatter carries
`description`; argument substitution conventions overlap (`$ARGUMENTS`, positional
refs; Pi adds defaults and slicing plus `argument-hint` frontmatter).

**OpenCode extras.** JSON command definitions in config support `agent`, `model`,
`subagent` (background child session) fields; registry precedence is project >
global, nearer sources replace earlier ones; hot-reloads on save.

**Convergence risk.** Claude Code and Cursor are both folding commands into
skills — generating both forms for the same canon asset risks `/deploy`
appearing twice per harness. Pick one form per harness (spec §14.3).

**Pi trust gating.** `.pi/prompts/` only loads after the project is trusted —
a first-run UX consideration, not a blocker.
