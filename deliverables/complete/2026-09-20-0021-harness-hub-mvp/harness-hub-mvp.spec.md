# harness-hub MVP — Specification

**Status:** draft
**Date:** 2026-09-20
**Stack:** TypeScript / Node.js, distributed via npm — matches the install
channel six of the seven target harnesses already use (research:
`harness-tech-stack.insight.md` in `harness-hub-future/`).
**Platform:** macOS and Linux. Windows is out of scope for this deliverable —
Claude Code's wiring is symlink-based (§6), and symlinks are enough of a
Windows/git headache (admin/Developer Mode, cross-platform git checkout
corruption) that it isn't worth solving until Windows is an actual
requirement.

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
   marked and regenerable. `enable` itself never modifies canon — for a
   harness that needs pre-existing content adopted into canon first
   (currently just Claude Code, §6), `enable` errors and points at
   `harness-hub migrate <harness>`, a separate, explicitly-invoked command.
   `migrate` is the one narrow, explicit exception to "canon is never
   modified," and it only ever *adds* skills that don't already exist in
   canon, never edits or removes existing canon content.
3. **Idempotent.** Running `enable` twice produces the same result;
   re-running after canon changes refreshes the wiring.
4. **Diagnosable.** `harness-hub doctor` verifies the wiring and recommends
   remediation.

## 2. Scope

This is the first deliverable: the smallest useful slice of harness-hub,
built to be easy to reason about end to end. It covers exactly:

- Two assets: **`AGENTS.md`** and **skills** (`.agents/skills/`).
- Four commands: **`enable`**, **`disable`**, **`doctor`**, **`migrate`**.
  `migrate` is scoped to Claude Code in this deliverable (§6, §8) — adopting
  pre-existing skills for harnesses that already read `.agents/skills/`
  natively alongside their own dir (e.g. Cursor's `.cursor/skills/`) is
  future work, parked in `harness-hub-future/` (§11).
- Config in **`harness-hub.yaml`** (default) or **`harness-hub.json`**.
- Skill validation limited to **frontmatter**.
- Best-effort wiring for **all seven harnesses on the roster** (Claude Code,
  Cursor, OpenCode, Codex, Hermes, Pi, DeepSeek), using only the mechanism
  each harness already supports today — no new mechanisms are invented to
  cover a gap.
- **macOS and Linux only** — see the header's Platform note.

Canon deliberately *is* the [Agent Skills](https://agentskills.io) standard's
own opinionated layout (`.agents/skills/<name>/SKILL.md`), not a
harness-hub-specific shape. Repos are encouraged to embrace that layout
directly — it's what most harnesses already read natively, and it's why
Claude Code (the one harness that doesn't) gets migrated into it rather than
kept as a permanently-separate copy (§6).

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
```

```json
{ "harnesses": ["claude-code", "cursor"] }
```

- `harnesses` — the only key. The list of currently-enabled harness ids.
  Recognized values: `claude-code`, `cursor`, `opencode`, `codex`, `hermes`,
  `pi`, `deepseek`.
- No ownership ledger is needed: every generated artifact in this deliverable
  is a symlink (§5, §6), so ownership is derived by checking what the
  symlink resolves to — nothing to track separately.
- If neither file exists, no harnesses are enabled yet. `enable` creates one
  (YAML, unless the author already has a `harness-hub.json` — then it keeps
  writing JSON so the repo doesn't end up with both).
- If **both** files exist, `doctor` reports an error: ambiguous config, pick
  one.

## 5. Asset: `AGENTS.md`

| Harness | Wiring |
|---|---|
| Claude Code | **symlink** — `CLAUDE.md` → `AGENTS.md` |
| Cursor | **native** — reads `AGENTS.md` directly, nothing generated |
| OpenCode | **native** |
| Codex | **native** |
| Hermes | **native** |
| Pi | **native** |
| DeepSeek | **native** |

Claude Code reads `CLAUDE.md` as a symlink to canon `AGENTS.md` rather than a
generated stub containing Claude's `@AGENTS.md` import syntax: it's driftless
either way, but a symlink doesn't depend on that syntax continuing to exist,
and it keeps the whole Claude Code story ("every Claude Code asset is a
symlink into canon") to one mental model instead of two (§6 uses the same
mechanism for skills).

Canon `AGENTS.md` is never modified by harness-hub, regardless of which
harnesses are enabled.

## 6. Asset: Skills

`SKILL.md` directories under `.agents/skills/<name>/` are the [Agent Skills
standard](https://agentskills.io). Canon tolerates any frontmatter keys
beyond the standard — harness-hub passes them through untouched (§7).

| Harness | Wiring |
|---|---|
| Claude Code | **migrate + symlink** — `.claude/skills` → `.agents/skills` (see below); the only harness that doesn't read `.agents/skills/` natively |
| Cursor | **native** via `.agents/skills/` |
| OpenCode | **native** via `.agents/skills/` |
| Codex | **native** via `.agents/skills/` |
| Hermes | **native** via `.agents/skills/`, with a one-time manual trust step (see below) |
| Pi | **native** via `.agents/skills/` |
| DeepSeek | **native** via `.agents/skills/` |

### Claude Code: migrate, then enable

Claude Code is the only harness that can't read `.agents/skills/` natively.
Rather than maintaining a permanent copy of canon (which drifts the moment
canon changes), `enable claude-code` makes `.claude/skills` **a symlink to
`.agents/skills`** — Claude Code ends up reading canon directly, so drift
becomes structurally impossible instead of something `doctor` has to detect.

If `.claude/skills/` doesn't already exist (or is already the expected
symlink), `enable claude-code` is a one-line, idempotent operation — no
migration involved. If it exists as a **real directory with content** — the
common case for any repo that adopted Claude Code before harness-hub — a
symlink can't coexist with that content, so it needs adopting into canon
first. **`enable` does not do this adoption itself.** It classifies
`.claude/skills/`'s entries against canon (§9's Unmigrated skills /
Skill migration collision checks) and either proceeds (nothing left to
adopt) or blocks with an error pointing at `harness-hub migrate claude-code`.

#### `harness-hub migrate claude-code`

The only command in this deliverable that adds to canon. For each entry
under `.claude/skills/<name>/`, first validated against the skill-shape and
frontmatter contract (§7) — anything that fails is a **clobber-risk** error
(§9); fix it and re-run:

1. If `.agents/skills/<name>/` doesn't exist in canon, **copy it in**
   (whole directory — `scripts/`/`references/`/`assets/` included). This is
   the one narrow exception to "canon is read-only" (§1, §10): it only ever
   adds a skill that wasn't in canon before.
2. If `.agents/skills/<name>/` already exists and is byte-identical,
   nothing to do — already migrated.
3. If it already exists and **differs**, that's a naming collision: hard
   error naming both paths (`.claude/skills/<name>/SKILL.md` vs.
   `.agents/skills/<name>/SKILL.md`), and `migrate` aborts *before* touching
   anything else. **Not `--force`-able** — unlike the simple-overwrite
   clobber cases (§9), there's no safe default direction (which version
   should win isn't knowable). The author reconciles by hand (rename one,
   merge manually, or delete the stale copy) and re-runs `migrate`.

`migrate claude-code` never deletes `.claude/skills/` and never touches the
symlink or `harnesses` config — it only ever adds to canon. Running it again
once every entry is already accounted for is a no-op ("nothing to
migrate"). It is the **only** harness `migrate` supports in this
deliverable: every other harness either reads `.agents/skills/` natively
with nothing to adopt, or (Cursor) reads its own compat dir *alongside*
canon rather than instead of it, so nothing blocks `enable` and there's
nothing migration is required to unblock. Generalizing `migrate` to adopt
those harnesses' pre-existing, harness-specific skill dirs into canon is
deferred — see §11 and `harness-hub-future/`.

#### `harness-hub enable claude-code`

Once every entry under `.claude/skills/` is accounted for in canon (via
`migrate`, or because there was nothing to adopt), `enable claude-code`:

1. Deletes the now-redundant `.claude/skills/` real directory, if present.
2. Creates the `.claude/skills` → `.agents/skills` symlink, and the
   `CLAUDE.md` → `AGENTS.md` symlink (§5).
3. Ensures `.gitignore` covers `CLAUDE.md` and `.claude/skills`: they're
   regenerated locally by `enable`, the same way `node_modules` is
   regenerated by `npm install`, rather than committed and risking
   corruption on a checkout that can't materialize a real symlink (§
   Platform note above — the reason Windows is out of scope for now). If
   either path is already tracked in git from before harness-hub, the
   author untracks it themselves (`git rm --cached`); harness-hub doesn't
   touch the git index.
4. Adds `claude-code` to `harnesses`.

If `.claude/skills/` still contains an entry not yet reflected in canon when
`enable` runs, `enable` **blocks** with an error naming the unmigrated
entries and pointing at `harness-hub migrate claude-code` (§8, §9) — it does
not perform the copy itself, and this is **not** `--force`-able (forcing
would either silently drop the unmigrated skill or silently overwrite
canon). This only ever comes up once per skill: after migration,
`.claude/skills` is the symlink and there's nothing left in a real directory
to re-migrate.

**`disable claude-code` does not reverse the migration.** It removes the
`CLAUDE.md` and `.claude/skills` symlinks; it does not try to reconstruct the
original real `.claude/skills/` directory. The migrated skills stay in canon
permanently — that's the intended outcome, not a side effect to undo.

### Hermes: native, but trust-gated

Hermes reads `.agents/skills/` from the nearest git root natively — nothing
generated, same as Cursor/OpenCode/Codex/Pi/DeepSeek. The one difference:
Hermes won't *load* project skills until a human runs `hermes skills trust`
inside the repo once (a per-machine security decision — skills are
executable procedure documents, so Hermes won't auto-run them from an
untrusted clone).

Trust is recorded in `skills.trusted_project_dirs` in that user's own
`~/.hermes/config.yaml`, keyed by the repo's path resolved to the nearest
ancestor directory containing `.git` (the same resolution Hermes itself
uses). `doctor` reads this file — read-only — to check whether the current
repo is listed:

- **Listed** → trusted; check passes.
- **File exists and parses, repo not listed** → not trusted: error, blocks
  `enable hermes`.
- **File missing, or exists but fails to parse** → can't verify: warning,
  doesn't block. The file may simply not exist yet on a machine that's
  never run Hermes, or (see below) the format may have moved on since this
  check was written — either way, guessing wrong shouldn't hard-block
  `enable`.

`enable hermes` treats this as a hard precondition: it refuses to add
`hermes` to `harnesses` until the repo is trusted, and this is **not**
`--force`-able — forcing wouldn't make Hermes actually load anything, since
trust is a human security decision harness-hub cannot make on the user's
behalf. The error message doubles as the remediation: run
`hermes skills trust` inside the repo, then re-run `enable`.

**This check targets exactly one, currently-released trust mechanism**
(`skills.trusted_project_dirs`). Hermes has an unreleased, in-progress
migration to a different, per-skill-fingerprinted trust sidecar
(`~/.hermes/project-trust.json`), tracked in a still-open upstream PR at
research time — deliberately not supported yet, since it hasn't shipped and
its shape could still change before release. Once it ships in a released
Hermes version, this check needs a follow-up update to recognize it too;
`harness-doctor-architecture.insight.md` (this deliverable's folder) sketches
a registry-backed, pluggable-check approach that would make that kind of
update a data change rather than a rewrite — parked as future work, not
part of this MVP.

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

- **`harness-hub enable <harness>…`** — wires one or more harnesses. Never
  modifies canon:
  - Runs the `doctor` checks below as a pre-flight. Warnings surface but
    don't block. A **clobber risk** finding (§9) blocks unless `--force` is
    passed. An **unmigrated skills** finding (§9, Claude Code only) and a
    **Hermes trust** finding (§9, Hermes only) also block, but are **not**
    `--force`-able — they're resolved by running `migrate` or
    `hermes skills trust` respectively, never by forcing `enable`.
  - Native harnesses: add the harness id to `harnesses` in the config file.
    Nothing else to do — there's nothing to generate.
  - Claude Code: if `.claude/skills/` has entries not yet reflected in
    canon, blocks with an error pointing at `harness-hub migrate
    claude-code` (§6). Otherwise: symlink `CLAUDE.md` → `AGENTS.md` (§5);
    delete the now-redundant `.claude/skills/` real directory if present and
    symlink it to `.agents/skills` (§6); ensure `.gitignore` covers both
    paths; add `claude-code` to `harnesses`.
  - Hermes: blocks unless the repo is already listed in
    `skills.trusted_project_dirs` (§6, §9's Hermes trust check) — the error
    message is the one-time `hermes skills trust` reminder. Once trusted:
    add `hermes` to `harnesses` (native, nothing to generate).
  - Idempotent — running `enable` again with unchanged canon reproduces the
    same result; if canon gained skills since the last run, re-running just
    means the symlink already sees them (nothing to refresh).

- **`harness-hub migrate <harness>…`** — adopts a harness's pre-existing,
  harness-specific skills into canon. The only command that modifies canon,
  and it only ever *adds* (§1, §6, §10):
  - **`claude-code`** — copies any `.claude/skills/<name>/` not already in
    canon into `.agents/skills/<name>/`; a same-name entry that differs from
    canon is a hard, non-`--force` **skill migration collision** error (§6,
    §9). Idempotent — a repo with nothing to adopt reports "nothing to
    migrate."
  - **Every other harness id** — errors: `migrate` has nothing to do for a
    harness that already reads canon natively with no pre-existing content
    that blocks anything. Generalizing `migrate` to adopt other harnesses'
    legacy skill dirs (e.g. Cursor's `.cursor/skills/`) into canon is
    deferred — see §11 and `harness-hub-future/`.
  - Does not wire anything, add to `harnesses`, or touch symlinks — run
    `enable` afterward to finish wiring.

- **`harness-hub disable <harness>…`** — unwires a harness:
  - Removes exactly that harness's generated files (e.g. the `CLAUDE.md` and
    `.claude/skills` symlinks for `claude-code` — the migrated skills stay in
    canon, §6).
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
| **Config validity** | Neither or both of `harness-hub.yaml`/`harness-hub.json` present; file present but unparseable; `harnesses` contains an unrecognized id | error |
| **Clobber risk** | `enable` would overwrite something it doesn't own: a hand-written `CLAUDE.md` that isn't a symlink to `AGENTS.md`, or a `.claude/skills` symlink pointing somewhere other than `.agents/skills` | error (blocks `enable`; `--force` overwrites) |
| **Unmigrated skills** | A real `.claude/skills/<name>/` exists but has no counterpart yet in canon `.agents/skills/<name>/` | error (blocks `enable`; resolved by running `harness-hub migrate claude-code`, §6, §8 — **not** `--force`-able, since forcing would either drop the skill or silently overwrite canon) |
| **Skill migration collision** | A real `.claude/skills/<name>/` differs from an existing `.agents/skills/<name>/` (§6) | error (blocks both `migrate` and `enable`; **not** `--force`-able — no safe default direction, must reconcile by hand) |
| **Hermes trust** | `hermes` is in `harnesses` (or being enabled) but the repo isn't listed in `skills.trusted_project_dirs` (`~/.hermes/config.yaml`, §6) | error (blocks `enable hermes`; **not** `--force`-able — resolved only by running `hermes skills trust`). Downgrades to **warning** if the file is missing or fails to parse — can't verify, doesn't block |
| **Generated-file drift** | `claude-code` is in `harnesses` but `CLAUDE.md` and/or `.claude/skills` is missing or not a symlink to the expected canon target | warning |

Findings not covered here — precedence-interference files (`AGENTS.override.md`
etc.), nested `AGENTS.md`/`CLAUDE.md` inventory, `AGENTS.md` size caps,
cross-harness intent-key parity — are deliberately deferred; see
`harness-hub-future/` for the research already done on them.

## 10. Generated-file conventions & safety

- **Every generated artifact in this deliverable is a symlink** (`CLAUDE.md`,
  `.claude/skills`, §5/§6) — no marker comments, no ownership ledger.
  Ownership is derived at read time: it's harness-hub's if it's a symlink
  resolving to the expected canon target, foreign otherwise. No in-file
  markers, because a marker on `CLAUDE.md` would fork it from `AGENTS.md`'s
  actual content, and a marker can't precede `SKILL.md`'s frontmatter anyway.
- **Canon is read-only to harness-hub**, with one narrow, explicit
  exception: `harness-hub migrate claude-code` (§6, §8) may *add* a skill
  directory to `.agents/skills/` when adopting `.claude/skills/` content that
  doesn't already exist in canon. It never edits or deletes existing canon
  content, and a naming collision with different content is a hard error,
  not a silent overwrite. `enable` itself never touches canon, for any
  harness — it only wires (or, for Claude Code, blocks and points at
  `migrate` if canon isn't caught up yet).
- `enable` refuses to overwrite/relink anything it doesn't own (§9 clobber
  risk) unless `--force` is passed; it refuses to proceed past unmigrated
  Claude Code skills or an untrusted Hermes repo regardless of `--force`
  (§9) — neither has a safe default action to force through.
- `enable` for `claude-code` keeps `.gitignore` covering `CLAUDE.md` and
  `.claude/skills` — they're regenerated locally, not committed (§6).
- `disable <harness>` removes only that harness's generated symlinks; it
  never touches canon (including anything already migrated into it) or
  another harness's files.

## 11. Non-goals (explicitly out of scope here)

- Commands, rules, subagents, hooks as assets.
- `AGENTS.md` templating (template + values → rendered doc).
- Nested/subdirectory canon; user/global-level (`~/`) wiring.
- Merge-edited harness config files (e.g. `opencode.json` permissions).
- Cross-harness intent-key parity checks and derived sidecar files (e.g.
  Codex `agents/openai.yaml`).
- Generalizing `migrate` beyond Claude Code: adopting pre-existing,
  harness-specific skill content into canon for harnesses that already read
  `.agents/skills/` natively *alongside* their own dir (e.g. Cursor's
  `.cursor/skills/`, OpenCode's `.opencode/skills/`). Unlike Claude Code,
  nothing blocks `enable` for these harnesses without it — orphaned
  pre-harness-hub content there is a "same-name duplicates" doctor finding
  at worst (§9's scope doesn't cover it yet either), not a hard failure. See
  the "Benign-looking duplicates rot" failure mode in
  `harness-hub-future/.../harness-skills.insight.md`.
- Supporting Hermes's unreleased trust-sidecar migration
  (`~/.hermes/project-trust.json`, per-skill fingerprints) or any
  harness-version-scoped variation of doctor checks generally. The Hermes
  trust check (§6, §9) targets only the currently-released
  `skills.trusted_project_dirs` mechanism; see
  `harness-doctor-architecture.insight.md` (this deliverable's folder) for
  the registry-backed, pluggable-check approach earmarked for handling this
  kind of drift once it becomes its own deliverable.
- `init`, `status` commands; `--fix`, `--adopt` flags.
- Precedence-interference, nested-file-inventory, and size-cap doctor checks.
- Windows (symlinks are load-bearing for Claude Code's wiring, §6; revisit if
  Windows becomes an actual requirement — a directory junction is the likely
  mechanism, noted in `harness-tech-stack.insight.md`).

All of the above have prior research or settled design decisions recorded in
[`../2026-09-20-0021-harness-hub-future/`](../2026-09-20-0021-harness-hub-future/) —
consult that folder first when any of these becomes its own deliverable,
rather than re-deriving it from scratch.
