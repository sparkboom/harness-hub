// src/registry/profiles.test.ts (new)
import { describe, it, expect } from 'vitest';
import { CONVENTION_PROFILES, getProfile } from './profiles';

describe('convention profiles', () => {
  it('defines exactly the three expected profiles', () => {
    expect(Object.keys(CONVENTION_PROFILES).sort()).toEqual(
      ['claude-code-symlink-v1', 'hermes-native-v1', 'native-v1'].sort()
    );
  });

  it('keeps claude-code the only symlink/migrate-symlink profile', () => {
    expect(CONVENTION_PROFILES['claude-code-symlink-v1'].agentsDoc.mode).toBe('symlink');
    expect(CONVENTION_PROFILES['claude-code-symlink-v1'].skills.mode).toBe('migrate-symlink');
    expect(CONVENTION_PROFILES['native-v1'].agentsDoc.mode).toBe('native');
    expect(CONVENTION_PROFILES['native-v1'].skills.trustGate).toBeUndefined();
  });

  it('keeps the hermes trust gate on hermes-native-v1 only', () => {
    expect(CONVENTION_PROFILES['hermes-native-v1'].skills.trustGate?.trustCommand).toBe('hermes skills trust');
    expect(getProfile('does-not-exist')).toBeUndefined();
  });
});
