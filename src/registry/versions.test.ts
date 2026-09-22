// src/registry/versions.test.ts (rewrite)
import { describe, it, expect } from 'vitest';
import { ALL_HARNESS_IDS } from '../harnesses';
import { loadVersionsManifest } from './versions';
import { CONVENTION_PROFILES } from './profiles';

describe('harness versions manifest', () => {
  it('has an entry for every recognized harness id', () => {
    expect(Object.keys(loadVersionsManifest()).sort()).toEqual([...ALL_HARNESS_IDS].sort());
  });

  it('gives every harness at least one range with a known profile', () => {
    const m = loadVersionsManifest();
    for (const id of ALL_HARNESS_IDS) {
      expect(m[id].ranges.length).toBeGreaterThan(0);
      for (const r of m[id].ranges) {
        expect(CONVENTION_PROFILES[r.profile]).toBeDefined();
        expect(r.status).toMatch(/^(verified|unverified)$/);
      }
    }
  });

  it('keeps cursor and cursor-cli as fhs-wrapper, every npm harness as npm', () => {
    const m = loadVersionsManifest();
    expect(m.cursor.install.method).toBe('fhs-wrapper');
    expect(m['cursor-cli'].install.method).toBe('fhs-wrapper');
    expect(m['claude-code'].install.method).toBe('npm');
    expect(m.codex.install.method).toBe('npm');
  });

  it('marks cursor manual-review and cursor-cli automated-review', () => {
    const m = loadVersionsManifest();
    expect(m.cursor.ranges[0].review).toBe('manual');
    expect(m['cursor-cli'].ranges[0].review).toBe('automated');
  });
});
