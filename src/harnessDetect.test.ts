import { describe, it, expect } from 'vitest';
import { detectWith } from './harnessDetect';

describe('harnessDetect', () => {
  it('maps each id through the runner and normalizes output', () => {
    const rows = detectWith((id) => (id === 'codex' ? '0.155.1\n' : null));
    expect(rows.codex).toBe('0.155.1');
    expect(rows['claude-code']).toBeNull();
    expect(rows['cursor-cli']).toBeNull();
  });

  it('covers all eight ids', () => {
    const keys = Object.keys(detectWith(() => null)).sort();
    expect(keys).toEqual([
      'claude-code', 'codex', 'cursor', 'cursor-cli', 'deepseek', 'hermes', 'opencode', 'pi',
    ]);
  });
});