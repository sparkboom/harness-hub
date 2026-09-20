import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { skillShapeRule } from './skillShape';
import type { DoctorContext } from '../types';

function makeCtx(repoRoot: string): DoctorContext {
  return { repoRoot, homeDir: '/home/user', config: { status: 'absent' }, configuredHarnesses: [], pendingHarnesses: [] };
}

describe('skillShapeRule', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-skillshape-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('passes for a well-formed skill', () => {
    const dir = join(repoRoot, '.agents', 'skills', 'writing-tests');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: writing-tests\ndescription: x\n---\n');
    expect(skillShapeRule.check(makeCtx(repoRoot))).toEqual([]);
  });

  it('flags a skill directory with no SKILL.md', () => {
    mkdirSync(join(repoRoot, '.agents', 'skills', 'empty'), { recursive: true });
    const findings = skillShapeRule.check(makeCtx(repoRoot));
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('empty');
  });

  it('flags a flat .md file at the skills root', () => {
    mkdirSync(join(repoRoot, '.agents', 'skills'), { recursive: true });
    writeFileSync(join(repoRoot, '.agents', 'skills', 'stray.md'), '# stray');
    const findings = skillShapeRule.check(makeCtx(repoRoot));
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('stray.md');
  });
});
