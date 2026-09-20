import { describe, it, expect } from 'vitest';
import { ALL_HARNESS_IDS } from '../harnesses';
import { formatList } from './list';

describe('formatList', () => {
  it('names every harness id', () => {
    const out = formatList();
    for (const id of ALL_HARNESS_IDS) expect(out).toContain(id);
  });

  it('shows each harness version', () => {
    const out = formatList();
    expect(out).toContain('2.1.272'); // claude-code
    expect(out).toContain('1.18.31'); // opencode
  });

  it('is sorted by harness id', () => {
    const out = formatList();
    const expected = [...ALL_HARNESS_IDS].sort();
    const positions = expected.map((id) => out.indexOf(id));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
