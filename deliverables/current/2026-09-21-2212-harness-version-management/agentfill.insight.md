# agentfill — research insight

**Type:** research insight · companion to the harness-version-management deliverable.
**Companion spec:** [`harness-version-management.spec.md`](./harness-version-management.spec.md).
**Subject:** [nevir/agentfill](https://github.com/nevir/agentfill) — a "polyfill" that
standardizes `AGENTS.md` + Agent Skills support across Claude Code, Gemini CLI,
and Cursor.

## What it is

agentfill installs a set of shell scripts (globally, or per-project as
committed repo files) that normalize how each agent loads project context. One
installer (`curl -fsSL https://agentfill.dev/install | sh`) wires up hooks and
symlinks so a single authored `AGENTS.md` + `.agents/skills/` tree is honored
uniformly across agents.

## What it does, mechanically

Three techniques, mapped to the surfaces it targets:

1. **AGENTS.md injection via hooks.** Where an agent has no native `AGENTS.md`
   support (Claude Code; Cursor IDE), a `sessionStart` hook discovers the
   `AGENTS.md` files and injects them into context. Claude Code gets the content
   inlined with precedence instructions; Cursor gets it via a JSON
   `{"additional_context": ...}` payload. The hook approach is *why* it works on
   surfaces that never intended to read `AGENTS.md` natively.
2. **Symlinking skills.** `.agents/skills/` is symlinked into each agent's native
   skills dir (`.claude/skills/`, `.cursor/skills/`, `.gemini/skills/`) so the
   agent discovers skills *natively* — hot-reload and all — with a single source
   of truth.
3. **Config shimming.** For Gemini CLI, it sets `context.fileName` so `AGENTS.md`
   loads alongside `GEMINI.md` (Gemini already walks the tree natively, so no
   polyfill hook is needed there).

## Its framing of the problem (the part worth stealing)

agentfill's central claim is a **native-support matrix** — it asserts, per agent,
which capabilities exist out of the box:

| Agent | AGENTS.md (basic) | Nested | Selective | Skills |
|---|---|---|---|---|
| Claude Code | ❌ | ❌ | ❌ | ✅ native |
| Gemini CLI | ⚠️ configurable | ✅ | ❌ | ⚠️ experimental |
| Cursor IDE | ✅ | ❌ | ✅ | ✅ native |

The insight is that the *same feature* lands at a different place on the
native→polyfill spectrum per agent, and the tool's whole design is "polyfill the
❌/⚠️ cells so the ✅-like behavior is uniform."

This maps **directly onto our `agentsDoc`/`skills` convention modes**: agentfill's
"hook-inject" ≈ our `symlink`/`migrate` modes for Claude; its "native symlink" ≈
our `native` skills mode; its Cursor-IDE hook ≈ a *manual/unverifiable* surface.
It is strong corroboration that our per-surface profile model is the right shape.

## What it's missing (our divergence)

1. **No version ranges.** The README's matrix is version-agnostic — a single
   static claim per agent ("Claude Code ❌"). It does **not** record *which
   version* a row was verified against, nor track drift when an agent adds native
   support (Cursor's CLI gained native skills/hooks in 2026, which flatly
   contradicts older "CLI has no hooks/skills" claims). This is the exact gap our
   version-range registry exists to close: agentfill asserts "now", we assert
   "now, and for which semver range."
2. **No verification loop.** It installs and assumes; it has no reconcile/check
   story, no "is my claim still true after an agent update?" trigger. Our
   `reconcile --check` + testbed matrix is that missing loop.
3. **Binary install, no review artifact.** `install.sh` mutates the environment;
   there's no recorded evidence of *how* a claim was verified (no probe output,
   no reviewed-version ledger).

## Inspiration we should adopt

- **The native-support matrix as a first-class artifact.** A per-harness ×
  per-surface table (AGENTS.md / skills / trust gate / session) is a better
  mental model than our current implicit per-id blocks. Consider surfacing it in
  the registry (even if generated from profiles) rather than burying it in
  `data.ts`.
- **Hook-based AGENTS.md injection** as a *profile option*. Our Claude Code
  profile already does `symlink` (`CLAUDE.md`) + `migrate-symlink` (`.claude/skills`);
  agentfill confirms the hook-injection alternative for agents that read
  `AGENTS.md` only via their proprietary file. Worth noting as a future profile
  mode, not a first-draft change.

## What we explicitly do *not* take

- The polyfill/hook machinery itself (we wire native conventions, not inject via
  sessionStart hooks — at least for the MVP).
- The binary `curl | sh` install model (we express mechanics declaratively in
  `config.json` + code, not via an installer script).
- The version-agnostic assertions (our whole point is version ranges + status).

## Follow-ups

- Re-check agentfill's matrix against Cursor CLI's 2026 native skills/hooks
  support — its README may lag upstream, which is itself a live demonstration of
  the drift problem our registry solves.
