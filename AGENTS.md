# AGENTS.md — harness-hub

Guidance for AI agents (and humans) working in this repo. Cursor rules in
`.cursor/rules/` mirror parts of this file — keep the two in sync.

## Deliverables workflow: specs & plans

Spec and plan documents live in dated, per-deliverable folders under
`deliverables/`. This folder holds planning and execution documents (not
general documentation), so it's named `deliverables/`, not `docs/`.

Four stage subfolders:

- `deliverables/backlog/{datetime}-{project}/` — planning documents for
  future work, at various stages of planning (not yet being worked on).
- `deliverables/current/{datetime}-{project}/` — either currently being
  planned/worked on, or actively executing.
- `deliverables/complete/{datetime}-{project}/` — moved here after execution
  has completed.
- `deliverables/archive/{datetime}-{project}/` — documents that have been
  processed and compacted for long-term reference (the compaction process is
  not yet established).

Conventions:

1. `{datetime}` is the folder's creation time in `YYYY-MM-DD-HHMM` format,
   e.g. `2026-09-14-2137`. Keep the original datetime when moving folders
   between stages.
2. `{project}` is a short kebab-case slug for the deliverable,
   e.g. `user-auth`.
3. One folder per deliverable. The spec lives at the deliverable folder root;
   each plan lives in its own subfolder, named after the plan.
4. Specs use the `.spec.md` extension; plans use `.plan.md`. A plan is named
   `<plan-name>.plan.md` and lives inside its own folder `<plan-name>/`,
   adjacent to the spec. Base names are free-form — `spec.md` / `plan.md` are
   fine when a folder holds one of each:

   ```
   deliverables/current/2026-09-14-2137-user-auth/
     user-auth.spec.md
     user-auth/
       user-auth.plan.md
   ```

5. When a deliverable is implemented and resolved, move the whole folder
   (name unchanged) to `complete/`:

   ```
   git mv deliverables/current/2026-09-14-2137-user-auth deliverables/complete/2026-09-14-2137-user-auth
   ```

6. `complete/` and `archive/` folders are a record of what was decided and
   done — don't edit them except to fix a broken link. When a deliverable is
   partly superseded by later work, record that in a `RESOLUTION.md` note
   inside the deliverable folder rather than editing the original spec/plan.

Specs and plans are typically produced by the Superpowers skills
(`brainstorming`, `writing-plans`) — see `.cursor/rules/superpowers.mdc`.
When using those skills in this repo, save their output per this workflow.

## Deliverables workflow: SDD (Superpowers) artifacts

The Superpowers execution skills (`subagent-driven-development`,
`executing-plans`, `requesting-code-review`, …) generate per-task artifacts: a
progress ledger, task briefs, task reports, and code-review diffs. Those
skills write to a scratch workspace — `.superpowers/sdd/<plan-basename>/` —
whose path and file names are **hardcoded in the skills' bash scripts
(`sdd-workspace`, `task-brief`, `review-package`) and cannot be overridden
from this file**. Leave the skills untouched: let them run natively during
execution (that scratch is git-ignored and is also what the ledger-recovery
logic reads, so do not relocate it mid-run).

This repo's convention governs **where the artifacts live once the deliverable
is done**: promote them from the scratch workspace into the plan's own folder
within the deliverable folder. **The plan's own folder already exists — it is
the `<plan-name>/` subfolder holding the `.plan.md` (convention 4 above).
Promote the artifacts into it, beside the plan; do not create a new nested
folder named after the plan.** When the plan is finished (or whenever the
committed record is needed), move the artifacts out of
`.superpowers/sdd/<plan-basename>/` into
`deliverables/current/{datetime}-{project}/<plan-name>/`
using the layout and names below, then remove the empty scratch directory.

Given a deliverable folder, the promoted layout is:

```
deliverables/current/2026-09-20-0021-harness-hub-mvp/
  harness-hub-mvp.spec.md
  harness-hub-mvp/
    harness-hub-mvp.plan.md
    harness-hub-mvp.progress.md
    task-1-project-scaffold-version-utility/
      2026-09-20-1246-1-project-scaffold-version-utility.brief.md
      2026-09-20-1315-1-project-scaffold-version-utility.report.md
      ce5e63c-a8cb808.review.diff
    ...
    task-24-final-fix/
      2026-09-20-1719-24-final-fix.brief.md
      2026-09-20-1726-24-final-fix.report.md
      4a381bf-3e24cb4.review.diff
```

Conventions:

1. **Progress ledger** — `<plan-name>.progress.md` (e.g.
   `harness-hub-mvp.progress.md`), inside the plan's folder, beside its plan.
2. **Task folders** — live in the plan's folder (no `tasks/` parent), one
   folder per task, named `task-{task number}-{task name}/`. The task name is
   a kebab-case slug of the plan's task title (e.g.
   `task-1-project-scaffold-version-utility/`).
3. **Briefs & reports** — each task folder holds
   `{datetime}-{task number}-{task name}.brief.md` and
   `{datetime}-{task number}-{task name}.report.md`. `{datetime}` is the
   file's own creation time in `YYYY-MM-DD-HHMM`.
4. **Review diffs** — each task folder holds `{sha1}-{sha2}.review.diff`,
   named for the review's commit range.
5. **Unplanned tasks** — work outside the plan (e.g. a final-fix round) gets
   an incremental task number continuing from the plan and follows the same
   naming (e.g. `task-24-final-fix/`). Cross-cutting reviews that span the
   whole branch (e.g. the final whole-branch review) live in the final-fix
   folder.

When a deliverable is archived (rule 5 above), the whole folder — including
each plan folder (with its task folders and progress ledger) — moves
together, name unchanged. Work that is finished moves to
`deliverables/complete/` until review and final disposition.

### Promotion step (when finishing)

The skills' scratch names (`task-N-brief.md`, `task-N-report.md`,
`review-<base7>..<head7>.diff`, `progress.md`) map onto this convention at
promotion time — brief/report get the `{datetime}-{N}-{slug}` prefix, the
review diff becomes `{base7}-{head7}.review.diff` in the task's folder, and
`progress.md` becomes `<plan-name>.progress.md` in the plan's folder. Mapping
the scratch files to task folders requires the plan (task title → slug,
commit range → task), so do it against the finished plan, not by guess.