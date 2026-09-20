# Doctor check architecture — implementation note

**Type:** implementation note, not a spec. Companion to
[`harness-hub-mvp.spec.md`](./harness-hub-mvp.spec.md) — that document stays
the sole source of truth for *what* `doctor` checks exist (§9) and what
`enable`/`migrate`/`disable` do (§8). This note only governs *how* those are
structured internally, so they stay easy to extend and update as harness
conventions drift — it does not add, remove, or change any spec-level
behavior.

**Why this exists:** while designing the Hermes trust check (§9, pending
addition), it became clear the underlying fact ("is this repo trusted?") is
read from harness-owned, undocumented, version-drifting state — Hermes is
already mid-migration from a flat config-list to a per-skill-fingerprint
sidecar (see `harness-skills.insight.md`, "Hermes: native, but trust-gated").
The same shape of problem — "small, independent facts about an external
tool's conventions, verified at a point in time, prone to drifting" —
recurs across every harness in the roster, not just Hermes. Two
implementation decisions future-proof against that drift without changing
any spec-visible behavior now.

## 1. A declarative, internal harness-conventions registry

A data file bundled with the harness-hub package itself (e.g.
`src/registry/harnesses.json`) — **not** the user-editable
`harness-hub.yaml`/`.json` (spec §4), which stays the small, repo-local
"which harnesses are enabled" file. The registry is tool-internal,
versioned with harness-hub releases, and never read or written by a
consumer repo.

Per-harness entries hold the same conventions currently recorded as prose in
`harness-hub-future/.../harness-skills.insight.md`, made machine-readable:

- **Provenance** — `verifiedVersion` + `verifiedDate` per fact, mirroring
  `harness-versions.insight.md`'s existing pinning practice. Every fact the
  registry asserts should be traceable to when/against-what it was checked.
- **Discovery rules** — skill roots read, walk-up behavior, compat roots
  (e.g. Cursor reading `.cursor/skills/` + `.agents/skills/` +
  `.claude/skills/` + `.codex/skills/` simultaneously).
- **Check-specific facts** — e.g. Hermes's trust-state location(s). Modeled
  as an **ordered list of known shapes**, each independently dated, so a
  check can try them in order and degrade to "can't verify" rather than
  assume a single hardcoded shape (this is the data backing the
  hardened-dual-parse approach already decided for the Hermes trust check).

Update flow: when a `harness-hub-future` insight doc gets re-verified (the
existing "Re-verified: <date>" convention already used in
`harness-skills.insight.md`), the registry is the runtime-consumed sibling
shipped in the next harness-hub release. Insight docs stay the prose
research trail; the registry is the distillation the tool actually reads.

**Explicitly out of scope for this note too:** the registry only records
what harness-hub's own logic was verified against — it does not detect
which version of a harness is actually installed on a given machine. Live
version detection + drift warnings were discussed and deliberately deferred
to a future deliverable (parked in `harness-hub-future/`); the registry's
shape shouldn't need to change if that gets picked up later, since
`verifiedVersion` per fact already gives that future work something to
compare an installed version against.

## 2. Doctor checks as pluggable rules

Each row in the spec's §9 table becomes a self-contained rule module behind
a common interface, rather than a bespoke branch in one monolithic `doctor`
function:

- `id`, human-readable description, severity, remediation text.
- An **applicability predicate** — e.g. "only relevant when `claude-code` is
  in `harnesses`," or "only relevant when the registry has trust-check data
  for this harness."
- A **check function** that reads repo/canon state and (where relevant)
  registry data, returning pass/fail + a finding.

`doctor` — and `enable`'s pre-flight, which already reuses doctor's checks
per spec §8 — becomes "run every applicable rule, collect findings," so
adding a check (or a harness) is additive rather than an edit to a growing
shared function. Rules that depend on registry data (§1) can sometimes
adapt to a harness's convention change via a registry update alone, with no
code change. This intentionally mirrors pluggable linter architectures
(e.g. ESLint rules) — the problem shape is the same: many small,
independent, versioned checks against an evolving external target.

## Scope note

Nothing here changes `harness-hub-mvp.spec.md`. When this deliverable
reaches `writing-plans`, treat this note as guidance for that plan's task
breakdown (e.g. "define the check-rule interface," "seed the registry from
`harness-skills.insight.md`" as their own tasks) rather than re-deriving the
structure from scratch — but the plan is still free to deviate if
implementation reveals a better shape.
