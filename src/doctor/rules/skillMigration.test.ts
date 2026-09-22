import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { skillMigrationRule } from './skillMigration';
import type { DoctorContext } from '../types';

function makeCtx(repoRoot: string, pendingHarnesses: DoctorContext['pendingHarnesses'] = ['claude-code']): DoctorContext {
  return { repoRoot, homeDir: '/home/user', config: { status: 'absent' }, configuredHarnesses: [], pendingHarnesses, installedVersions: {} as DoctorContext['installedVersions'] };
}

describe('skillMigrationRule', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-migrule-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('does not apply when claude-code is irrelevant', () => {
    expect(skillMigrationRule.applies(makeCtx(repoRoot, []))).toBe(false);
  });

  it('reports unmigrated-skills for a new entry', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'body');
    const findings = skillMigrationRule.check(makeCtx(repoRoot));
    expect(findings).toEqual([
      expect.objectContaining({ ruleId: 'unmigrated-skills', severity: 'error', harnessId: 'claude-code', forceable: false }),
    ]);
  });

  it('reports skill-migration-collision for a differing entry', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'one');
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'two');
    const findings = skillMigrationRule.check(makeCtx(repoRoot));
    expect(findings).toEqual([
      expect.objectContaining({ ruleId: 'skill-migration-collision', severity: 'error', forceable: false }),
    ]);
  });

  it('reports nothing for an already-identical entry', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'same');
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'same');
    expect(skillMigrationRule.check(makeCtx(repoRoot))).toEqual([]);
  });
});
