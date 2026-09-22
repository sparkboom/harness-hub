import { describe, it, expect } from 'vitest';
import { formatInfo, infoHarness } from './info';

describe('infoHarness', () => {
  it('returns detail for a known harness', () => {
    const out = formatInfo('claude-code');
    expect(out).toContain('claude-code');
    expect(out).toContain('CLAUDE.md');
    expect(out).toContain('.claude/skills');
  });

  it('returns exit 1 for an unknown id, naming the valid ids', () => {
    const result = infoHarness('bogus');
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('bogus');
  });

  it('surfaces a status line', () => {
    const out = formatInfo('codex', '0.150.0');
    expect(out).toContain('status: verified');
  });
});
