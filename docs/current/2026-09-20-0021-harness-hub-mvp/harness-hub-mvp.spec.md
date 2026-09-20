# harness-hub MVP — Specification

**Status:** draft
**Date:** 2026-09-20

---

## 1. Purpose

harness-hub makes a repository **harness agnostic**. A consumer repo keeps
its agent assets in one canon location, and harness-hub wires whichever
coding harnesses the developer enables to read from that canon — so
switching harnesses doesn't mean restructuring the repo.

Core promises:

1. **One canon.** Assets live once: `AGENTS.md` at the repo root, skills in
   `.agents/skills/`.
2. **Easy enable/disable.** `harness-hub enable <harness>` wires a harness;
   `harness-hub disable <harness>` unwires it. Generated files are clearly
   marked and regenerable; canon content is never modified.
3. **Idempotent.** Running `enable` twice produces the same result;
   re-running after canon changes refreshes the wiring.
4. **Diagnosable.** `harness-hub doctor` verifies the wiring and recommends
   remediation.

## 2. Scope

This is the first deliverable: the smallest useful slice of harness-hub,
built to be easy to reason about end to end. It covers exactly:

- Two assets: **`AGENTS.md`** and **skills** (`.agents/skills/`).
- Three commands: **`enable`**, **`disable`**, **`doctor`**.
- Config in **`harness-hub.yaml`** (default) or **`harness-hub.json`**.
- Skill validation limited to **frontmatter**.
- Best-effort wiring for **all seven harnesses on the roster** (Claude Code,
  Cursor, OpenCode, Codex, Hermes, Pi, DeepSeek), using only the mechanism
  each harness already supports today — no new mechanisms are invented to
  cover a gap.

Everything else — commands, rules, subagents, hooks, `AGENTS.md`
templating, nested/subdirectory canon, user/global-level wiring, merge-edited
harness configs, cross-harness intent-key parity, derived sidecar files,
`init`/`status` commands, `--fix`/`--adopt` flags — is **out of scope for
this deliverable**. Prior research and design work on those topics is parked
in [`../2026-09-20-0021-harness-hub-future/`](../2026-09-20-0021-harness-hub-future/)
for when each becomes its own deliverable.

## 3. Canon layout

```
repo/
  AGENTS.md                    # canonical agent doc, author-maintained
  .agents/
    skills/
      <name>/SKILL.md          # canonical skills (Agent Skills standard)
        scripts/…               # optional supporting files, copied with the skill
        references/…
        assets/…
  harness-hub.yaml              # or harness-hub.json — see §4
```

- The canon root (`.agents/`) is fixed, not configurable.
- `.agents/skills/` may be absent or empty — that's a valid state, it just
  means no skills are wired yet.
- **Canon is read-only to harness-hub.** `AGENTS.md` and everything under
  `.agents/skills/` are authored by the repo owner; harness-hub never
  creates, edits, or deletes canon content. If `AGENTS.md` doesn't exist,
  `enable`/`doctor` report an error asking the author to create it — there is
  no `init` command that scaffolds it for you.

## 4. Config: `harness-hub.yaml` (default) / `harness-hub.json`

Exactly one config file exists per repo. **YAML is the default** — `enable`
creates `harness-hub.yaml` the first time it needs a config file. JSON is
also accepted (same schema) for repos that prefer it or generate config
programmatically:

```yaml
harnesses:
  - claude-code
  - cursor
generated:
  claude-code:
    skills:
      - deploy
      - release-notes
```

```json
{
  "harnesses": ["claude-code", "cursor"],
  "generated": {
    "claude-code": { "skills": ["deploy", "release-notes"] }
  }
}
```

- `harnesses` — the list of currently-enabled harness ids. Recognized values:
  `claude-code`, `cursor`, `opencode`, `codex`, `hermes`, `pi`, `deepseek`.
- `generated` — the ownership ledger for generated files that can't carry an
  in-file marker (§6). `enable`/`disable` maintain this; authors don't hand-edit
  it.
- If neither file exists, no harnesses are enabled yet. `enable` creates one
  (YAML, unless the author already has a `harness-hub.json` — then it keeps
  writing JSON so the repo doesn't end up with both).
- If **both** files exist, `doctor` reports an error: ambiguous config, pick
  one.

## 5. Asset: `AGENTS.md`

| Harness | Wiring |
|---|---|
| Claude Code | **pointer** — generate `CLAUDE.md` containing `@AGENTS.md` (Claude's native import syntax) |
| Cursor | **native** — reads `AGENTS.md` directly, nothing generated |
| OpenCode | **native** |
| Codex | **native** |
| Hermes | **native** |
| Pi | **native** |
| DeepSeek | **native** |

Canon `AGENTS.md` is never modified by harness-hub, regardless of which
harnesses are enabled.

## 6. Asset: Skills

`SKILL.md` directories under `.agents/skills/<name>/` are the [Agent Skills
standard](https://agentskills.io). Canon tolerates any frontmatter keys
beyond the standard — harness-hub passes them through untouched (§7).

| Harness | Wiring |
|---|---|
| Claude Code | **copy** → `.claude/skills/<name>/` (whole directory, including `scripts/`/`references/`/`assets/`); the only harness that doesn't read `.agents/skills/` natively |
| Cursor | **native** via `.agents/skills/` |
| OpenCode | **native** via `.agents/skills/` |
| Codex | **native** via `.agents/skills/` |
| Hermes | **notice** — Hermes uses an install/hub model and its project-local skill directory is unverified; `enable` prints an explanation and wires nothing for skills. Revisit once verified. |
| Pi | **native** via `.agents/skills/` |
| DeepSeek | **native** via `.agents/skills/` |

Copies for Claude Code are whole-directory (so relative paths from
`SKILL.md` to `scripts/`/`references/`/`assets/` keep working) and are
refreshed whenever `enable` re-runs.

## 7. Skill frontmatter contract

The only thing harness-hub validates or relies on for skills is
**frontmatter** — no sidecar files, no cross-harness intent-key
reconciliation, no `paths`/scoping logic. That keeps the skills story to one
rule set instead of one per harness.

**Required:**

| Field | Rule |
|---|---|
| `name` | 1–64 chars; lowercase `a-z0-9-`; no leading/trailing/consecutive hyphens; **must equal the parent directory name** |
| `description` | 1–1024 chars, non-empty — this is the entire discovery surface for every harness |

**Optional, passed through untouched (harness-hub doesn't interpret these):**
`license`, `compatibility`, `metadata`, `allowed-tools`, `disable-model-invocation`,
and any harness-specific keys an author adds.

`doctor` checks the required fields and the name/directory match; it does not
check whether optional keys are spelled correctly for a given harness, and it
does not generate anything from them (e.g. no Codex sidecar derivation — that
is future work, parked in `harness-hub-future/`).

## 8. CLI surface

- **`harness-hub enable <harness>…`** — wires one or more harnesses:
  - Runs the `doctor` checks below as a pre-flight. Warnings surface but
    don't block; a **clobber risk** finding (§9) blocks unless `--force` is
    passed.
  - Native harnesses: add the harness id to `harnesses` in the config file.
    Nothing else to do — there's nothing to generate.
  - Claude Code: generate/refresh the `CLAUDE.md` pointer, copy
    `.agents/skills/*` into `.claude/skills/`, update the `generated` ledger,
    add `claude-code` to `harnesses`.
  - Hermes: add `hermes` to `harnesses`; print the skills notice from §6.
  - Idempotent — running `enable` again with unchanged canon reproduces the
    same result; running it after canon changed refreshes the wiring.

- **`harness-hub disable <harness>…`** — unwires a harness:
  - Removes exactly the generated files/ledger entries for that harness
    (e.g. `CLAUDE.md` and the `.claude/skills/` copies for `claude-code`).
  - Removes the harness id from `harnesses`.
  - Never touches canon, and never touches other harnesses' generated files.

- **`harness-hub doctor`** — runs the checks in §9, read-only. Exit code is
  non-zero when any `error`-severity finding is present, so it can gate
  scripts/CI. No `--fix` in this deliverable — every finding is reported with
  a recommended remediation for the author to apply.

## 9. Doctor checks

| Check | What it detects | Severity |
|---|---|---|
| **Canon presence** | `AGENTS.md` missing at repo root | error |
| **Skill shape** | A directory under `.agents/skills/` without a `SKILL.md`, or other non-standard layout (flat `.md` files, grouped files without a directory) | error |
| **Skill frontmatter** | Missing/empty `name` or `description`; `name` fails the character/length rule; `name` ≠ parent directory name | error |
| **Config validity** | Neither or both of `harness-hub.json`/`harness-hub.yaml` present; file present but unparseable; `harnesses` contains an unrecognized id | error |
| **Clobber risk** | `enable` would overwrite a file it didn't generate — a hand-written `CLAUDE.md` that isn't the `@AGENTS.md` pointer, or a `.claude/skills/<name>` directory not present in the `generated` ledger | error (blocks `enable` without `--force`) |
| **Generated-file drift** | A generated file/ledger entry is missing, or a Claude Code skill copy no longer matches its canon source | warning |

Findings not covered here — precedence-interference files (`AGENTS.override.md`
etc.), nested `AGENTS.md`/`CLAUDE.md` inventory, `AGENTS.md` size caps,
cross-harness intent-key parity — are deliberately deferred; see
`harness-hub-future/` for the research already done on them.

## 10. Generated-file conventions & safety

- **Files that can carry a marker comment** (no leading frontmatter, e.g.
  `CLAUDE.md`) get one:
  `<!-- generated by harness-hub; source: AGENTS.md; do not edit -->`
- **Files that can't carry a marker** (whole-directory skill copies — YAML
  frontmatter must start at byte 0 in `SKILL.md`) are tracked instead in the
  `generated` ledger in `harness-hub.json`/`.yaml` (§4). Ownership is
  ledger-based, not content-based, for this deliverable.
- **Canon is read-only to harness-hub** — `AGENTS.md` and everything under
  `.agents/skills/` are never created, edited, or deleted by any command.
- `enable` refuses to overwrite a file it doesn't own (§9 clobber risk)
  unless `--force` is passed.
- `disable <harness>` removes only that harness's generated files and ledger
  entries; it never touches canon or another harness's files.

## 11. Non-goals (explicitly out of scope here)

- Commands, rules, subagents, hooks as assets.
- `AGENTS.md` templating (template + values → rendered doc).
- Nested/subdirectory canon; user/global-level (`~/`) wiring.
- Merge-edited harness config files (e.g. `opencode.json` permissions).
- Cross-harness intent-key parity checks and derived sidecar files (e.g.
  Codex `agents/openai.yaml`).
- `init`, `status` commands; `--fix`, `--adopt` flags.
- Precedence-interference, nested-file-inventory, and size-cap doctor checks.

All of the above have prior research or settled design decisions recorded in
[`../2026-09-20-0021-harness-hub-future/`](../2026-09-20-0021-harness-hub-future/) —
consult that folder first when any of these becomes its own deliverable,
rather than re-deriving it from scratch.
