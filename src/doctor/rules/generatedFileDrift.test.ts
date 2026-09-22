import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generatedFileDriftRule } from './generatedFileDrift';
import type { DoctorContext } from '../types';

function makeCtx(repoRoot: string, configuredHarnesses: DoctorContext['configuredHarnesses'] = ['claude-code']): DoctorContext {
  return { repoRoot, homeDir: '/home/user', config: { status: 'absent' }, configuredHarnesses, pendingHarnesses: [] };
}

describe('generatedFileDriftRule', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-drift-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('does not apply when claude-code is not configured', () => {
    expect(generatedFileDriftRule.applies(makeCtx(repoRoot, []))).toBe(false);
  });

  it('warns when the symlinks are missing', () => {
    expect(generatedFileDriftRule.check(makeCtx(repoRoot))).toEqual([
      expect.objectContaining({ ruleId: 'claude-drift', severity: 'warning', harnessId: 'claude-code' }),
    ]);
  });

  it('passes when both symlinks are correct', () => {
    writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
    symlinkSync('AGENTS.md', join(repoRoot, 'CLAUDE.md'));
    mkdirSync(join(repoRoot, '.agents', 'skills'), { recursive: true });
    mkdirSync(join(repoRoot, '.claude'), { recursive: true });
    symlinkSync(join('..', '.agents', 'skills'), join(repoRoot, '.claude', 'skills'));
    expect(generatedFileDriftRule.check(makeCtx(repoRoot))).toEqual([]);
  });
});
