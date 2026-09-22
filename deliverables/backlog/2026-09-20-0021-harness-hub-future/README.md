# harness-hub — future deliverables (parked research & specs)

This folder consolidates everything from the original, broader harness-hub
design pass that is **not** part of the
[`harness-hub-mvp`](../../complete/2026-09-20-0021-harness-hub-mvp/harness-hub-mvp.spec.md)
deliverable. It's a reference shelf, not an active spec — each subfolder
keeps its original name and internal structure so its existing cross-links
still resolve.

| Folder | What it is |
|---|---|
| [`2026-09-14-2211-harness-hub`](./2026-09-14-2211-harness-hub/) | The original wiring spec (`harness-wiring.spec.md`) and per-asset insight files (agent doc, skills, commands, rules, harness versions). Superseded for the MVP's two assets (`AGENTS.md`, skills) by the MVP spec; still the source of record for commands, rules, and broader doctor checks. |
| [`2026-09-15-0932-agents-md-templating`](./2026-09-15-0932-agents-md-templating/) | The `AGENTS.md` templating spec (template + values → rendered doc). Not started; not part of the MVP. |
| [`2026-09-19-1046-harness-deferred-assets`](./2026-09-19-1046-harness-deferred-assets/) | Insight files for subagents, hooks, and other out-of-scope mechanics (workflows, memories, MCP, LSP, permissions, …). |

When any of this becomes its own deliverable, start from the relevant file
here rather than re-deriving it — most of the open questions have already
been researched, and several have settled decisions recorded inline.
