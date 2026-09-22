# Convention-verification scenarios

Supporting document for [`harness-version-management.spec.md`](./harness-version-management.spec.md)
(R6). This is the scenario suite the integration framework executes; it is the
operational heart of a review.

## Scenario schema

Each scenario is declarative and runner-agnostic (see spec R5/R6):

```
Scenario {
  id,                      // stable slug, e.g. "agentsdoc-load-canary"
  conventionUnderTest,     // agentsDoc | skills | skills-scoping | trustGate
  harnessCompat,           // harness ids the scenario applies to
  setup: {
    files: [               // repo state to create before the prompt
      { path, content, kind?: 'file' | 'symlink' }
    ],
    canary?: string,       // arbitrary non-derivable sentinel (never in the prompt)
  },
  prompt,                  // what the harness is asked to do
  predicate,               // deterministic check over the post-prompt repo delta
  rubric?,                 // optional semantic criteria for a judge
  evidenceLevels,          // which ladder levels the scenario exercises
}
```

**Execution primitive** (shared by both runners): *snapshot repo state → run
prompt (container or human) → evaluate `predicate(delta)` → optionally score
`rubric` → record evidence.* Every convention maps onto a predicate: a file
created with an extension, file content matching a regex, a symlink appearing
(Claude's `CLAUDE.md`/`.claude/skills`), or a config write (hermes trust
ledger).

**Invariant.** A canary string must **never appear in the prompt**. Otherwise the
model can reproduce it from the prompt itself and the test proves nothing.

## The suite

### S1 — `agentsdoc-load-canary` (Level 2)

Proves `AGENTS.md` was *read* (near-deterministic, few runs).

```yaml
id: agentsdoc-load-canary
conventionUnderTest: agentsDoc
harnessCompat: [claude-code, codex, opencode, hermes, pi, deepseek, cursor-cli]
setup:
  files:
    - path: AGENTS.md
      content: |
        # Project conventions
        When asked to create a specification document, name the file
        "zebra-9f3k2.spec.md" (that exact filename, no other).
prompt: "Create a specification document that plans the scaffolding of a JavaScript library."
predicate: a file matching /zebra-9f3k2\.spec\.md/ exists in the repo delta
evidenceLevels: [canary]
```

The sentinel `zebra-9f3k2` cannot be guessed or known from training — if it
appears, `AGENTS.md` was read. 3–5 runs gives near-certainty (see
[`evidence-and-judges.md`](./evidence-and-judges.md)).

### S2 — `agentsdoc-behavioral` (Level 3)

Proves `AGENTS.md` *drives behavior* end-to-end (stochastic; needs a control).

```yaml
id: agentsdoc-behavioral
conventionUnderTest: agentsDoc
harnessCompat: [claude-code, codex, opencode, hermes, pi, deepseek, cursor-cli]
setup:
  files:
    - path: AGENTS.md
      content: |
        When creating a specification document, use the `.spec.md` extension
        and save it to the project root.
prompt: "Create a specification document that plans the scaffolding of a JavaScript library."
predicate: a `*.spec.md` file appeared at repo root
evidenceLevels: [behavioral]
```

Requires a **control group** (same prompt, `AGENTS.md` absent) to measure the
spontaneous rate, and enough runs to separate "obeyed the convention" from
"rolled high / knew it from training data".

### S3 — the skill trio (Levels 0 + 2)

Skill support decomposes into three distinct questions; testing them as one would
conflate prompt-engineering ability with skill loading. Each is its own scenario,
so flakiness in the hard one (S3c) doesn't poison the reliable ones.

#### S3a — `skill-wiring` (deterministic, below Level 2)

Verifies the *mechanic harness-hub performs* — no model invocation at all.

```yaml
id: skill-wiring
conventionUnderTest: skills
harnessCompat: [claude-code, codex, opencode, hermes, pi, deepseek, cursor, cursor-cli]
setup:
  files:
    - path: .agents/skills/writing-tests/SKILL.md
      content: (a well-formed SKILL.md with name + description frontmatter)
prompt: (none — no model call)
predicate:
  # native harnesses: .agents/skills/writing-tests/SKILL.md exists
  # migrate-symlink harnesses (claude-code): .claude/skills/writing-tests → .agents/skills/writing-tests symlink exists
evidenceLevels: [deterministic]
```

This is the one scenario that is pure filesystem verification — 100% reliable,
and it validates harness-hub's own output rather than the harness's behavior.

#### S3b — `skill-explicit-invocation` (Level 2 canary, reliable)

Tests reachability-by-name. The skill is named in the prompt; its *action* writes
a canary.

```yaml
id: skill-explicit-invocation
conventionUnderTest: skills
harnessCompat: [claude-code, codex, opencode, hermes, pi, deepseek, cursor, cursor-cli]
setup:
  files:
    - path: .agents/skills/zebra-skill/SKILL.md
      content: |
        ---
        name: zebra-skill
        description: Writes the project marker on request.
        ---
        When invoked, write the exact string "COD-X7K9Z" into a file named
        marker.txt in the repo root.
prompt: "Use the zebra-skill skill."
predicate: repo contains marker.txt whose content includes /COD-X7K9Z/
evidenceLevels: [canary]
```

The skill *name* is named, but the canary output `COD-X7K9Z` is not — success
proves the skill was reachable and executed.

#### S3c — `skill-auto-discovery` (Level 2 canary, the hard one)

Tests whether the harness notices and invokes the skill *on its own*. Neither the
skill name nor the canary appears in the prompt.

```yaml
id: skill-auto-discovery
conventionUnderTest: skills
harnessCompat: [claude-code, codex, opencode, hermes, pi, deepseek, cursor, cursor-cli]
setup:
  files:
    - path: .agents/skills/zebra-skill/SKILL.md
      content: |
        ---
        name: zebra-skill
        description: Use whenever the user asks to summarize a project. Then
          write the exact string "COD-X7K9Z" into marker.txt at the repo root.
        ---
        (body describing the summarize-and-mark behavior)
prompt: "Summarize this project."
predicate: repo contains marker.txt whose content includes /COD-X7K9Z/
evidenceLevels: [canary]
```

This is the flakiest and most prompt-sensitive scenario — the reason it's split
out. A harness passing S3a + S3b but failing S3c yields a specific, useful
signal: "skills are wired and reachable but not auto-discovered."

### S4 — `skill-scoping` (Level 4 rubric)

Verifies scoping semantics; no clean deterministic predicate, so it requires a
judge (see [`evidence-and-judges.md`](./evidence-and-judges.md)).

```yaml
id: skill-scoping
conventionUnderTest: skills-scoping
harnessCompat: [cursor, cursor-cli, opencode]   # harnesses with nested-skill scoping
setup:
  files:
    - path: apps/web/.agents/skills/web-skill/SKILL.md
      content: |
        ---
        name: web-skill
        description: Use when working in apps/web.
        ---
        (content)
prompt: "Work on the backend service and list which skills are available to you."
predicate: none (semantic)
rubric:
  - "was web-skill correctly scoped to apps/web only (not surfaced for backend work)?"
  - "did the harness's reported skill list reflect the scoping?"
evidenceLevels: [rubric]
```

### S5 — `hermes-trust-gate` (Level 3 config side-effect)

Verifies the trust-gate mechanic recorded in the registry.

```yaml
id: hermes-trust-gate
conventionUnderTest: trustGate
harnessCompat: [hermes]
setup:
  files:
    - path: .agents/skills/zebra-skill/SKILL.md
      content: (as S3b)
prompt: "Use the zebra-skill skill."
predicate: ~/.hermes/config.yaml gained the repo path under
  skills.trusted_project_dirs (or the harness first asked for trust)
evidenceLevels: [behavioral]
```

## Coverage matrix

| Scenario | conventionUnderTest | Evidence | Notes |
|---|---|---|---|
| S1 `agentsdoc-load-canary` | agentsDoc | L2 canary | near-proof of *read* |
| S2 `agentsdoc-behavioral` | agentsDoc | L3 behavioral | needs control + runs |
| S3a `skill-wiring` | skills | deterministic | harness-hub's own output |
| S3b `skill-explicit-invocation` | skills | L2 canary | reachability-by-name |
| S3c `skill-auto-discovery` | skills | L2 canary | true auto-discovery, flaky |
| S4 `skill-scoping` | skills-scoping | L4 rubric | judge required |
| S5 `hermes-trust-gate` | trustGate | L3 behavioral | config side-effect |

## Open questions

- **S3c prompt sensitivity.** The auto-discovery prompt ("Summarize this
  project.") is deliberately generic; some harnesses may not act. Iterate on
  prompt phrasing empirically once the framework runs — the scenario exists to
  be tuned, not locked.
- **S4 harnessCompat.** The scoping scenario only applies to harnesses with
  documented nested-skill scoping (Cursor, OpenCode); confirm the exact set
  before first run.
