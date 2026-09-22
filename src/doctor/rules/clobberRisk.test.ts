import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clobberRiskRule } from './clobberRisk';
import type { DoctorContext } from '../types';

function makeCtx(repoRoot: string, pendingHarnesses: DoctorContext['pendingHarnesses'] = []): DoctorContext {
  return { repoRoot, homeDir: '/home/user', config: { status: 'absent' }, configuredHarnesses: [], pendingHarnesses, installedVersions: {} as DoctorContext['installedVersions'] };
}

describe('clobberRiskRule', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-clobber-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('does not apply when claude-code is not configured or pending', () => {
    expect(clobberRiskRule.applies(makeCtx(repoRoot))).toBe(false);
  });

  it('applies when claude-code is pending', () => {
    expect(clobberRiskRule.applies(makeCtx(repoRoot, ['claude-code']))).toBe(true);
  });

  it('passes when CLAUDE.md is the expected symlink', () => {
    writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
    symlinkSync('AGENTS.md', join(repoRoot, 'CLAUDE.md'));
    expect(clobberRiskRule.check(makeCtx(repoRoot, ['claude-code']))).toEqual([]);
  });

  it('flags a hand-written CLAUDE.md', () => {
    writeFileSync(join(repoRoot, 'CLAUDE.md'), '# hand-written\n');
    const findings = clobberRiskRule.check(makeCtx(repoRoot, ['claude-code']));
    expect(findings.some((f) => f.message.includes('CLAUDE.md'))).toBe(true);
    expect(findings.some((f) => f.ruleId === 'claude-md-clobber')).toBe(true);
    expect(findings.every((f) => f.forceable)).toBe(true);
  });

  it('flags a .claude/skills symlink pointing elsewhere', () => {
    mkdirSync(join(repoRoot, '.claude'), { recursive: true });
    symlinkSync('/somewhere/else', join(repoRoot, '.claude', 'skills'));
    const findings = clobberRiskRule.check(makeCtx(repoRoot, ['claude-code']));
    expect(findings.some((f) => f.message.includes('.claude/skills'))).toBe(true);
    expect(findings.some((f) => f.ruleId === 'claude-skills-clobber')).toBe(true);
  });

  it('does not flag .claude/skills when it is a real directory (handled by the skill-migration rule instead)', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills'), { recursive: true });
    expect(clobberRiskRule.check(makeCtx(repoRoot, ['claude-code']))).toEqual([]);
  });
});
