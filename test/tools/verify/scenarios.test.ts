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

  describe('hermes-trust-gate predicate', () => {
    const predicate = SCENARIO_SUITE['hermes-trust-gate'].predicate;
    const mkCtx = (ledger: string) => ({
      repoRoot: '/Users/x/proj',
      homeDir: '/Users/x/home',
      repo: { files: {} },
      home: { files: { '.hermes/config.yaml': { type: 'file' as const, content: ledger } } },
      beforeRepo: { files: {} },
      beforeHome: { files: {} },
    });

    it('passes when the ledger contains the container mount path /repo', () => {
      expect(predicate(mkCtx('trusted:\n  - /repo\n'))).toEqual({
        pass: true,
        reason: 'trust ledger gained the container mount path /repo',
      });
    });

    it('passes when the ledger contains the repo root (human-mode case)', () => {
      expect(predicate(mkCtx('trusted:\n  - /Users/x/proj\n'))).toEqual({
        pass: true,
        reason: 'trust ledger gained the repo path',
      });
    });

    it('fails when the ledger contains neither path', () => {
      expect(predicate(mkCtx('trusted:\n  - /elsewhere\n')).pass).toBe(false);
    });
  });
});