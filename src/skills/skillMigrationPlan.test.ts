import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planSkillMigration } from './skillMigrationPlan';
import { getHarnessEntry } from '../registry';

describe('planSkillMigration', () => {
  let repoRoot: string;
  const claudeCode = getHarnessEntry('claude-code');

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-migplan-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('returns an empty plan when .claude/skills does not exist', () => {
    expect(planSkillMigration(repoRoot, claudeCode)).toEqual([]);
  });

  it('classifies a skill with no canon counterpart as new', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'body');
    const plan = planSkillMigration(repoRoot, claudeCode);
    expect(plan).toEqual([expect.objectContaining({ name: 'a', classification: 'new' })]);
  });

  it('classifies a byte-identical skill as identical', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'body');
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'body');
    expect(planSkillMigration(repoRoot, claudeCode)[0].classification).toBe('identical');
  });

  it('classifies a differing skill as a collision', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'body-one');
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'body-two');
    expect(planSkillMigration(repoRoot, claudeCode)[0].classification).toBe('collision');
  });
});
