import { describe, it, expect } from 'vitest';
import { configValidityRule } from './configValidity';
import type { DoctorContext } from '../types';

function makeCtx(config: DoctorContext['config']): DoctorContext {
  return { repoRoot: '/repo', homeDir: '/home/user', config, configuredHarnesses: [], pendingHarnesses: [] };
}

describe('configValidityRule', () => {
  it('passes when config is absent', () => {
    expect(configValidityRule.check(makeCtx({ status: 'absent' }))).toEqual([]);
  });

  it('passes for a valid config with no unknown ids', () => {
    const ctx = makeCtx({ status: 'ok', format: 'yaml', path: '/repo/harness-hub.yaml', harnesses: ['cursor'], unknownIds: [] });
    expect(configValidityRule.check(ctx)).toEqual([]);
  });

  it('flags unknown harness ids in an otherwise-valid config', () => {
    const ctx = makeCtx({ status: 'ok', format: 'yaml', path: '/repo/harness-hub.yaml', harnesses: [], unknownIds: ['bogus'] });
    expect(configValidityRule.check(ctx)[0].severity).toBe('error');
  });

  it('flags ambiguous config (both files present)', () => {
    const ctx = makeCtx({ status: 'ambiguous', yamlPath: '/repo/harness-hub.yaml', jsonPath: '/repo/harness-hub.json' });
    expect(configValidityRule.check(ctx)[0].severity).toBe('error');
  });

  it('flags a parse error', () => {
    const ctx = makeCtx({ status: 'parse-error', format: 'yaml', path: '/repo/harness-hub.yaml', error: 'bad yaml' });
    expect(configValidityRule.check(ctx)[0].message).toContain('bad yaml');
  });

  it('flags an invalid shape', () => {
    const ctx = makeCtx({
      status: 'invalid-shape',
      format: 'yaml',
      path: '/repo/harness-hub.yaml',
      reason: '"harnesses" must be an array',
    });
    expect(configValidityRule.check(ctx)[0].severity).toBe('error');
  });
});
