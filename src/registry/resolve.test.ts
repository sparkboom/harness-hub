import { describe, it, expect } from 'vitest';
import { resolveVersion } from './resolve';
import type { HarnessVersionEntry } from './versions';

const codex: HarnessVersionEntry = {
  displayName: 'Codex',
  install: { method: 'npm', package: '@openai/codex' },
  ranges: [
    { profile: 'native-v1', min: '0.139.0', max: '0.155.0', status: 'verified', verifiedDate: '2026-09-03' },
    { profile: 'native-v1', min: '0.155.0', max: null, status: 'unverified' },
  ],
};

describe('resolveVersion', () => {
  it('resolves an in-range verified version', () => {
    const r = resolveVersion('codex', codex, '0.150.0');
    expect(r.status).toBe('verified');
    expect(r.profile).toBe('native-v1');
  });

  it('resolves an in-range unverified version (upstream moved)', () => {
    const r = resolveVersion('codex', codex, '0.155.1');
    expect(r.status).toBe('unverified');
  });

  it('treats max as exclusive', () => {
    expect(resolveVersion('codex', codex, '0.155.0').status).toBe('unverified');
    expect(resolveVersion('codex', codex, '0.154.999').status).toBe('verified');
  });

  it('returns unrecognized for null, unparseable, or out-of-range versions', () => {
    expect(resolveVersion('codex', codex, null).status).toBe('unrecognized');
    expect(resolveVersion('codex', codex, '3.x').status).toBe('unrecognized');
    expect(resolveVersion('codex', codex, '0.100.0').status).toBe('unrecognized');
  });
});