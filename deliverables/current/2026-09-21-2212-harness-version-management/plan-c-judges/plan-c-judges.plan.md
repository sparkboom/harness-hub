# Plan C — Judges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the pluggable judge layer for rubric scoring and replace the placeholder confidence formula from Plan B with the real per-question confidence assembly.

**Architecture:** A `Judge` is a pluggable backend that turns a rubric + scenario output into scored criteria. Four backends ship in order of preference: `deterministic` (the predicate itself, free), `human` (reviewer reads output), `llm` (free-form semantic scoring, opt-in), and `structured` (a type-safe, calibrated-confidence scorer, e.g. Jev — early access, never a hard dependency). Judges are **always optional** and only ever invoked for scenarios carrying a `rubric`; the confidence report is computed per-question from evidence levels + run counts.

**Tech Stack:** TypeScript (Node ≥22), vitest. The `llm` and `structured` backends talk HTTP via `fetch` (Node 22 built-in) and are behind interfaces; only `deterministic` and `human` are wired by default.

**Spec:** `deliverables/current/2026-09-21-2212-harness-version-management/harness-version-management.spec.md` (R6 judge layer). Supporting: [`evidence-and-judges.md`](./evidence-and-judges.md).

## Global Constraints

- This plan touches **`test/tools/verify/` and `test/tools/report.ts` only** — never `src/`.
- Judges never gate: a judge's score is advisory input to the human's `reconcile --record`. A scenario whose rubric has no judge configured **must still produce a report** with `rubricScored: false`, not crash.
- `llm`/`structured` backends require an explicitly configured endpoint; when absent, `listJudges()` reports them as `unavailable` and `scoreRubric` falls back to `human` (or skips). No network in unit tests — all backends are injected.
- The `Report` shape from Plan B must **not** change shape (only `confidence` gains a real computation and a new optional `rubricScores` field). Existing Plan B tests keep passing.
- The confidence computation is **per-question**, not one collapsed number (evidence-and-judges.md): load / reachability / behavior each get a confidence. The single `confidence` field stays as an advisory rollup.

---

## File Structure

| File | Responsibility |
|---|---|
| `test/tools/verify/judge.ts` | `Judge`, `JudgeScore`, `JudgeBackend`, `JudgeContext`, `listJudges`, `scoreRubric`. |
| `test/tools/verify/judges/deterministic.ts` | deterministic backend (predicate-derived). |
| `test/tools/verify/judges/human.ts` | human backend (interactive review). |
| `test/tools/verify/judges/llm.ts` | LLM backend (free-form scoring via injected HTTP). |
| `test/tools/verify/judges/structured.ts` | structured-model backend (type-safe scores via injected HTTP). |
| `test/tools/confidence.ts` | `computeConfidence` — per-question + rollup. |
| `test/tools/report.ts` | `assembleReport` uses `computeConfidence`; add `rubricScores`. |

---

### Task 1: Judge types + registry

**Files:**
- Create: `test/tools/verify/judge.ts`
- Create: `test/tools/verify/judge.test.ts`

**Interfaces:**
- Produces:
  - `JudgeScore { criterionId, score: number, confidence: number, rationale?: string }`
  - `JudgeBackend { id: 'deterministic' | 'human' | 'llm' | 'structured'; available: boolean; score(ctx): Promise<JudgeScore[]> }`
  - `JudgeContext { harnessId, version, scenarioId, rubric, output, repoRoot }`
  - `listJudges(): JudgeBackend[]`, `scoreRubric(backend, ctx): Promise<JudgeScore[]>`.

- [ ] **Step 1: Write `judge.ts`**

```ts
import type { RubricCriterion } from './schema';

export type JudgeId = 'deterministic' | 'human' | 'llm' | 'structured';

export interface JudgeScore {
  criterionId: string;
  score: number;        // 0..1
  confidence: number;   // 0..1 (calibrated where the backend provides it)
  rationale?: string;
}

export interface JudgeContext {
  harnessId: string;
  version: string;
  scenarioId: string;
  rubric: RubricCriterion[];
  output: string;
  repoRoot: string;
}

export interface JudgeBackend {
  id: JudgeId;
  available: boolean;
  score(ctx: JudgeContext): Promise<JudgeScore[]>;
}

const backends: JudgeBackend[] = [];

export function registerJudge(backend: JudgeBackend): void {
  backends.push(backend);
}

export function listJudges(): JudgeBackend[] {
  return backends;
}

export async function scoreRubric(backend: JudgeBackend, ctx: JudgeContext): Promise<JudgeScore[]> {
  return backend.score(ctx);
}
```

- [ ] **Step 2: Write the failing test**

```ts
// test/tools/verify/judge.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { listJudges, registerJudge, scoreRubric, type JudgeBackend } from './judge';

describe('judge registry', () => {
  beforeEach(() => {
    // clear any prior registrations (test isolation)
    for (const b of listJudges().slice()) { /* no public unregister; see below */ }
  });

  it('starts empty', () => {
    expect(listJudges()).toEqual([]);
  });

  it('scores via a registered backend', async () => {
    const fake: JudgeBackend = {
      id: 'human',
      available: true,
      score: async (ctx) => ctx.rubric.map((c) => ({ criterionId: c.id, score: 1, confidence: 1 })),
    };
    registerJudge(fake);
    const scores = await scoreRubric(fake, {
      harnessId: 'cursor', version: '3.x', scenarioId: 'skill-scoping',
      rubric: [{ id: 'scoping-correct', text: 'x' }], output: '', repoRoot: '/tmp',
    });
    expect(scores).toHaveLength(1);
    expect(scores[0].score).toBe(1);
  });
});
```

- [ ] **Step 3: Make the registry test-isolatable**

The `beforeEach` above can't unregister. Replace `registerJudge` with a `resetJudges()` for tests:

```ts
export function resetJudges(): void {
  backends.length = 0;
}
```

Then `beforeEach(() => resetJudges())`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/tools/verify/judge.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add test/tools/verify/judge.ts test/tools/verify/judge.test.ts
git commit -m "feat(judge): pluggable judge registry and types"
```

---

### Task 2: Deterministic and human backends

**Files:**
- Create: `test/tools/verify/judges/deterministic.ts`
- Create: `test/tools/verify/judges/human.ts`
- Create: `test/tools/verify/judges/index.ts`

**Interfaces:**
- Consumes: `JudgeBackend`, `JudgeScore`, `JudgeContext` (Task 1).
- Produces: `deterministicJudge`, `humanJudge`, and an `index.ts` that registers both by default.

- [ ] **Step 1: Write `deterministic.ts`**

```ts
import type { JudgeBackend, JudgeScore } from '../judge';

// The deterministic "judge" is the predicate itself: every rubric criterion is
// scored 1.0 when the scenario's own deterministic predicate passed, else 0.0.
// It is never paid for and never confabulates.
export const deterministicJudge: JudgeBackend = {
  id: 'deterministic',
  available: true,
  async score(_ctx) {
    // The predicate result is carried in the output contract by the caller;
    // this backend is a no-op passthrough for rubrics whose answer is already
    // binary. It returns empty so callers treat "no judge needed".
    return [] as JudgeScore[];
  },
};
```

- [ ] **Step 2: Write `human.ts`**

```ts
import type { JudgeBackend, JudgeScore } from '../judge';

export interface HumanJudgeIO {
  print(msg: string): void;
  promptScore(question: string): Promise<number>;
}

export function humanJudge(io?: HumanJudgeIO): JudgeBackend {
  const fallback: HumanJudgeIO = {
    print: (m) => console.log(m),
    promptScore: async () => 0,
  };
  const h = io ?? fallback;
  return {
    id: 'human',
    available: true,
    async score(ctx): Promise<JudgeScore[]> {
      const scores: JudgeScore[] = [];
      for (const c of ctx.rubric) {
        h.print(`\n[judge:human] ${ctx.scenarioId} — ${c.text}`);
        h.print(`harness: ${ctx.harnessId} ${ctx.version}`);
        h.print('---- scenario output ----');
        h.print(ctx.output || '(no output captured)');
        const score = await h.promptScore('Your score 0.0–1.0 for this criterion: ');
        scores.push({ criterionId: c.id, score, confidence: 1, rationale: 'human-reviewed' });
      }
      return scores;
    },
  };
}
```

- [ ] **Step 3: Write `index.ts`**

```ts
import { registerJudge } from '../judge';
import { deterministicJudge } from './deterministic';
import { humanJudge } from './human';

registerJudge(deterministicJudge);
registerJudge(humanJudge());

export { deterministicJudge, humanJudge };
```

- [ ] **Step 4: Write the failing test**

```ts
// test/tools/verify/judges/index.test.ts
import { describe, it, expect } from 'vitest';
import './index'; // registers default judges
import { listJudges, resetJudges } from '../judge';
import { humanJudge } from './human';

describe('default judges', () => {
  it('registers deterministic and human backends', () => {
    expect(listJudges().map((j) => j.id).sort()).toEqual(['deterministic', 'human']);
  });

  it('human judge scores each rubric criterion', async () => {
    let asked = 0;
    const j = humanJudge({ print: () => {}, promptScore: async () => { asked++; return 0.7; } });
    const scores = await j.score({
      harnessId: 'cursor', version: '3.x', scenarioId: 'skill-scoping',
      rubric: [{ id: 'a', text: 'q1' }, { id: 'b', text: 'q2' }], output: '', repoRoot: '/tmp',
    });
    expect(scores).toHaveLength(2);
    expect(asked).toBe(2);
    expect(scores[0].score).toBe(0.7);
  });
});
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run test/tools/verify/judges/index.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add test/tools/verify/judges/
git commit -m "feat(judge): deterministic and human judge backends"
```

---

### Task 3: LLM and structured-model backends (HTTP-injected)

**Files:**
- Create: `test/tools/verify/judges/llm.ts`
- Create: `test/tools/verify/judges/structured.ts`
- Create: `test/tools/verify/judges/http.test.ts`

**Interfaces:**
- Consumes: `JudgeBackend`, `JudgeScore`, `JudgeContext` (Task 1).
- Produces: `llmJudge(config)` and `structuredJudge(config)` — both take an injected `fetch`-like `postJson` and a model id; `available` is `false` when no endpoint is configured.

- [ ] **Step 1: Write `llm.ts`**

```ts
import type { JudgeBackend, JudgeScore } from '../judge';

export interface LlmJudgeConfig {
  endpoint?: string;
  model?: string;
  postJson?: (url: string, body: unknown) => Promise<unknown>;
}

// Free-form semantic scoring. Subject to the same confabulation caveat as the
// evidence it judges (Level 4): an LLM asked "why did the harness do X?" can
// confabulate. Use only for rubric scoring, never for primitive pass/fail.
export function llmJudge(config: LlmJudgeConfig = {}): JudgeBackend {
  const endpoint = config.endpoint ?? process.env.JUDGE_LLM_ENDPOINT;
  const post = config.postJson ?? (async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  });
  return {
    id: 'llm',
    available: Boolean(endpoint),
    async score(ctx): Promise<JudgeScore[]> {
      if (!endpoint) return [];
      const body = {
        model: config.model ?? 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You score rubric criteria 0.0–1.0 and give a confidence 0.0–1.0. Return JSON: [{"criterionId":...,"score":...,"confidence":...,"rationale":...}].' },
          { role: 'user', content: JSON.stringify({ harness: ctx.harnessId, version: ctx.version, rubric: ctx.rubric, output: ctx.output }) },
        ],
      };
      const raw = await post(endpoint, body);
      const arr = (raw as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? '[]';
      const parsed = JSON.parse(arr) as JudgeScore[];
      return parsed.map((s) => ({ ...s, criterionId: s.criterionId, score: clamp01(s.score), confidence: clamp01(s.confidence) }));
    },
  };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
```

- [ ] **Step 2: Write `structured.ts`**

```ts
import type { JudgeBackend, JudgeScore } from '../judge';

export interface StructuredJudgeConfig {
  endpoint?: string;
  model?: string;
  postJson?: (url: string, body: unknown) => Promise<unknown>;
}

// Type-safe, calibrated-confidence scoring (e.g. a System One model like Jev).
// Strengths: structured decision, "can't hallucinate" types, cheap/fast. Not for
// free-form "why" reasoning (it gives up string generation).
export function structuredJudge(config: StructuredJudgeConfig = {}): JudgeBackend {
  const endpoint = config.endpoint ?? process.env.JUDGE_STRUCTURED_ENDPOINT;
  const post = config.postJson ?? (async (url: string, body: unknown) => {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return res.json();
  });
  return {
    id: 'structured',
    available: Boolean(endpoint),
    async score(ctx): Promise<JudgeScore[]> {
      if (!endpoint) return [];
      const raw = await post(endpoint, {
        model: config.model ?? 'jev',
        criteria: ctx.rubric,
        output: ctx.output,
      });
      const arr = (raw as { scores?: JudgeScore[] }).scores ?? [];
      return arr.map((s) => ({ ...s, score: clamp01(s.score), confidence: clamp01(s.confidence) }));
    },
  };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
```

- [ ] **Step 3: Write the failing test (injected `postJson`, no network)**

```ts
// test/tools/verify/judges/http.test.ts
import { describe, it, expect } from 'vitest';
import { llmJudge } from './llm';
import { structuredJudge } from './structured';

describe('http judges', () => {
  it('llmJudge is unavailable without an endpoint, available with one', () => {
    expect(llmJudge().available).toBe(false);
    expect(llmJudge({ endpoint: 'http://x' }).available).toBe(true);
  });

  it('llmJudge parses the OpenAI-style response and clamps scores', async () => {
    const j = llmJudge({
      endpoint: 'http://x',
      postJson: async () => ({ choices: [{ message: { content: JSON.stringify([{ criterionId: 'a', score: 1.5, confidence: -0.2 }]) } }] }),
    });
    const scores = await j.score({ harnessId: 'x', version: '1', scenarioId: 's', rubric: [{ id: 'a', text: 'q' }], output: '', repoRoot: '/tmp' });
    expect(scores[0].score).toBe(1);
    expect(scores[0].confidence).toBe(0);
  });

  it('structuredJudge parses the structured response', async () => {
    const j = structuredJudge({
      endpoint: 'http://x',
      postJson: async () => ({ scores: [{ criterionId: 'a', score: 0.8, confidence: 0.9 }] }),
    });
    const scores = await j.score({ harnessId: 'x', version: '1', scenarioId: 's', rubric: [{ id: 'a', text: 'q' }], output: '', repoRoot: '/tmp' });
    expect(scores[0].score).toBe(0.8);
    expect(scores[0].confidence).toBe(0.9);
  });
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/tools/verify/judges/http.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add test/tools/verify/judges/llm.ts test/tools/verify/judges/structured.ts test/tools/verify/judges/http.test.ts
git commit -m "feat(judge): LLM and structured-model judge backends (injected HTTP)"
```

---

### Task 4: Per-question confidence computation

**Files:**
- Create: `test/tools/confidence.ts`
- Create: `test/tools/confidence.test.ts`

**Interfaces:**
- Consumes: `ScenarioOutcome` (Plan B).
- Produces: `QuestionKey = 'load' | 'reachability' | 'behavior' | 'scoping'`; `computeConfidence(outcomes): { perQuestion: Record<QuestionKey, Confidence>, rollup: 'low' | 'medium' | 'high' }`.

- [ ] **Step 1: Write the failing test**

```ts
// test/tools/confidence.test.ts
import { describe, it, expect } from 'vitest';
import { computeConfidence } from './confidence';
import type { ScenarioOutcome } from './verify/schema';

describe('computeConfidence', () => {
  it('maps canary pass to high load confidence', () => {
    const outcomes: ScenarioOutcome[] = [
      { scenarioId: 'agentsdoc-load-canary', result: true, runs: 5, passes: 5, evidence: ['canary'] },
    ];
    const c = computeConfidence(outcomes);
    expect(c.perQuestion.load).toBe('high');
  });

  it('downgrades load confidence on canary failure', () => {
    const outcomes: ScenarioOutcome[] = [
      { scenarioId: 'agentsdoc-load-canary', result: false, runs: 5, passes: 0, evidence: ['canary'] },
    ];
    expect(computeConfidence(outcomes).perQuestion.load).toBe('low');
  });

  it('separates reachability from auto-discovery', () => {
    const outcomes: ScenarioOutcome[] = [
      { scenarioId: 'skill-explicit-invocation', result: true, runs: 5, passes: 5, evidence: ['canary'] },
      { scenarioId: 'skill-auto-discovery', result: false, runs: 5, passes: 1, evidence: ['canary'] },
    ];
    const c = computeConfidence(outcomes);
    expect(c.perQuestion.reachability).toBe('high');
    expect(c.perQuestion.behavior).toBe('low');
  });
});
```

- [ ] **Step 2: Implement `confidence.ts`**

```ts
import type { ScenarioOutcome } from './verify/schema';

export type Confidence = 'low' | 'medium' | 'high';
export type QuestionKey = 'load' | 'reachability' | 'behavior' | 'scoping';

const QUESTION_BY_SCENARIO: Record<string, QuestionKey> = {
  'agentsdoc-load-canary': 'load',
  'agentsdoc-behavioral': 'behavior',
  'skill-wiring': 'reachability',
  'skill-explicit-invocation': 'reachability',
  'skill-auto-discovery': 'behavior',
  'skill-scoping': 'scoping',
  'hermes-trust-gate': 'behavior',
};

// Evidence rank: lower = stronger. Deterministic and gateway are conclusive.
const RANK: Record<string, number> = { deterministic: 0, gateway: 1, canary: 2, behavioral: 3, rubric: 4 };

function scenarioConfidence(o: ScenarioOutcome): Confidence {
  if (!o.result) return 'low';
  const best = Math.min(...o.evidence.map((l) => RANK[l] ?? 4));
  if (best <= 1) return 'high';
  if (best === 2) return o.passes >= 4 ? 'high' : 'medium';
  if (best === 3) return o.passes >= 8 ? 'high' : o.passes >= 5 ? 'medium' : 'low';
  return 'medium'; // rubric → judge-dependent
}

const ORDER: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

export function computeConfidence(outcomes: ScenarioOutcome[]): {
  perQuestion: Record<QuestionKey, Confidence>;
  rollup: Confidence;
} {
  const perQuestion: Record<QuestionKey, Confidence> = { load: 'low', reachability: 'low', behavior: 'low', scoping: 'low' };
  for (const o of outcomes) {
    const q = QUESTION_BY_SCENARIO[o.scenarioId] ?? 'behavior';
    const c = scenarioConfidence(o);
    if (ORDER[c] > ORDER[perQuestion[q]]) perQuestion[q] = c;
  }
  // Rollup: worst of the questions that have any evidence; if nothing ran, low.
  const qs = Object.values(perQuestion);
  const hasEvidence = outcomes.length > 0;
  const rollup = hasEvidence ? qs.reduce((worst, c) => (ORDER[c] < ORDER[worst] ? c : worst), 'high' as Confidence) : 'low';
  return { perQuestion, rollup };
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run test/tools/confidence.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add test/tools/confidence.ts test/tools/confidence.test.ts
git commit -m "feat(judge): per-question confidence computation"
```

---

### Task 5: Wire confidence + rubric scores into the report

**Files:**
- Modify: `test/tools/report.ts`
- Modify: `test/tools/report.test.ts`

**Interfaces:**
- Consumes: `computeConfidence` (Task 4), `JudgeScore` (Task 1).
- Produces: `assembleReport` now accepts optional `rubricScores: Record<string, JudgeScore[]>` and computes `confidence` via `computeConfidence`; adds `perQuestion` to `Report`.

- [ ] **Step 1: Update `report.ts`**

```ts
import type { ScenarioOutcome } from './verify/schema';
import { computeConfidence, type Confidence, type QuestionKey } from './confidence';
import type { JudgeScore } from './verify/judge';

export interface Report {
  harnessId: string;
  version: string;
  scenarios: ScenarioOutcome[];
  rubricScores?: Record<string, JudgeScore[]>;
  perQuestion: Record<QuestionKey, Confidence>;
  confidence: Confidence; // advisory rollup
}

export function assembleReport(
  harnessId: string,
  version: string,
  outcomes: ScenarioOutcome[],
  rubricScores?: Record<string, JudgeScore[]>
): Report {
  const { perQuestion, rollup } = computeConfidence(outcomes);
  return { harnessId, version, scenarios: outcomes, rubricScores, perQuestion, confidence: rollup };
}

export function formatReport(report: Report): string {
  const lines = [`harness: ${report.harnessId}`, `version: ${report.version}`];
  for (const s of report.scenarios) {
    const runInfo = s.runs > 1 ? ` runs: ${s.passes}/${s.runs}` : '';
    const note = s.note ? ` note: ${s.note}` : '';
    lines.push(`  - ${s.scenarioId.padEnd(28)} result: ${s.result ? 'PASS' : 'FAIL'}${runInfo} evidence: ${s.evidence.join(',')}${note}`);
  }
  lines.push(`per-question: load=${report.perQuestion.load} reachability=${report.perQuestion.reachability} behavior=${report.perQuestion.behavior} scoping=${report.perQuestion.scoping}`);
  lines.push(`confidence: ${report.confidence}   # advisory only`);
  return lines.join('\n');
}
```

- [ ] **Step 2: Update `report.test.ts`**

```ts
// replace the confidence derivation test with per-question assertions
import { describe, it, expect } from 'vitest';
import { assembleReport } from './report';
import type { ScenarioOutcome } from './verify/schema';

const outcomes: ScenarioOutcome[] = [
  { scenarioId: 'skill-wiring', result: true, runs: 1, passes: 1, evidence: ['deterministic'] },
  { scenarioId: 'agentsdoc-load-canary', result: true, runs: 5, passes: 5, evidence: ['canary'] },
  { scenarioId: 'agentsdoc-behavioral', result: true, runs: 10, passes: 8, evidence: ['behavioral'], note: 'control 2/10' },
];

describe('assembleReport', () => {
  it('assembles outcomes and per-question confidence', () => {
    const r = assembleReport('codex', '0.155.1', outcomes);
    expect(r.harnessId).toBe('codex');
    expect(r.version).toBe('0.155.1');
    expect(r.scenarios).toHaveLength(3);
    expect(r.perQuestion.load).toBe('high');
    expect(r.perQuestion.reachability).toBe('high');
    expect(r.perQuestion.behavior).toBe('medium');
  });

  it('rolls up to the worst question', () => {
    const r = assembleReport('codex', '0.155.1', outcomes);
    expect(r.confidence).toBe('medium'); // behavior is medium
  });

  it('carries rubric scores through', () => {
    const r = assembleReport('codex', '0.155.1', outcomes, {
      'skill-scoping': [{ criterionId: 'scoping-correct', score: 0.8, confidence: 0.9 }],
    });
    expect(r.rubricScores?.['skill-scoping'][0].score).toBe(0.8);
  });
});
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run test/tools/report.test.ts test/tools/confidence.test.ts`
Expected: PASS. (The Plan B `report.test.ts` confidence assertions are superseded by these; replace them, don't keep both.)

- [ ] **Step 4: Commit**

```bash
git add test/tools/report.ts test/tools/report.test.ts
git commit -m "feat(judge): wire per-question confidence and rubric scores into the report"
```

---

### Task 6: Full verification

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 2: Typecheck + build tools**

Run: `npm run typecheck && npm run build:tools`
Expected: clean; `dist/verify/judge.js`, `dist/confidence.js` emitted.

- [ ] **Step 3: Commit any residual**

```bash
git add -A
git commit -m "test: verify judges deliverable end-to-end" --allow-empty
```

---

## Self-Review

**Spec coverage (R6 judge layer + evidence-and-judges.md):**
- Pluggable backends, all optional → Task 1 registry + Tasks 2–3 backends.
- Deterministic / human / LLM / structured-model (Jev) → Tasks 2–3.
- Jev as an option, not a hard dependency → `structuredJudge` is `available: false` without an endpoint and never blocks.
- "Primitive pass/fail → no judge, never pay" → deterministic judge returns empty; rubric-only scenarios carry `rubric`.
- Confidence per-question, not one number → Task 4 + evidence-and-judges.md's "computed per-question" rule.
- Confidence formula deferred-to-Plan-C → now implemented (Task 4), replacing Plan B's placeholder.
- Evidence level dominates run count → `RANK` ordering + conclusive deterministic/gateway.

**Placeholder scan:** no TBD/TODO. The `llm`/`structured` endpoints are config-driven (`JUDGE_LLM_ENDPOINT` / `JUDGE_STRUCTURED_ENDPOINT`) and injected in tests.

**Type consistency:** `JudgeBackend`, `JudgeScore`, `JudgeContext`, `QuestionKey`, `Confidence`, `Report.rubricScores`, `Report.perQuestion` are stable across Tasks 1–5. `assembleReport` gains an optional 4th param (backward-compatible with Plan B's 3-arg callers, though Plan B's own `report.test.ts` is updated in Task 5).
