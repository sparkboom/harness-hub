# harness-hub roadmap

Deliverable folders live under `docs/current/` (one folder per deliverable —
spec + plans together; see `AGENTS.md`). Active work moves to `docs/archive/`
when implemented.

## Active deliverables

| Folder | Spec | Scope | Status |
|---|---|---|---|
| [`2026-09-14-2211-harness-hub`](./current/2026-09-14-2211-harness-hub/) | [`harness-wiring.spec.md`](./current/2026-09-14-2211-harness-hub/harness-wiring.spec.md) | Wire-in/setup/config: canon layout, per-harness adapters (Claude Code, Cursor, OpenCode now; Codex, Hermes, Pi, DeepSeek tracked), CLI (`init`/`enable`/`disable`/`status`/`doctor`), generated-file safety | Spec drafted; §14.1–4 open questions pending; templating extracted out |
| [`2026-09-15-0932-agents-md-templating`](./current/2026-09-15-0932-agents-md-templating/) | [`agents-md-templating.spec.md`](./current/2026-09-15-0932-agents-md-templating/agents-md-templating.spec.md) | Optional AGENTS.md templating: Jinja2 template + values as canon, rendered doc as generated artifact, render-time ToC/composition, render-drift doctor check | Spec drafted (follow-up to wiring); design continues after wiring ships |

## Sequencing

1. **Wiring** ships first — the CLI, adapters, and §12 generated-file
   conventions are the foundation.
2. **Templating** follows — it builds on the §12 generated-file contract and
   doctor infrastructure, and renders the one asset every harness consumes.
