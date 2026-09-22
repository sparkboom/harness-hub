import { describe, it, expect } from 'vitest';
import { formatDetect } from './detect';
import { detectWith } from './detect';
import { loadManifest, UNPINNED } from './manifest';

// Re-expresses the registry pin rule (newest verified range, max ?? min) so
// the expectation is derived from config data, not a static literal.
function expectedPin(id: string): string {
  const ranges = loadManifest()[id].ranges;
  const verified = ranges.filter((r) => r.status === 'verified').at(-1);
  if (!verified) return UNPINNED;
  return verified.max ?? verified.min;
}

describe('detect', () => {
  it('reports a missing harness with null installed', () => {
    const rows = detectWith(() => null);
    const cursor = rows.find((r) => r.id === 'cursor')!;
    expect(cursor.installed).toBeNull();
    // cursor's only range is verified (manual review) and open-ended → pin is
    // the range min. The genuinely unverified entry is cursor-cli.
    expect(cursor.pin).toBe(expectedPin('cursor'));
    expect(cursor.pin).toBe('3.0.0');
    const cursorCli = rows.find((r) => r.id === 'cursor-cli')!;
    expect(cursorCli.pin).toBe(UNPINNED);
  });

  it('reports an installed harness version', () => {
    const rows = detectWith((id) => (id === 'opencode' ? '1.16.2\n' : null));
    expect(rows.find((r) => r.id === 'opencode')!.installed).toBe('1.16.2');
    expect(rows.find((r) => r.id === 'claude-code')!.installed).toBeNull();
  });

  it('formats every harness id and its pin', () => {
    const rows = detectWith(() => null);
    const out = formatDetect(rows);
    expect(out).toContain('claude-code');
    // Open-ended verified range (min 2.0.0, max null) → pin is the min.
    expect(out).toContain(expectedPin('claude-code'));
    expect(out).toContain('NOT INSTALLED');
  });

  it('derives a capped verified range pin from max', () => {
    const rows = detectWith(() => null);
    const codex = rows.find((r) => r.id === 'codex')!;
    // codex's newest verified range is 0.139.0 ≤ v < 0.155.0 → pin is the max.
    expect(codex.pin).toBe(expectedPin('codex'));
    expect(codex.pin).toBe('0.155.0');
  });
});
