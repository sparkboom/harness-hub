import { describe, it, expect } from 'vitest';
import type { HarnessId } from '../../harnesses';
import type { DoctorContext } from '../types';
import { versionStatusRule } from './versionStatus';

function ctx(configured: HarnessId[], installed: Record<HarnessId, string | null>): DoctorContext {
  return {
    repoRoot: '/tmp/repo',
    homeDir: '/tmp/home',
    config: { status: 'ok', format: 'yaml', path: 'x', harnesses: configured, unknownIds: [] },
    configuredHarnesses: configured,
    pendingHarnesses: [],
    installedVersions: installed,
  };
}

describe('version-status rule', () => {
  it('warns when an installed version falls in an unverified range', () => {
    const installed = { codex: '0.155.1' } as Record<HarnessId, string | null>;
    const findings = versionStatusRule.check(ctx(['codex'], installed));
    expect(findings.some((f) => f.ruleId === 'version-unverified' && f.harnessId === 'codex')).toBe(true);
  });

  it('warns when an installed version matches no range', () => {
    // 0.100.0 sits below codex's first range (min 0.139.0), so no range matches.
    // (The manifest's last range is open-ended, so any parseable version at or
    // above min resolves verified/unverified — only null, unparseable, or
    // below-range versions are unrecognized.)
    const installed = { codex: '0.100.0' } as Record<HarnessId, string | null>;
    const findings = versionStatusRule.check(ctx(['codex'], installed));
    expect(findings.some((f) => f.ruleId === 'version-unrecognized')).toBe(true);
  });

  it('is silent for a verified version', () => {
    const installed = { codex: '0.150.0' } as Record<HarnessId, string | null>;
    expect(versionStatusRule.check(ctx(['codex'], installed))).toHaveLength(0);
  });

  it('warns unrecognized when the version is unknown (null or missing entry)', () => {
    const installed = { codex: null } as Record<HarnessId, string | null>;
    const findings = versionStatusRule.check(ctx(['codex'], installed));
    const finding = findings.find((f) => f.ruleId === 'version-unrecognized');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('warning');
    expect(finding?.message).toContain('unknown');
  });

  it('ignores harnesses that are neither configured nor pending', () => {
    const installed = { cursor: '3.0.0', codex: '0.100.0' } as Record<HarnessId, string | null>;
    // cursor is configured (and verified → silent); codex is unrecognized but not relevant.
    expect(versionStatusRule.check(ctx(['cursor'], installed))).toHaveLength(0);
  });
});
