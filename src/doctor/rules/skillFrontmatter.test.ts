import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { skillFrontmatterRule } from './skillFrontmatter';
import type { DoctorContext } from '../types';

function makeCtx(repoRoot: string): DoctorContext {
  return { repoRoot, homeDir: '/home/user', config: { status: 'absent' }, configuredHarnesses: [], pendingHarnesses: [] };
}

describe('skillFrontmatterRule', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-skillfm-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('passes for valid frontmatter', () => {
    const dir = join(repoRoot, '.agents', 'skills', 'writing-tests');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: writing-tests\ndescription: x\n---\n');
    expect(skillFrontmatterRule.check(makeCtx(repoRoot))).toEqual([]);
  });

  it('flags a name/directory mismatch', () => {
    const dir = join(repoRoot, '.agents', 'skills', 'writing-tests');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: other\ndescription: x\n---\n');
    const findings = skillFrontmatterRule.check(makeCtx(repoRoot));
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.ruleId === 'skill-name-mismatch')).toBe(true);
  });

  it('skips directories with no SKILL.md (left to skill-shape rule)', () => {
    mkdirSync(join(repoRoot, '.agents', 'skills', 'empty'), { recursive: true });
    expect(skillFrontmatterRule.check(makeCtx(repoRoot))).toEqual([]);
  });
});
