// test/tools/verify/scenarios.test.ts
import { describe, it, expect } from 'vitest';
import { SCENARIO_SUITE } from './scenarios';

describe('scenario suite', () => {
  it('defines all seven scenarios with unique ids', () => {
    expect(Object.keys(SCENARIO_SUITE).sort()).toEqual([
      'agentsdoc-behavioral', 'agentsdoc-load-canary', 'hermes-trust-gate',
      'skill-auto-discovery', 'skill-explicit-invocation', 'skill-scoping', 'skill-wiring',
    ].sort());
  });

  it('keeps canary strings out of prompts (invariant)', () => {
    for (const s of Object.values(SCENARIO_SUITE)) {
      if (s.setup.canary) {
        expect(s.prompt).not.toContain(s.setup.canary);
      }
    }
  });

  it('splits skill discovery into the wiring/explicit/auto trio', () => {
    expect(SCENARIO_SUITE['skill-wiring'].evidenceLevels).toContain('deterministic');
    expect(SCENARIO_SUITE['skill-explicit-invocation'].evidenceLevels).toContain('canary');
    expect(SCENARIO_SUITE['skill-auto-discovery'].evidenceLevels).toContain('canary');
  });

  it('restricts skill-scoping to the documented harnesses', () => {
    expect(SCENARIO_SUITE['skill-scoping'].harnessCompat).toEqual(['cursor', 'cursor-cli', 'opencode']);
  });
});