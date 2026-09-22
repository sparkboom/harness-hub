import { describe, it, expect } from 'vitest';
import { ALL_HARNESS_IDS } from '../harnesses';
import { getHarnessEntry } from './index';

describe('harness registry', () => {
  it('has a fully-populated entry for every recognized harness id', () => {
    for (const id of ALL_HARNESS_IDS) {
      const entry = getHarnessEntry(id);
      expect(entry.id).toBe(id);
      expect(entry.displayName).toBeTruthy();
      expect(entry.verifiedVersion).toBeTruthy();
      expect(entry.verifiedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('marks claude-code as the only symlink-based AGENTS.md wiring', () => {
    const symlinked = ALL_HARNESS_IDS.filter((id) => getHarnessEntry(id).agentsDoc.mode === 'symlink');
    expect(symlinked).toEqual(['claude-code']);
  });

  it('marks claude-code as the only migrate-symlink skills wiring', () => {
    const migrated = ALL_HARNESS_IDS.filter((id) => getHarnessEntry(id).skills.mode === 'migrate-symlink');
    expect(migrated).toEqual(['claude-code']);
  });

  it('marks hermes as the only harness with a trust gate', () => {
    const gated = ALL_HARNESS_IDS.filter((id) => getHarnessEntry(id).skills.trustGate !== undefined);
    expect(gated).toEqual(['hermes']);
  });

  it("hermes's trust gate has a runnable trust command and a dotted config key path", () => {
    const trustGate = getHarnessEntry('hermes').skills.trustGate;
    expect(trustGate?.trustCommand).toBe('hermes skills trust');
    expect(trustGate?.trustedDirsKeyPath).toEqual(['skills', 'trusted_project_dirs']);
    expect(trustGate?.configPathFromHome).toBe('.hermes/config.yaml');
  });

  it('pins the exact symlink paths claude-code wires', () => {
    const entry = getHarnessEntry('claude-code');
    expect(entry.agentsDoc.symlinkPath).toBe('CLAUDE.md');
    expect(entry.skills.symlinkPath).toBe('.claude/skills');
    for (const id of ALL_HARNESS_IDS) {
      if (id === 'claude-code') continue;
      const other = getHarnessEntry(id);
      expect(other.agentsDoc.symlinkPath).toBeUndefined();
      expect(other.skills.symlinkPath).toBeUndefined();
    }
  });

  it('derives verifiedVersion as the newest verified range max (or min when open-ended)', () => {
    expect(getHarnessEntry('codex').verifiedVersion).toBe('0.155.0'); // max of the verified range
    expect(getHarnessEntry('claude-code').verifiedVersion).toBe('2.0.0'); // open-ended → min
  });
});
