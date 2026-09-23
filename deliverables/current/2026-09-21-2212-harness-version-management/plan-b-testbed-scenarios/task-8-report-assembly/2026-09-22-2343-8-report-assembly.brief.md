### Task 8: Report assembly

**Files:**
- Create: `test/tools/report.ts`
- Create: `test/tools/report.test.ts`

**Interfaces:**
- Consumes: `ScenarioOutcome` (Task 1).
- Produces: `Report { harnessId, version, scenarios, confidence }` and `assembleReport(harnessId, version, outcomes): Report`.

- [ ] **Step 1: Write the failing test**

```ts
// test/tools/report.test.ts
import { describe, it, expect } from 'vitest';
import { assembleReport } from './report';
import type { ScenarioOutcome } from './verify/schema';

const outcomes: ScenarioOutcome[] = [
  { scenarioId: 'skill-wiring', result: true, runs: 1, passes: 1, evidence: ['deterministic'] },
  { scenarioId: 'agentsdoc-load-canary', result: true, runs: 5, passes: 5, evidence: ['canary'] },
  { scenarioId: 'agentsdoc-behavioral', result: true, runs: 10, passes: 8, evidence: ['behavioral'], note: 'control 2/10' },
];

describe('assembleReport', () => {
  it('assembles outcomes into a report', () => {
    const r = assembleReport('codex', '0.155.1', outcomes);
    expect(r.harnessId).toBe('codex');
    expect(r.version).toBe('0.155.1');
    expect(r.scenarios).toHaveLength(3);
  });

  it('derives an advisory confidence from the highest evidence level', () => {
    expect(assembleReport('codex', '0.155.1', outcomes).confidence).toBe('high');
    expect(assembleReport('codex', '0.155.1', [
      { scenarioId: 's', result: true, runs: 10, passes: 6, evidence: ['behavioral'] },
    ]).confidence).toBe('medium');
  });
});
```

- [ ] **Step 2: Implement `report.ts`**

```ts
import type { ScenarioOutcome } from './verify/schema';

export interface Report {
  harnessId: string;
  version: string;
  scenarios: ScenarioOutcome[];
  confidence: 'low' | 'medium' | 'high';
}

// TODO(plan-c): the full confidence formula (evidence levels × run counts ×
// per-question decomposition) is specified in evidence-and-judges.md and owned
// by Plan C. This placeholder is advisory only and must be replaced without
// changing the Report shape.
const LEVEL_RANK: Record<string, number> = {
  deterministic: 0, gateway: 1, canary: 2, behavioral: 3, rubric: 4,
};

export function assembleReport(harnessId: string, version: string, outcomes: ScenarioOutcome[]): Report {
  let best = Infinity;
  for (const o of outcomes) {
    for (const lvl of o.evidence) {
      best = Math.min(best, LEVEL_RANK[lvl] ?? 4);
    }
  }
  const confidence = best <= 1 ? 'high' : best <= 3 ? 'medium' : 'low';
  return { harnessId, version, scenarios: outcomes, confidence };
}

export function formatReport(report: Report): string {
  const lines = [`harness: ${report.harnessId}`, `version: ${report.version}`];
  for (const s of report.scenarios) {
    const runInfo = s.runs > 1 ? ` runs: ${s.passes}/${s.runs}` : '';
    const note = s.note ? ` note: ${s.note}` : '';
    lines.push(`  - ${s.scenarioId.padEnd(28)} result: ${s.result ? 'PASS' : 'FAIL'}${runInfo} evidence: ${s.evidence.join(',')}${note}`);
  }
  lines.push(`confidence: ${report.confidence}   # advisory only`);
  return lines.join('\n');
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run test/tools/report.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add test/tools/report.ts test/tools/report.test.ts
git commit -m "feat(verify): assemble a per-version confidence report (advisory)"
```

---

