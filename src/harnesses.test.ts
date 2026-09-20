import { describe, it, expect } from 'vitest';
import { ALL_HARNESS_IDS, isHarnessId } from './harnesses';

describe('harnesses', () => {
  it('lists exactly the seven recognized ids from spec §4', () => {
    expect([...ALL_HARNESS_IDS].sort()).toEqual(
      ['claude-code', 'codex', 'cursor', 'deepseek', 'hermes', 'opencode', 'pi'].sort()
    );
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
