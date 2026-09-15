# Hooks — harness discovery research

**Type:** research insight · one of the per-asset insight files for harness-hub.
**Companion spec:** [`harness-wiring.spec.md`](./harness-wiring.spec.md) — implementation decisions live there.
**Researched against the harness versions in** [`harness-versions.insight.md`](./harness-versions.insight.md).
**Asset:** deterministic scripts/code bound to agent lifecycle events.

## Matrix

| Harness | Terminology | Discovery | Caveats |
|---|---|---|---|
| Claude Code | Hooks | `hooks` key in `.claude/settings.json` (project) + `.local.json` / user / policy / plugin `hooks/hooks.json` / skill-agent frontmatter | Rich event set incl. `SessionStart`, `PreToolUse`, `PostToolUse`, `FileChanged`, `InstructionsLoaded`; scripts conventionally in `.claude/hooks/` |
| Cursor | Hooks | `.cursor/hooks.json` (v1) + `~/.cursor/hooks.json`; plugin-installed | Stdio JSON protocol, spawned processes; lifecycle keys (`beforeShellExecution`, `afterFileEdit`, `preToolUse`, `sessionStart`, `workspaceOpen`, Tab hooks, …) |
| OpenCode | Plugins | `.opencode/plugins/` (JS modules) or `plugin` config entries | Code, not declarative config |
| Codex | — | No declarative hooks | — |
| Hermes | Shell hooks / plugin hooks / gateway event hooks | `hooks:` in `~/.hermes/config.yaml` (shell); `ctx.register_hook` (Python plugins, 26 lifecycle events); `~/.hermes/hooks/<name>/HOOK.yaml` (gateway) | Predominantly user-level, not project-committed |
| Pi | Extensions | `.pi/extensions/*.ts` / `~/.pi/agent/extensions/` (auto-discovered; project-local gated on trust) | TypeScript modules subscribing to events (`before_agent_start`, `tool_call`, `context`, …); can block/modify tool calls |
| DeepSeek | Plugin hooks | Cordis plugin system (`ctx.register_hook` equivalents) | Plugin code — **verify** |

## Nuances

**Not just formats — semantics.** Event vocabularies don't map 1:1 (Cursor's
`beforeShellExecution` vs Claude's `PreToolUse` with tool-name filters vs Pi's
extension events with block/modify powers vs Hermes's 26 plugin events). Payload
contracts and allow/deny powers differ. A canon hook needs per-harness
definitions regardless of format translation — hence "defer" in the spec.

**Where config lives matters.** Claude Code and Cursor are project-committable;
Hermes is user-level; OpenCode/Pi/DeepSeek are code modules. Only the first two
even admit a declarative canon story, and only Claude Code requires merge-editing
a shared settings file (ownership-tracking needed for clean `disable`).

**Trust gates.** Claude Code honors hooks after workspace-trust acceptance;
Pi loads project-local extensions only after trust resolution. Affects first-run
UX, not wiring mechanics.
