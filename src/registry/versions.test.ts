import { describe, it, expect } from 'vitest';
import { ALL_HARNESS_IDS } from '../harnesses';
import { loadVersionsManifest } from './versions';
import { getHarnessEntry } from './index';

describe('harness versions manifest', () => {
  it('has an entry for every recognized harness id', () => {
    const manifest = loadVersionsManifest();
    expect(Object.keys(manifest).sort()).toEqual([...ALL_HARNESS_IDS].sort());
  });

  it('registers each harness version as a non-empty string', () => {
    const manifest = loadVersionsManifest();
    for (const id of ALL_HARNESS_IDS) {
      expect(manifest[id].version).toBeTruthy();
      expect(manifest[id].verifiedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('derives the registry verifiedVersion from the manifest (no drift)', () => {
    const manifest = loadVersionsManifest();
    for (const id of ALL_HARNESS_IDS) {
      expect(getHarnessEntry(id).verifiedVersion).toBe(manifest[id].version);
      expect(getHarnessEntry(id).verifiedDate).toBe(manifest[id].verifiedDate);
    }
  });

  it('pins claude-code to the researched 2.1.272 (not "unpinned")', () => {
    expect(loadVersionsManifest()['claude-code'].version).toBe('2.1.272');
  });

  it('marks cursor install as fhs-wrapper and every other harness as npm', () => {
    const m = loadVersionsManifest();
    expect(m.cursor.install.method).toBe('fhs-wrapper');
    for (const id of ALL_HARNESS_IDS) {
      if (id === 'cursor') continue;
      expect(m[id].install.method).toBe('npm');
    }
  });
});
