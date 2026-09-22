# Evidence ladder, canary discipline, judges & report

Supporting document for [`harness-version-management.spec.md`](./harness-version-management.spec.md)
(R6). This is the epistemics of the review system: how raw scenario runs become a
confidence report a human can act on.

## The evidence ladder

Evidence is ranked. Higher levels are deterministic and should be collected
whenever available; lower levels are stochastic and only *raise* confidence.

| Level | Evidence | Deterministic | Answers |
|---|---|---|---|
| 1 | **Gateway inspection** — capture the actual prompt/context sent to the model | ✅ | "Was AGENTS.md/skills *in the request*?" — ground truth |
| 2 | **Canary** — an arbitrary, non-derivable sentinel (e.g. `zebra-9f3k2.spec.md`) appears | ~✅ | "Was AGENTS.md read?" — near-proof |
| 3 | **Behavioral** — a natural convention (a `.spec.md` file appears) | ❌ | "Does it behave correctly end-to-end?" — realistic, stochastic |
| 4 | **Self-reported / rubric** — "why did you do X?" or scored criteria | ❌ | Suggestive only — confabulation-prone |

There is also a **deterministic (Level 0)** outcome: a filesystem predicate with
no model invocation at all (scenario S3a, `skill-wiring`). It sits below the
ladder because it verifies *harness-hub's own output*, not the harness's
behavior.

### Level 1 is sufficient proof alone

Gateway inspection is deterministic and answers the exact question ("is the
convention in the request?"). Where it exists, one clean capture is conclusive.
Its cost is a gateway (see [`gateway.md`](./gateway.md)) and API-dialect support,
so it only works for API-based harnesses with configurable endpoints. Where it
does not exist (a GUI with no configurable endpoint, or a harness that refuses
base-URL overrides), Levels 2–3 are the fallback.

## Canary discipline

The canary is the cheapest statistical power available: an arbitrary sentinel has
a spontaneous match rate ≈ 0, so treatment-vs-control separates after very few
runs.

- **Use canary scenarios first.** 3–5 runs of S1/S3b/S3c suffices to answer "was
  it loaded/reachable/discovered?"
- **Reserve the expensive multi-run design for Level 3.** Behavioral scenarios
  (S2, S5) need a control group (same prompt, convention absent) and enough runs
  to separate "obeyed the convention" from "rolled high / knew it from training
  data".
- **Budget explicitly.** Each run burns tokens + wall-clock (agents run 10s–100s
  of seconds). Never run 30× everything; run canary cheap, behavioral budgeted,
  gateway once.

## Judges (rubric scoring only)

A judge evaluates semantic criteria that a deterministic predicate cannot (e.g.
"was the skill *scoped* correctly?"). Judges are **pluggable backends, all
optional**:

- **deterministic** — the predicate itself; the default, and never paid for.
- **human** — the reviewer reads the scenario output.
- **LLM judge** — free-form semantic evaluation (subject to the same
  confabulation caveat as Level 4: an LLM asked "why did the harness do X?" can
  confabulate a plausible reason).
- **structured-model judge** (e.g. [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev)) —
  a System One model emitting type-safe, calibrated-confidence rubric scores. A
  natural fit for "score these N criteria with confidence", **not** for free-form
  "why" reasoning (it gives up string generation).

### What a judge is *for* (and what it isn't)

Reaching for a judge is easy to do where a deterministic check is free:

- **Primitive pass/fail** (did a `.spec.md` appear? did the canary appear?) →
  deterministic predicate. **No judge. Never pay for this.**
- **Rubric scoring** (did it *correctly* implement the convention in spirit? is
  scoping right?) → judge is appropriate.
- **Free-form "why"/abduction** → judge, but weak (confabulation applies to the
  judge too).

Jev's fit is specifically the rubric layer: "on these N criteria, scored with
calibrated confidence" is a structured-decision task, which is exactly its
strength (structured, type-safe, "can't hallucinate" types, cheap/fast). Treat
every judge as a **pluggable backend** — Jev is early access, so it must be one
option, not a hard dependency.

## Confidence report

Each scenario run accumulates ladder evidence; `reconcile` assembles a
per-version **report**:

```
harness: codex
version: 0.155.1
scenarios:
  - id: agentsdoc-load-canary     result: PASS   runs: 5/5   evidence: canary
  - id: agentsdoc-behavioral      result: 8/10   control: 2/10   evidence: behavioral
  - id: skill-wiring              result: PASS   evidence: deterministic
  - id: skill-explicit-invocation result: PASS   runs: 5/5   evidence: canary
  - id: skill-auto-discovery      result: 2/5    evidence: canary   note: flaky
confidence: high   # derived from evidence levels hit + run counts (advisory)
```

Rules of the report:

- **Advisory, not authoritative.** A confidence score informs the human; it never
  auto-flips `unverified` → `verified`. That flip is always the human's explicit
  `reconcile --record`.
- **Evidence level dominates run count.** One gateway capture (Level 1) outweighs
  many behavioral runs (Level 3) for the *load* question. Confidence should be
  computed per-question (loaded? reachable? behaves?), not collapsed to one
  number.
- **Surface the weak evidence honestly.** The Level 4 "why" follow-up is a
  *diagnostic*, not evidence — include it in the report only as context, never as
  a pass/fail.

## Open questions

- **Confidence computation.** The exact formula (how evidence levels combine into
  a per-question confidence) is deferred to Plan C (judges) — it belongs with the
  rubric/confidence assembly work, not the scenario framework.
- **Control-group automation.** Whether the Level-3 control group (S2, S5) runs
  automatically or is authored manually per review is unresolved; lean automatic
  (same scenario, `setup.files = []`).
