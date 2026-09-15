# Agent doc — harness discovery research

**Type:** research insight · one of the per-asset insight files for harness-hub.
**Companion spec:** [`harness-hub.spec.md`](./harness-hub.spec.md) — implementation decisions live there.
**Asset:** the repo-root agent instructions file (`AGENTS.md` canon).

## Matrix

| Harness | Terminology | Discovery | Caveats |
|---|---|---|---|
| Claude Code | `CLAUDE.md` ("memory") | `CLAUDE.md` or `.claude/CLAUDE.md` (project); `CLAUDE.local.md` (personal); `~/.claude/CLAUDE.md` (user) | Does **not** read `AGENTS.md`; official import syntax `@AGENTS.md` inside `CLAUDE.md` |
| Cursor | `AGENTS.md` | Repo root + nested subdirectories; nested files combine, more specific wins | Native; no config needed |
| OpenCode | `AGENTS.md` ("project instructions") | Global file, then every `AGENTS.md` from workspace dir toward home (V2 semantics) | V2: `AGENTS.md` only, no `CLAUDE.md` fallback; `OPENCODE_DISABLE_PROJECT_CONFIG=1` skips |
| Codex | `AGENTS.md` ("project doc") | Global `$CODEX_HOME/AGENTS(.override).md`, then project root → cwd, **one file per directory** | `AGENTS.override.md` wins per directory; `project_doc_fallback_filenames` + `project_doc_max_bytes` (32 KiB default) |
| Hermes | "context files" | **First-match-wins per session**: `.hermes.md` > `AGENTS.override.md` > `AGENTS.md` > `CLAUDE.md` > `.cursorrules`; progressive subdirectory injection during session | Dynamic char cap (floor 20k, ceiling 500k); `SOUL.md` loads independently as identity |
| Pi | "context files" | `~/.pi/agent/AGENTS.md` (global), parent dirs walking up, cwd; `AGENTS.md` or `CLAUDE.md` | `AGENTS.override.md` replaces that directory's file; `-nc` disables discovery |
| DeepSeek | "agent instructions" | `$DSH_HOME/AGENTS.md` (fixed global), then per-directory **first existing** of `AGENTS.md`, `CLAUDE.md` (configurable `instructionFileCandidates`), root → cwd | `AGENTS.local.md` additive local overlay loads after base |

## Nuances

**Import mechanics.** Claude Code's `@AGENTS.md` import loads at session start with
the rest of `CLAUDE.md` appended after — Claude-specific notes can live below the
import. `/import` (v2.1.213+) offers a one-time *copy* migration from `AGENTS.md` —
harness-hub's pointer approach is preferable because it never forks content.

**Precedence files (interference risk).** `AGENTS.override.md` (Codex, Pi),
`AGENTS.local.md` (DeepSeek), `.hermes.md` (Hermes) can silently outrank or amend
`AGENTS.md`. Any status tooling should detect these per enabled harness. Cursor
has no override mechanism; Claude Code uses `CLAUDE.local.md` (personal, load
order: project → local → user).

**Size caps.** Codex 32 KiB default (configurable via `project_doc_max_bytes`),
Hermes dynamic (20k–500k chars), DeepSeek bounded instruction chain. Large canon
docs truncate silently and differently — worth measuring in `status`.

**Nested/progressive discovery.** Cursor (nested combine), Codex (per-dir chain),
Hermes (subdirectory progressive injection via tool-call hints), Pi (parent walk),
OpenCode (toward-home walk), DeepSeek (root→cwd per-directory). Monorepo support
is a natural v2; root-only canon keeps v1 honest.

**Modular splits.** Claude Code supports `.claude/rules/*.md` as a modular split
of instructions (see `harness-rules.insight.md`) rather than one giant `CLAUDE.md`.
