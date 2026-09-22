// test/tools/reconcile.test.ts
import { describe, it, expect } from 'vitest';
import { checkLatest, formatCheck, isCoveredByVerified, type UpstreamResolver } from './reconcile';
import type { ManifestVersionEntry } from './manifest';

describe('isCoveredByVerified', () => {
  const ranges = [
    { profile: 'native-v1', min: '0.139.0', max: '0.155.0', status: 'verified' as const },
    { profile: 'native-v1', min: '0.155.0', max: null, status: 'unverified' as const },
  ];
  it('returns true when latest is inside a verified range', () => {
    expect(isCoveredByVerified('0.150.0', ranges)).toBe(true);
  });
  it('returns false when latest is outside all verified ranges', () => {
    expect(isCoveredByVerified('0.155.1', ranges)).toBe(false);
  });
});

describe('checkLatest', () => {
  it('exits non-zero when any harness latest is outside verified ranges', async () => {
    const resolver: UpstreamResolver = { latest: async () => '0.155.1' };
    const res = await checkLatest(resolver);
    // codex latest 0.155.1 is outside its verified range (0.139.0–0.155.0)
    expect(res.exitCode).toBe(1);
  });

  it('does not crash when an entry has missing or empty ranges (drift)', async () => {
    const entries: Record<string, ManifestVersionEntry> = {
      'no-ranges': { displayName: 'No Ranges', install: { method: 'npm', package: 'x' }, ranges: [] },
      'ranges-undefined': { displayName: 'Ranges Undefined', install: { method: 'npm', package: 'y' } } as ManifestVersionEntry,
    };
    const res = await checkLatest({ latest: async () => '1.2.3' }, entries);
    expect(res.rows.every((r) => !r.covered)).toBe(true);
    expect(res.exitCode).toBe(1);
  });

  it('reports a per-row upstream error (exit 2, no crash)', async () => {
    const entries: Record<string, ManifestVersionEntry> = {
      'some-harness': {
        displayName: 'Some Harness', install: { method: 'npm', package: 'pkg' },
        ranges: [{ profile: 'native-v1', min: '1.0.0', max: null, status: 'verified' }],
      },
    };
    const res = await checkLatest({ latest: async () => { throw new Error('npm down'); } }, entries);
    expect(res.exitCode).toBe(2);
    expect(res.rows[0].error).toBe('npm down');
    expect(res.rows[0].covered).toBe(false);
    expect(formatCheck(res.rows)).toContain('ERR');
  });
});