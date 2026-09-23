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