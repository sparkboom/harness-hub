# Skills — harness discovery research

**Type:** research insight · one of the per-asset insight files for harness-hub.
**Companion spec:** [`harness-hub.spec.md`](./harness-hub.spec.md) — implementation decisions live there.
**Asset:** `SKILL.md` directories (Agent Skills).

## Matrix

| Harness | Terminology | Discovery | Caveats |
|---|---|---|---|
| Claude Code | Skills / custom commands (merged) | `.claude/skills/<name>/SKILL.md`; also loaded from `--add-dir` directories | Skills take precedence over legacy commands on name collision |
| Cursor | Agent Skills | `.cursor/skills/`, **`.agents/skills/`** (+ `.claude/skills/`, `.codex/skills/` compat), nested project dirs auto-scoped | Category folders OK (walks to `SKILL.md`); `paths` frontmatter scoping |
| OpenCode | Skills | `.opencode/skills/` (`*/SKILL.md`), loaded on demand | — |
| Codex | Skills ("reusable workflows") | **`.agents/skills/`** (cwd → repo root), `$HOME/.agents/skills/` (user) | Same-name skills are **not merged** — both appear in selectors |
| Hermes | Skills (install/hub model) | `hermes skills install` from hubs/URLs (with security scan); `~/.hermes/skills/` | Project-local skill dir **unverified**; skills auto-expose as slash commands (up to 5 chained) |
| Pi | Skills (`/skill:name`) | **`.agents/skills/`**, `.pi/skills/`, `~/.pi/agent/skills/`, packages | Implements the Agent Skills standard; lenient (allows `name` ≠ directory name) |
| DeepSeek | Skills | **`.agents/skills/`**, `.dsh/skills/`, `~/.dsh/skills/`, `~/.agents/skills/` | Skills are a plugin capability |

## Nuances

**The standard.** `SKILL.md` is formalizing at [agentskills.io](https://agentskills.io)
(required: `name`, `description`; optional: `license`, `compatibility`,
`metadata`, `allowed-tools`, `disable-model-invocation`). Pi implements the spec
and warns on violations but stays lenient — notably allowing `name` to differ
from the parent directory, which the standard disallows but shared skill dirs favor.

**`.agents/skills/` — the emerging shared convention.** Read natively by Codex
(cwd→root walk), Cursor, Pi, and DeepSeek. This is why the spec's canon-alignment
question (§5) exists: aligning skills canon here wires four harnesses with zero
generated files.

**Frontmatter dialect drift.** Harness-specific extensions beyond the standard:
Hermes (`platforms`, `requires_toolsets`, `requires_tools`, `fallback_for_toolsets`,
`config:` settings, `blueprint:`), Claude/Cursor (`disable-model-invocation`,
`paths`). Codex keeps UI metadata in a separate `agents/openai.yaml` sidecar
(`allow_implicit_invocation`, tool dependencies). Adapters must pass unknown
frontmatter through untouched.

**Supporting files.** Standard layout: `SKILL.md` + optional `scripts/`,
`references/`, `assets/` — relative paths from `SKILL.md` must survive any copy.

**Hermes install model.** Skills come from hubs (`hermes skills browse/search/install`,
sources: official, skills.sh, URLs), are agent-manageable (`skill_manage` tool),
and can declare config settings stored under `skills.config` in `config.yaml`.
Whether a *project-local* skills directory is discovered is **unverified** —
spike before any adapter.

**Management.** Codex disables skills per-path via `[[skills.config]]` in
`config.toml`; Cursor's `/migrate-to-skills` converts rules/commands into skills.
