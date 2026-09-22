import { describe, it, expect } from 'vitest';
import { formatDetect } from './detect';
import { detectWith } from './detect';
import { loadManifest } from './manifest';

describe('detect', () => {
  it('reports a missing harness with null installed', () => {
    const rows = detectWith(() => null);
    const cursor = rows.find((r) => r.id === 'cursor')!;
    expect(cursor.installed).toBeNull();
    expect(cursor.pin).toBe('unpinned');
  });

  it('reports an installed harness version', () => {
    const rows = detectWith((id) => (id === 'opencode' ? '1.16.2\n' : null));
    expect(rows.find((r) => r.id === 'opencode')!.installed).toBe('1.16.2');
    expect(rows.find((r) => r.id === 'claude-code')!.installed).toBeNull();
  });

  it('formats every harness id and its pin', () => {
    const rows = detectWith(() => null);
    const out = formatDetect(rows);
    const manifest = loadManifest();
    expect(out).toContain('claude-code');
    expect(out).toContain(manifest['claude-code'].verifiedVersion ?? 'unpinned');
    expect(out).toContain('NOT INSTALLED');
  });
});
