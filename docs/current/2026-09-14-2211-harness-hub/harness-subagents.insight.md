# Subagents — harness discovery research

**Type:** research insight · one of the per-asset insight files for harness-hub.
**Companion spec:** [`harness-hub.spec.md`](./harness-hub.spec.md) — implementation decisions live there.
**Researched against the harness versions in** [`harness-versions.insight.md`](./harness-versions.insight.md).
**Asset:** delegatable sub-agent definitions.

## Matrix

| Harness | Terminology | Discovery | Caveats |
|---|---|---|---|
| Claude Code | Subagents | `.claude/agents/<name>.md` (markdown + frontmatter); `~/.claude/agents/` (user) | Frontmatter: model, tools, description |
| Cursor | — | No equivalent today | — |
| OpenCode | Agents | `.opencode/agents/` (markdown or JSON); `agent` key in `opencode.json` | Primary/secondary agent modes |
| Codex | Subagents ("agent roles") | `[agents]` in `config.toml` | Config-declared; project-config restricted keys — **verify** what's project-legal |
| Hermes | Delegation | `delegate_task` tool + `delegation.*` config (model, provider, worktree_isolation, concurrency) | Config-driven — **verify** |
| Pi | — | None native (extensions could add) | Deliberate minimalism |
| DeepSeek | Subagents | Plugin-provided (Standard-mode capability) | Plugin/config territory — **verify** |

## Nuances

**Three models of declaration.** File-based (Claude Code, OpenCode), config-based
(Codex, Hermes), and plugin-based (DeepSeek). File-based harnesses are the only
copy targets; config-based harnesses would need merge-edits into files that are
often user-level rather than project-committed.

**Frontmatter variance.** Claude Code agent files carry their own frontmatter
(model, tools, description) — canon subagent files would need a schema decision
before any compile step; OpenCode accepts markdown or JSON with a richer schema.

**Verification debt.** Codex `[agents]` project-legality, Hermes `delegation.*`
shape, and DeepSeek's plugin contract are all marked **verify** — none should be
wired without a hands-on spike.
