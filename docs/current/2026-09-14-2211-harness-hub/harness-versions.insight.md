# Harness versions — research currency record

**Type:** research insight · companion to the per-asset insight files for harness-hub.
**Companion spec:** [`harness-wiring.spec.md`](./harness-wiring.spec.md).

Every per-asset insight file documents harness behavior that changes between
releases — discovery paths, caps, precedence rules, config schemas. This file
records which versions that research reflects, so each insight file can be
re-verified (or retired) when harnesses move. When revisiting any insight file,
start here: if a harness has moved major versions or changed release trains,
re-check its rows before trusting the matrix.

**Researched:** 2026-09-14 / 2026-09-15

## Roster

| Harness | Product | Version at research | Dated | Channel / notes | Where versions come from |
|---|---|---|---|---|---|
| **Claude Code** | Anthropic | **2.1.272** | 2026-09-15 | Stable, fast-moving patch train (2.1.x daily-ish); notable recent features: `/import` from other agents (2.1.213+), `.claude/rules/`, mouse config panel (2.1.271) | [CHANGELOG.md](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md), [release notes](https://support.claude.com/en/articles/12138966-release-notes) |
| **Cursor** | Anysphere | **3.x line** (changelog-entry dated; no single CLI version — IDE app releases) | 2026-09-10 | Cursor 3 is the current major (agent-first interface, released 2026-04); active changelog entries: Projects beta (2026-09-10), self-hosted machines (2026-09-02) | [Changelog](https://cursor.com/changelog) |
| **OpenCode** | SST / opencode | **1.18.31** | 2026-09-14 | Stable 1.x train; **a separate V2 docs/behavior line exists and diverges** (e.g. V2: `AGENTS.md` only, `mcp.servers` nesting, `instructions` not yet resolved, LSP inert) — insight files note V1/V2 splits where they matter | [Changelog](https://opencode.ai/changelog), [V2 docs](https://opencode.ai/v2/docs/) |
| **Codex** | OpenAI | **0.153.2** (0.154.0-alpha.3 pre-release) | 2026-09-03 | 0.x, frequent releases + alpha channel; recent: GPT-6 support (0.153.x) | [Releases](https://github.com/openai/codex/releases) |
| **Hermes** | Nous Research | **0.21.2** (tag `v2026.9.11`) | 2026-09-11 | Fast-moving; date-suffixed tags over 0.x semver; recent: state.db patch release, delegation config active | [Releases](https://github.com/NousResearch/hermes-agent) |
| **Pi** | Mario Zechner / badlogic (pi-mono) | **0.85.0** | 2026-09-04 | 0.x, weekly feature releases; also distributed as npm `@oh-my-pi/pi-coding-agent` (18.x repackaging train — do not confuse the two numberings) | [piagent.fyi news](https://piagent.fyi/news/), [CHANGELOG](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/) |
| **DeepSeek Harness (`dsh`)** | DeepSeek AI | **0.1.5-rc.1** (`latest` npm tag; `next` → 0.1.5-rc.2, `alpha` → 0.1.5-alpha.2) | 2026-09-10 | **Developer preview, officially breaking-change-prone**; npm dist-tags decide what "latest" means (rc.8 episode: `latest` and GitHub "Latest" both lagged `next`) | [npm `@deepseek-ai/dsh` dist-tags](https://www.npmjs.com/package/@deepseek-ai/dsh), [Releases](https://github.com/deepseek-ai/deepseek-harness) |

## Re-verification guidance

- **Trigger:** any insight-file revisit, any adapter design work, or a harness
  crossing a major boundary (Codex 0.x → 1.x, OpenCode 1.x → V2 default,
  DeepSeek rc → 1.0, Cursor major).
- **Method:** pull the harness's changelog/releases at the source links above,
  diff discovery-relevant changes (asset paths, precedence, caps, config
  schemas) against the relevant insight file's matrix rows.
- **Update:** bump the row here (version + date), then update insight files
  that changed. Insight files should carry no independent version claims —
  this file is the single source of research currency.
- **Special caution — DeepSeek:** in active developer preview; treat every
  discovery claim as re-verify-on-touch. **OpenCode:** confirm whether the V2
  line has become the default before trusting either behavior description.
  **Pi:** the npm repackaging (18.x) vs upstream (0.x) versioning can mislead
  changelog searches.
