import { describe, it, expect } from 'vitest';
import { ALL_HARNESS_IDS, type HarnessId } from '../harnesses';
import { getHarnessEntry } from '../registry';
import { formatList } from './list';

const none = Object.fromEntries(ALL_HARNESS_IDS.map((id) => [id, null])) as Record<HarnessId, string | null>;

describe('formatList', () => {
  it('names every harness id', () => {
    const out = formatList(none);
    for (const id of ALL_HARNESS_IDS) expect(out).toContain(id);
  });

  it('shows each harness version', () => {
    const out = formatList(none);
    // Derived from the registry so the test cannot drift from config again.
    expect(out).toContain(getHarnessEntry('claude-code').verifiedVersion); // 2.0.0
    expect(out).toContain(getHarnessEntry('opencode').verifiedVersion); // 1.0.0
  });

  it('is sorted by harness id', () => {
    const out = formatList(none);
    const expected = [...ALL_HARNESS_IDS].sort();
    const positions = expected.map((id) => out.indexOf(id));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('shows the trust-gate command for hermes and a dash for others', () => {
    const out = formatList(none);
    expect(out).toContain('hermes skills trust');
    // The header must carry the column and non-gated rows show '-'.
    expect(out).toContain('TRUST GATE');
    const hermesLine = out.split('\n').find((line) => line.trimStart().startsWith('hermes'));
    expect(hermesLine).toContain('hermes skills trust');
    const cursorLine = out.split('\n').find((line) => line.trimStart().startsWith('cursor'));
    expect(cursorLine).toContain('-');
  });

  it('shows a STATUS column and marks an uninstalled harness unrecognized', () => {
    const out = formatList(none);
    expect(out).toContain('STATUS');
    expect(out).toContain('unrecognized');
  });
});
