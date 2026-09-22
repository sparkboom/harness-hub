import { describe, it, expect } from 'vitest';
import { ALL_HARNESS_IDS, isHarnessId } from './harnesses';

describe('harnesses', () => {
  it('lists exactly the eight recognized ids', () => {
    expect([...ALL_HARNESS_IDS].sort()).toEqual(
      ['claude-code', 'codex', 'cursor', 'cursor-cli', 'deepseek', 'hermes', 'opencode', 'pi'].sort()
    );
  });

  it('recognizes cursor-cli as an eighth id, distinct from cursor', () => {
    expect(ALL_HARNESS_IDS).toContain('cursor-cli');
    expect(ALL_HARNESS_IDS).toContain('cursor');
    expect(ALL_HARNESS_IDS.length).toBe(8);
    expect(isHarnessId('cursor-cli')).toBe(true);
    expect(isHarnessId('cursor')).toBe(true);
  });

  it('isHarnessId accepts every recognized id', () => {
    for (const id of ALL_HARNESS_IDS) {
      expect(isHarnessId(id)).toBe(true);
    }
  });

  it('isHarnessId rejects an unrecognized string', () => {
    expect(isHarnessId('not-a-real-harness')).toBe(false);
  });
});
