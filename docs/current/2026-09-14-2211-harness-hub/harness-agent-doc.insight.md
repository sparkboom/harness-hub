# Agent doc — harness discovery research

**Type:** research insight · one of the per-asset insight files for harness-hub.
**Companion spec:** [`harness-wiring.spec.md`](./harness-wiring.spec.md) — implementation decisions live there.
**Asset:** the repo-root agent instructions file (`AGENTS.md` canon).
**Researched against the harness versions in** [`harness-versions.insight.md`](./harness-versions.insight.md).

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

## Failure modes

Things that can go wrong with the agent-doc asset, how each can be identified,
its impact, and possible resolutions. Resolutions are deliberately open — how
(any tooling) addresses them is an implementation concern, not research.

Note that several of these are **non-issues under certain configurations**: the
set of enabled harnesses, their versions, and repo conventions determine whether
a failure mode applies at all. Examples: precedence files only matter for
harnesses that read them; truncation only for harnesses with caps (and only at
the configured limits, which vary by version); import syntax only if the canon
uses `@`-references. Version drift can also *retire* a failure mode (a harness
gaining native `AGENTS.md` support, a raised cap, a new precedence file) —
this research is pinned to the versions in `harness-versions.insight.md`.

| Failure mode | What goes wrong | How to identify | Impact / consequence | Possible resolutions |
|---|---|---|---|---|
| **Precedence interference** | `.hermes.md`, `AGENTS.override.md` (Codex, Pi), `AGENTS.local.md` (DeepSeek), `CLAUDE.local.md` (Claude Code), `.cursorrules` (Hermes, CWD-only) outrank or amend canon `AGENTS.md` — silently | Presence-scan for each enabled harness's known precedence files at root and in subdirectories; check git-tracked vs ignored | Agent acts on stale or personal guidance instead of canon; behavior differs per harness with no visible signal | • Delete the file if stale<br>• Gitignore it if it's personal/local by design<br>• Merge its content into canon `AGENTS.md`, then remove it<br>• Accept it knowingly (documented override) |
| **Silent truncation** | Size-capped harnesses (Codex 32 KiB default, Hermes dynamic 20k–500k chars, DeepSeek bounded chain) drop doc content — each differently, none loudly | Measure canon doc size against each enabled harness's cap/threshold; oversized nested docs count too | Tail guidance (often verification steps, warnings) missing for some harnesses; inconsistent agent behavior across harnesses | • Trim the doc to fit the smallest cap<br>• Move task-scoped guidance into skills<br>• Move conventions into scoped assets (rules, nested docs)<br>• Raise caps where harnesses allow (per-user config) |
| **Harness-specific import syntax** | `@path` import lines inside canon resolve in **Claude Code only**; other harnesses see literal text and never load the target | Scan canon for `@`-reference-style lines; check whether referenced files exist and are otherwise reachable | Content divergence: Claude gets imported content, everything else doesn't; or literal `@path` noise in other harnesses' context | • Inline the target content into canon<br>• Keep it as a deliberate Claude-only addition (documented)<br>• Link the target as a plain relative-path reference (see guidance gap below) instead of an import |
| **Referenced-docs guidance gap** | Instructions living only behind relative-path references (`see docs/standards.md`) are not auto-loaded by most harnesses — an agent may never read them | Extract relative-path references from canon; flag broken targets; estimate how much guidance is referenced vs inline | Critical instructions (conventions, verification, safety) possibly never surface | • Inline critical instructions<br>• Fix broken references<br>• Keep references only for supplementary depth<br>• (Where a harness supports instruction-file config, reference the docs there) |
| **Nested file conflicts** | Nested `AGENTS.md`/`CLAUDE.md` below the root are discovered progressively (see mechanics below) and can duplicate or contradict root canon; nested `AGENTS.override.md` wins for its subtree in Codex/Pi | Inventory instruction files + override variants below repo root; compare their content for overlap/contradiction with root canon | Conflicting guidance per subtree; surprising precedence in some harnesses only | • Keep general guidance root-only; subtree files for genuinely scoped rules<br>• Remove nested override files unless intentional<br>• Align nested content with canon (dedupe) |
| **Missing/empty canon doc** | No (or whitespace-only) root `AGENTS.md` | Presence + content check | Native readers get nothing; importers (Claude) import an empty file | • Create/scaffold `AGENTS.md`<br>• Defer wiring until the doc exists |
| **Unmarked hand-written `CLAUDE.md`** | A user-authored `CLAUDE.md` exists alongside canon `AGENTS.md` | Presence of `CLAUDE.md` that isn't a known pointer/generated file | Claude reads the hand-written doc and misses canon guidance (or vice versa); divergence grows over time | • Fold its content into canon `AGENTS.md` (Claude-specific notes can sit under the `@AGENTS.md` import)<br>• Replace it with a pointer to `AGENTS.md`<br>• Keep it knowingly as a Claude-only doc (documented) |

## Mechanics reference

**Nested/progressive discovery.** "Nested" means four different things across
the seven harnesses: Cursor *combines* nested files (more specific wins); Codex
and DeepSeek *chain* one file per directory root→cwd; Hermes, Pi, and OpenCode
*inject* files progressively as the agent touches subdirectories; Claude Code
loads subtree `CLAUDE.md` when working in that subtree. Consequence for canon
design: root-only canon is the safe v1; nested canon is a possible later
extension, and nested-file *inventory* is useful regardless.

**Modular splits.** Three mechanisms tempt authors to split `AGENTS.md`:

1. *Imports* (`@AGENTS.md`-style) — Claude Code only (see failure mode above).
2. *Referenced docs* — portable in principle (any harness can read a linked
   doc) but nothing auto-loads them (see guidance gap above).
3. *Scoped instruction modules* — Claude Code's `.claude/rules/` and Cursor's
   `.cursor/rules/` are per-harness mechanisms; they belong to the rules asset
   (see `harness-rules.insight.md`), not this one.
