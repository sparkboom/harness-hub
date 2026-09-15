# AGENTS.md — harness-hub

Guidance for AI agents (and humans) working in this repo. Cursor rules in
`.cursor/rules/` mirror parts of this file — keep the two in sync.

## Docs workflow: specs & plans

Spec and plan documents live in dated, per-deliverable folders:

- Active work: `docs/current/{datetime}-{project}/`
- Completed work: `docs/archive/{datetime}-{project}/`

Conventions:

1. `{datetime}` is the folder's creation time in `YYYY-MM-DD-HHMM` format,
   e.g. `2026-09-14-2137`. Keep the original datetime when archiving.
2. `{project}` is a short kebab-case slug for the deliverable,
   e.g. `user-auth`.
3. One folder per deliverable. The spec and all plans for that deliverable
   stay together in the same folder.
4. Specs use the `.spec.md` extension; plans use `.plan.md`. Base names are
   free-form — `spec.md` / `plan.md` are fine when a folder holds one of each:

   ```
   docs/current/2026-09-14-2137-user-auth/
     user-auth.spec.md
     user-auth.plan.md
   ```

5. When the deliverable is implemented and resolved, move the whole folder
   (name unchanged) to the archive:

   ```
   git mv docs/current/2026-09-14-2137-user-auth docs/archive/2026-09-14-2137-user-auth
   ```

6. Archived folders are a record of what was decided and done — don't edit
   them except to fix a broken link.

Specs and plans are typically produced by the Superpowers skills
(`brainstorming`, `writing-plans`) — see `.cursor/rules/superpowers.mdc`.
When using those skills in this repo, save their output per this workflow.
