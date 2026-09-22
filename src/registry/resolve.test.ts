import { describe, it, expect } from 'vitest';
import { resolveVersion, resolveHarnessStatus } from './resolve';
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

  it('returns unrecognized instead of throwing when the manifest has no entry for the id', () => {
    // With the shipped config every harness id has an entry, so simulate a
    // manifest-missing id by passing an undefined-cast entry.
    const missing = undefined as unknown as HarnessVersionEntry;
    const r = resolveVersion('codex', missing, '0.150.0');
    expect(r).toEqual({
      harnessId: 'codex',
      installedVersion: '0.150.0',
      status: 'unrecognized',
      profile: null,
      range: null,
    });
  });

  it('parses version banners with a package prefix (codex npm version output)', () => {
    // "codex-cli 0.155.1" is the real banner shape of the codex npm package.
    const r = resolveVersion('codex', codex, 'codex-cli 0.155.1');
    expect(r.status).toBe('unverified');
    expect(r.range?.min).toBe('0.155.0');
  });

  it('treats bare wildcard range specs as unparseable, not coerced versions', () => {
    expect(resolveVersion('codex', codex, '3.x').status).toBe('unrecognized');
    expect(resolveVersion('codex', codex, '1.2.x').status).toBe('unrecognized');
    expect(resolveVersion('codex', codex, 'v3.x').status).toBe('unrecognized');
  });

  it('still parses prerelease versions containing x-components', () => {
    // "1.2.3-x" is a valid prerelease semver; valid() handles it and the
    // wildcard guard must not reject it.
    expect(resolveVersion('codex', codex, '0.150.0-beta.1').status).toBe('verified');
  });

  it('resolves through the exported resolveHarnessStatus seam', () => {
    // Loads the real shipped manifest; codex 0.155.1 sits in the open-ended
    // unverified range. This is the seam consumed by list/info/doctor.
    expect(resolveHarnessStatus('codex', '0.155.1').status).toBe('unverified');
  });
});