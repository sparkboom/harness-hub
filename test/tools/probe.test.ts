import { describe, it, expect } from 'vitest';
import { probeHarness, PROBE_COMMANDS } from './probe';

describe('probe', () => {
  it('skips a missing harness with a clear message', () => {
    const result = probeHarness('codex', '/repo', () => { throw new Error('not installed'); });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('not installed');
  });

  it('has a probe command for every harness id', () => {
    for (const id of ['claude-code', 'cursor', 'opencode', 'codex', 'hermes', 'pi', 'deepseek']) {
      expect(PROBE_COMMANDS[id]).toBeDefined();
    }
  });

  it('runs the headless agent form for cursor with --workspace', () => {
    let captured: string[] = [];
    probeHarness('cursor', '/repo', (spec) => { captured = spec.args; return ''; });
    expect(captured).toContain('--workspace');
    expect(captured).toContain('/repo');
  });
});
