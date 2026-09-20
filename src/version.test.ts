// src/version.test.ts
import { describe, it, expect } from 'vitest';
import { getPackageVersion } from './version';

describe('getPackageVersion', () => {
  it('returns the version string from package.json', () => {
    const version = getPackageVersion();
    expect(version).toBe('0.1.0');
  });
});
