# harness-hub roadmap

Deliverable folders live under `docs/current/` (one folder per deliverable —
spec + plans together; see `AGENTS.md`). Active work moves to `docs/archive/`
when implemented.

## Active deliverables

| Folder | Spec | Scope | Status |
|---|---|---|---|
| [`2026-09-20-0021-harness-hub-mvp`](./current/2026-09-20-0021-harness-hub-mvp/) | [`harness-hub-mvp.spec.md`](./current/2026-09-20-0021-harness-hub-mvp/harness-hub-mvp.spec.md) | The smallest useful harness-hub: `AGENTS.md` + skills only, `enable`/`disable`/`doctor`, `harness-hub.json`/`.yaml` config, skill-frontmatter validation, best-effort wiring across all seven rostered harnesses | Spec drafted 2026-09-20 |

## Future deliverables (parked research)

Everything from the earlier, broader design pass that isn't in the MVP —
commands, rules, subagents, hooks, `AGENTS.md` templating, and the fuller
doctor-check set — is parked in one folder, ready to seed its own deliverable
when picked up:

| Folder | Contents |
|---|---|
| [`2026-09-20-0021-harness-hub-future`](./current/2026-09-20-0021-harness-hub-future/) | The original wiring spec + insight files, the `AGENTS.md` templating spec, and the deferred-assets insight files (subagents, hooks, other out-of-scope mechanics). See its `README.md` for a breakdown. |

## Sequencing

1. **MVP** ships first — `AGENTS.md` + skills, the three commands, and the
   generated-file conventions are the foundation everything else builds on.
2. **Commands, rules, subagents, hooks** each become their own deliverable
   later, starting from the corresponding research in `harness-hub-future/`.
3. **`AGENTS.md` templating** follows once the MVP's generated-file contract
   and doctor infrastructure are in place.
