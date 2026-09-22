import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { trustGateRule } from './trustGate';
import type { DoctorContext } from '../types';

function makeCtx(homeDir: string, repoRoot: string, pendingHarnesses: DoctorContext['pendingHarnesses'] = ['hermes']): DoctorContext {
  return { repoRoot, homeDir, config: { status: 'absent' }, configuredHarnesses: [], pendingHarnesses, installedVersions: {} as DoctorContext['installedVersions'] };
}

describe('trustGateRule', () => {
  let homeDir: string;
  let repoRoot: string;

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), 'hh-home-'));
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-repo-'));
  });

  afterEach(() => {
    rmSync(homeDir, { recursive: true, force: true });
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('does not apply when hermes is irrelevant', () => {
    expect(trustGateRule.applies(makeCtx(homeDir, repoRoot, []))).toBe(false);
  });

  it('warns (does not error) when ~/.hermes/config.yaml is missing', () => {
    const findings = trustGateRule.check(makeCtx(homeDir, repoRoot));
    expect(findings).toEqual([expect.objectContaining({ ruleId: 'hermes-trust', severity: 'warning', harnessId: 'hermes' })]);
  });

  it('warns when the config file fails to parse', () => {
    mkdirSync(join(homeDir, '.hermes'), { recursive: true });
    writeFileSync(join(homeDir, '.hermes', 'config.yaml'), 'skills: [\n');
    expect(trustGateRule.check(makeCtx(homeDir, repoRoot))[0].severity).toBe('warning');
  });

  it('errors when the repo is not in trusted_project_dirs', () => {
    mkdirSync(join(homeDir, '.hermes'), { recursive: true });
    writeFileSync(join(homeDir, '.hermes', 'config.yaml'), 'skills:\n  trusted_project_dirs:\n    - /some/other/repo\n');
    const findings = trustGateRule.check(makeCtx(homeDir, repoRoot));
    expect(findings).toEqual([
      expect.objectContaining({ ruleId: 'hermes-trust', severity: 'error', harnessId: 'hermes', forceable: false }),
    ]);
  });

  it('passes when the repo is listed', () => {
    mkdirSync(join(homeDir, '.hermes'), { recursive: true });
    writeFileSync(join(homeDir, '.hermes', 'config.yaml'), `skills:\n  trusted_project_dirs:\n    - ${repoRoot}\n`);
    expect(trustGateRule.check(makeCtx(homeDir, repoRoot))).toEqual([]);
  });

  it('normalizes a trailing slash on the trusted path', () => {
    mkdirSync(join(homeDir, '.hermes'), { recursive: true });
    writeFileSync(join(homeDir, '.hermes', 'config.yaml'), `skills:\n  trusted_project_dirs:\n    - ${repoRoot}/\n`);
    expect(trustGateRule.check(makeCtx(homeDir, repoRoot))).toEqual([]);
  });
});
