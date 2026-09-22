// test/tools/reconcile.test.ts
import { describe, it, expect } from 'vitest';
import { checkLatest, isCoveredByVerified, type UpstreamResolver } from './reconcile';

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
});