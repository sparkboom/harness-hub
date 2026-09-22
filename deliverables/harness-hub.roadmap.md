# harness-hub roadmap

Deliverable folders live under `deliverables/` (one folder per deliverable —
spec + plans together; see `AGENTS.md`), staged across `backlog/`,
`current/`, `complete/`, and `archive/`.

## Complete deliverables

| Folder | Spec | Scope | Status |
|---|---|---|---|
| [`2026-09-20-0021-harness-hub-mvp`](./complete/2026-09-20-0021-harness-hub-mvp/) | [`harness-hub-mvp.spec.md`](./complete/2026-09-20-0021-harness-hub-mvp/harness-hub-mvp.spec.md) | The smallest useful harness-hub: `AGENTS.md` + skills only, `enable`/`disable`/`doctor`, `harness-hub.json`/`.yaml` config, skill-frontmatter validation, best-effort wiring across all seven rostered harnesses | Complete |
| [`2026-09-20-2200-harness-hub-playground`](./complete/2026-09-20-2200-harness-hub-playground/) | [`harness-hub-playground.spec.md`](./complete/2026-09-20-2200-harness-hub-playground/harness-hub-playground.spec.md) | Consumer-repo playground + reusable test-fixture tooling (`harness-versions` manifest, generator, detection, probe, nix devShell, `list`/`info`) | Complete — partly superseded by `test-environment-tooling` (see its `RESOLUTION.md`) |

## Current deliverables

| Folder | Spec | Scope | Status |
|---|---|---|---|
| [`2026-09-21-0807-test-environment-tooling`](./current/2026-09-21-0807-test-environment-tooling/) | [`test-environment-tooling.spec.md`](./current/2026-09-21-0807-test-environment-tooling/test-environment-tooling.spec.md) | Reorganize dev/env tooling under `test/` (flake, tools, committed scaffold, ephemeral `test/env/` environments) | Spec drafted 2026-09-21 |

## Backlog (parked research / future planning)

Everything from the earlier, broader design pass that isn't in the MVP —
commands, rules, subagents, hooks, `AGENTS.md` templating, and the fuller
doctor-check set — is parked in one folder, ready to seed its own deliverable
when picked up:

| Folder | Contents |
|---|---|
| [`2026-09-20-0021-harness-hub-future`](./backlog/2026-09-20-0021-harness-hub-future/) | The original wiring spec + insight files, the `AGENTS.md` templating spec, and the deferred-assets insight files (subagents, hooks, other out-of-scope mechanics). See its `README.md` for a breakdown. |

## Sequencing

1. **MVP** ships first — `AGENTS.md` + skills, the three commands, and the
   generated-file conventions are the foundation everything else builds on.
2. **Commands, rules, subagents, hooks** each become their own deliverable
   later, starting from the corresponding research in `harness-hub-future/`.
3. **`AGENTS.md` templating** follows once the MVP's generated-file contract
   and doctor infrastructure are in place.
