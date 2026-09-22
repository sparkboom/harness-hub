# LLM gateway (Level-1 evidence)

Supporting document for [`harness-version-management.spec.md`](./harness-version-management.spec.md)
(R7). This is the strongest evidence source: capture the actual prompt/context a
harness sends to its model, so "was AGENTS.md/skills in the request?" gets a
ground-truth answer with zero model-obedience noise.

## Why it's the strongest evidence

Every other evidence level observes a *consequence* of the harness reading
`AGENTS.md` (a canary file appears, a `.spec.md` is created) — and consequences
are filtered through the model's stochastic obedience. Gateway inspection
observes the *cause*: the raw request body. If `AGENTS.md` content or a skill's
`SKILL.md` text is in the outgoing request, that is conclusive. One clean capture
beats many behavioral runs (see [`evidence-and-judges.md`](./evidence-and-judges.md)).

## Scope & honest limitation

A "light LLM gateway" is **not** a dumb TCP logger. It must **speak each
harness's API dialect** — parse, log, and transparently forward the request, then
return the upstream response. The harnesses under review target different
providers:

| Harness | Provider dialect | Base-URL surface |
|---|---|---|
| claude-code | Anthropic `/v1/messages` | env var (`ANTHROPIC_BASE_URL`) |
| codex | OpenAI `/v1/chat/completions` | env var (`OPENAI_BASE_URL`, ignored — needs provider override) |
| opencode | OpenAI-compatible (default) | env var (`OPENAI_BASE_URL` / provider `baseURL`) |
| cursor / cursor-cli | OpenAI-compatible (custom endpoint) | IDE custom endpoint (manual) |
| pi | OpenAI `/v1/chat/completions` (also Anthropic `/v1/messages`) | config file `~/.pi/agent/models.json` |
| hermes | OpenAI `/v1/chat/completions` (`provider: custom`) | config file `~/.hermes/config.yaml` |
| deepseek | OpenAI `/v1/chat/completions` (also `openai-responses`, `anthropic-messages`) | config file `$DSH_HOME/settings.yaml` |

Every harness under review can reach an OpenAI-compatible `/v1/chat/completions`
endpoint, so **a single LiteLLM OpenAI route suffices for all of them** (plus an
Anthropic `/v1/messages` route for claude-code, and optionally for pi/deepseek).
The real split is the **configuration surface**: claude-code/codex/opencode are
env-var-routed, while pi/hermes/deepseek are config-file-routed (the file must be
written before the harness launches — same container-provisioning problem,
different mechanism).

The gateway therefore has two layers:

1. **A passthrough core** — an HTTP server that receives a request, records the
   *unwrapped* prompt/context (system + tool + user content, including injected
   `AGENTS.md`/skill text), forwards to the real provider, and relays the
   response.
2. **Dialect adapters** — per-provider normalization so the *interesting* part
   (was convention content present?) can be extracted regardless of request
   envelope shape.

**Decision: use LiteLLM, not a hand-rolled gateway.** LiteLLM is an
MIT-licensed, self-hosted, OpenAI-compatible proxy that already speaks the
dialects we need (Anthropic `/v1/messages`, OpenAI `/v1/chat/completions` +
`/v1/responses`, plus pass-through endpoints) and logs every request out of the
box. The harnesses under review route through it via their base-URL env vars
(see "Integration" below), so we get the log-and-inspect capability for free
rather than re-implementing dialect adapters. It ships a `lite` CLI that
launches coding agents through the proxy
([PR #29850](https://github.com/BerriAI/litellm/pull/29850)). The one thing
LiteLLM does *not* give us for free is the harness-hub-specific *inspection*
step ("was AGENTS.md/skills content present in this request?") — that remains a
thin harness-hub wrapper over LiteLLM's logged request bodies.

## Integration with the two runners

- **Automated runner (`container`).** The testbed image ships LiteLLM as a
  sidecar (or the same container). The harness is launched with its base-URL
  pointed at the proxy — env var for some harnesses, config file for others:
  - claude-code → `ANTHROPIC_BASE_URL` (bare proxy root; appends `/v1/messages`),
    `ANTHROPIC_AUTH_TOKEN` = proxy key, `ANTHROPIC_API_KEY` cleared.
  - codex → `OPENAI_BASE_URL` = proxy + `/v1`, `OPENAI_API_KEY` = proxy key
    (note: codex *ignores* `OPENAI_BASE_URL`, so it is routed via a custom
    provider config override — see LiteLLM's `lite codex` behavior).
  - opencode → `OPENAI_BASE_URL` / provider `baseURL`.
  - pi → write `~/.pi/agent/models.json` with a custom provider whose
    `baseUrl` is the proxy + `/v1`, `api: "openai-completions"`, `apiKey`
    = proxy key (or `$ENV_VAR`), and at least one model id.
  - hermes → write `~/.hermes/config.yaml` with `model.provider: custom`,
    `model.base_url` = proxy + `/v1`, and a model id (or `hermes model` →
    Custom endpoint, scripted).
  - deepseek → write `$DSH_HOME/settings.yaml` with an `llm-pi-ai.providers`
    entry: `api: openai-completions`, `baseURL` = proxy + `/v1`,
    `apiKeyEnv` = a proxy-key env var, plus a model id; `compat` switches
    (`supportsDeveloperRole`, `maxTokensField`) only if the proxy needs them.
  The proxy logs each request; the harness-hub wrapper inspects the logs for
  convention content.
- **Manual runner (`human`), Cursor IDE.** Cursor IDE supports a custom
  OpenAI-compatible model endpoint. The tooling **asks the user to configure it**
  — point the IDE's custom endpoint at the LiteLLM proxy URL, then a quick
  self-test (send a one-shot probe and confirm it appears in the proxy logs)
  verifies the wiring before the scenario proceeds. The proxy captures the GUI
  surface's request the same way, so even the `cursor` (IDE) harness yields
  Level-1 evidence.

## Contract (what the framework needs, not how it's built)

```
Gateway {
  start(harnessId): { baseUrl, captureDir },   // baseUrl = LiteLLM proxy; captures = logged request bodies
  selfTest(): bool,                             // quick probe to confirm the harness/proxy wiring
  inspect(captureDir): { containsAgentsDoc: bool, containsSkill: bool, ... },
  stop(),
}
```

The framework consumes `inspect()` output as Level-1 evidence; it never depends
on the gateway's internals (LiteLLM is an implementation detail behind this
contract).

## Security & correctness notes

- **No credential capture.** LiteLLM forwards requests; harness-hub never stores
  provider API keys. Capture only the prompt/context and response bodies, and
  mark the capture dir git-ignored + local-only.
- **Determinism of the check.** "Was convention content present?" is a string
  containment test over the logged request body, not a model judgment — exactly
  as reliable as a grep.
- **Cursor self-test.** Before a manual Cursor scenario runs, a one-shot probe
  through the IDE→proxy path must confirm the request lands in the proxy logs;
  this closes the "did the human actually wire the endpoint?" gap.

## Open questions

- **Cursor IDE config approach.** Two options for pointing the IDE at the proxy:
  (a) ask the human to configure the custom endpoint manually, then confirm via a
  self-test (safe, non-invasive; current default), or (b) have the tooling
  temporarily edit the Cursor IDE config file on the human's behalf, reverting
  after the scenario (more automated, more invasive — deferred pending a look at
  the actual config-file shape). Default to (a).
- **Config-file write shape for pi/hermes/deepseek.** Their base URLs are file-
  based (`models.json` / `config.yaml` / `settings.yaml`), so the container
  provisioning step must *write* those files (and the `apiKeyEnv`/`apiKey`
  reference) before launch, and clean them after. The exact per-harness file
  shape is confirmed at the field level by each project's docs; the remaining
  unknown is how hermetic that write is inside the testbed image (e.g. whether
  pi/hermes/deepseek also need a model *id* that LiteLLM must advertise). This is
  a provisioning detail, not an architecture change.
- **Response capture necessity.** Level-1 only *requires* the request; response
  capture is retained because it enables future judge cross-referencing, but is
  not load-bearing for the load question.
