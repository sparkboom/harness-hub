# Harness implementation stacks — research insight

**Type:** research insight · fed the "implementation stack, packaging &
install" open question.
**Decided (2026-09-20):** TypeScript / Node.js, npm-distributed — see
`harness-hub-mvp.spec.md` header. The "Non-binding lean" below is kept for
the reasoning trail; treat it as historical, not open.
**Researched:** 2026-09-20, via public repos/docs/npm listings. Not pinned to
`harness-versions.insight.md`'s dated snapshot — re-check before relying on
distribution-channel claims if a harness has since re-platformed.

**Question this answers:** does harness-hub's own implementation language
need to match any harness's internals? (It doesn't — harness-hub never
embeds in or calls a harness process; it only reads/writes text files a
harness later discovers on disk.) This file instead records what each
harness is built with and how it's distributed, since that's the part
relevant to a language/distribution choice for harness-hub itself.

## Matrix

| Harness | Core implementation | Plugin/extension language | Primary distribution |
|---|---|---|---|
| Claude Code | Native compiled binary (opaque; historically Node/TS-derived) | Skills/commands/hooks are markdown + JSON + shell — language-agnostic | **npm** (`@anthropic-ai/claude-code`, postinstall pulls a per-platform native binary) |
| Cursor | Electron / TypeScript (VS Code-derived IDE) | Rules/skills are markdown/`.mdc` — language-agnostic | IDE installer (not a CLI harness-hub would shell out to) |
| OpenCode | **TypeScript** (client/server API); Go only for the TUI frontend | TypeScript (extensions run against the TS server) | **npm** (`opencode-ai`), also Homebrew/Nix |
| Codex | **Rust** (`codex-rs`, the maintained implementation) | No general plugin language; skills are `SKILL.md` + YAML sidecar | **npm** (`@openai/codex`, TS wrapper installs the native Rust binary), also Homebrew/direct download |
| Hermes | **Python** (~88% of the codebase — agent loop, tools, skills, gateway); TypeScript only for the React/Ink terminal UI | Skills are `SKILL.md` (agentskills.io format); no separate plugin language for extending core behavior | **pip/uv** (`pyproject.toml`) — the one harness *not* on npm |
| Pi | **TypeScript** end-to-end (`pi-mono` monorepo) | TypeScript extensions (tools, commands, UI, event handlers) — first-class, documented SDK | **npm** (`@mariozechner/pi-coding-agent` / `@earendil-works/pi-coding-agent`) |
| DeepSeek (`dsh`) | **TypeScript** (Cordis "everything-is-a-plugin" framework); some Python/C/C++ in the wider repo | TypeScript (Cordis plugin bundles); a Python SDK exists as a thin wrapper around the same `dsh` runtime | **npm** (`@deepseek-ai/dsh`) |

## Synthesis

- **6 of 7 harnesses are npm-distributed** (Claude Code, OpenCode, Codex, Pi,
  DeepSeek as CLIs; Cursor as the IDE ecosystem around the same
  markdown/JSON asset formats). **Hermes is the one outlier** — Python/pip,
  no npm presence.
- **3 of 7 have a TypeScript-native core and/or extension system** (OpenCode,
  Pi, DeepSeek) where a JS/TS harness-hub could, if ever useful, share types
  or ship as a native extension. Codex's core is Rust; Claude Code's is an
  opaque native binary; Hermes's is Python; Cursor's is Electron/TS but not a
  CLI target.
- **No harness requires harness-hub to run inside its process or call its
  internals.** Every asset harness-hub touches (`AGENTS.md`, `SKILL.md`,
  `CLAUDE.md`, `harness-hub.yaml`/`.json`) is a plain text file read
  independently by each harness's own discovery logic. Language choice is a
  distribution/ergonomics question, not an integration requirement.

## Non-binding lean

If/when the tooling research pass (deferred) picks this up: **TypeScript/Node
is the more consistent fit**, primarily because `npx`/`npm install -g` is
already the expected install path for 6 of the 7 target harnesses — a
`npx harness-hub enable claude-code` command matches user muscle memory these
repos already have. YAML/frontmatter tooling is mature on both sides (Node's
`yaml` package round-trips comments/formatting; Python's `ruamel.yaml` does
too), so parser ecosystem doesn't tip the decision either way. Python isn't
disqualified — it's simply the minority distribution channel here (1 of 7),
where TS/Node is the minority core language in only 2 of 7 (Codex: Rust;
Hermes: Python) and the majority distribution channel in 6 of 7. This is a
lean, not a decision — it belongs to the deferred tooling research pass, and
should be re-evaluated against real prototyping (e.g. file-watching, cross-
platform symlink/copy behavior, packaging size) before being locked in.

## Windows / symlinks (parked, 2026-09-20)

The MVP deliverable (`harness-hub-mvp.spec.md`) went with symlink-based
wiring for Claude Code (`CLAUDE.md` → `AGENTS.md`, `.claude/skills` →
`.agents/skills`) and explicitly dropped Windows from scope rather than
solve for it now. If Windows support is picked up later, the likely
mechanism is a **directory junction** (`fs.symlinkSync(target, path,
'junction')` in Node) for `.claude/skills` — junctions don't require
Developer Mode or admin, unlike real Windows symlinks, though they need an
absolute target path and only work on the local volume. `CLAUDE.md` is a
file, not a directory, so it would need a real Windows symlink (privileged)
or fall back to the old generated-stub-with-marker-comment approach on that
platform only. Either way, generated links/stubs should stay gitignored, not
committed — a symlink committed on macOS/Linux checks out as a broken plain
file on a Windows clone without `core.symlinks` + privilege, which is the
core reason this was parked rather than half-solved.
