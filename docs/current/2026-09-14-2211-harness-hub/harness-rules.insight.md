# Rules — harness discovery research

**Type:** research insight · one of the per-asset insight files for harness-hub.
**Companion spec:** [`harness-hub.spec.md`](./harness-hub.spec.md) — implementation decisions live there.
**Asset:** scoped instruction modules (path-gated or always-on guidance).

## Matrix

| Harness | Terminology | Discovery | Caveats |
|---|---|---|---|
| Claude Code | Rules (path-scoped memory) | `.claude/rules/*.md`, optional `paths:` frontmatter for conditional loading | Also fires `InstructionsLoaded` hook on load; frontmatter `paths` uses glob patterns |
| Cursor | Project Rules | `.cursor/rules/*.mdc`, **required** frontmatter: `description`, `globs`, `alwaysApply` | Plain `.md` in the dir is **ignored** (no frontmatter = not a rule); auto-attach via `globs` |
| OpenCode | Instructions | `instructions` globs in `opencode.json` (e.g. `["docs/*.md", "packages/*/AGENTS.md"]`) | **V2 does not resolve** `instructions` entries yet — treat as non-starter; use `AGENTS.md` for instructions |
| Codex | — | `AGENTS.md` is the only instruction channel | `project_doc_fallback_filenames` could treat a canon file as an instructions file — **verify** |
| Hermes | — (compat) | Reads `.cursorrules` + `.cursor/rules/*.mdc` CWD-only for Cursor compat | Not a native concept; CWD-only scope |
| Pi | — | None | — |
| DeepSeek | — | None (`AGENTS.md` channel only) | — |

## Nuances

**The divergence hotspot.** Rules is where "one canon file, wire everywhere"
first breaks: Cursor needs `.mdc` + strict frontmatter, Claude Code wants `.md`
+ optional `paths:`, OpenCode has no directory at all, and three harnesses have
no channel whatsoever.

**Scoping semantics differ.** Cursor's `alwaysApply`/`globs` vs Claude Code's
`paths:` (conditional load on file match) are *similar but not identical*
mechanisms — a compiler must decide what `alwaysApply: false` with no globs
means cross-harness (Cursor: dynamic/on-demand rule; Claude: no equivalent →
treat as always-on or drop?).

**Frontmatter requirements are asymmetric.** Claude Code rules are valid with
*no* frontmatter; Cursor requires it. A "lowest common denominator" canon rule
must therefore carry Cursor's keys — making Cursor's dialect the de facto canon
format under any passthrough option (spec option A).

**Codex fallback-filename possibility.** `project_doc_fallback_filenames` in
`.codex/config.toml` can add a canon file (e.g. `.ai/rules/*.md` entries won't
work — it's filename-based, not glob-based — but a single canon rules file
could). Semantics: fallback names apply **per directory**, same one-file
limit. **Verify before relying on it.**

**Hermes compat reading.** Hermes reads Cursor's rule formats only at CWD (not
nested, not progressive) — a real Cursor setup works for Hermes by accident,
but it's not a channel harness-hub should target.
