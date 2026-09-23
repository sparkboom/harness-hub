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