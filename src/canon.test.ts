import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  hasAgentsMd,
  listSkillDirNames,
  listSkillsRootNonDirEntries,
  readSkillFrontmatter,
} from './canon';

describe('canon', () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-canon-'));
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('detects AGENTS.md presence', () => {
    expect(hasAgentsMd(repoRoot)).toBe(false);
    writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
    expect(hasAgentsMd(repoRoot)).toBe(true);
  });

  it('returns an empty list when .agents/skills is absent', () => {
    expect(listSkillDirNames(repoRoot)).toEqual([]);
  });

  it('lists only directories under .agents/skills, and reports stray non-dir entries separately', () => {
    const skillsDir = join(repoRoot, '.agents', 'skills');
    mkdirSync(join(skillsDir, 'writing-tests'), { recursive: true });
    mkdirSync(join(skillsDir, 'debugging'), { recursive: true });
    writeFileSync(join(skillsDir, 'stray.md'), '# stray\n');
    expect(listSkillDirNames(repoRoot).sort()).toEqual(['debugging', 'writing-tests']);
    expect(listSkillsRootNonDirEntries(repoRoot)).toEqual(['stray.md']);
  });

  it('reads a skill SKILL.md frontmatter', () => {
    const skillDir = join(repoRoot, '.agents', 'skills', 'writing-tests');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: writing-tests\ndescription: How to write tests.\n---\n\nBody text.\n'
    );
    const result = readSkillFrontmatter(repoRoot, 'writing-tests');
    expect(result.hasSkillMd).toBe(true);
    expect(result.frontmatter).toEqual({ name: 'writing-tests', description: 'How to write tests.' });
  });

  it('reports hasSkillMd: false when SKILL.md is missing', () => {
    mkdirSync(join(repoRoot, '.agents', 'skills', 'empty-dir'), { recursive: true });
    expect(readSkillFrontmatter(repoRoot, 'empty-dir').hasSkillMd).toBe(false);
  });

  it('degrades to undefined frontmatter for malformed YAML instead of throwing', () => {
    mkdirSync(join(repoRoot, '.agents', 'skills', 'broken'), { recursive: true });
    writeFileSync(join(repoRoot, '.agents', 'skills', 'broken', 'SKILL.md'), '---\nname: [unclosed\n---\nbody');
    const result = readSkillFrontmatter(repoRoot, 'broken');
    expect(result.hasSkillMd).toBe(true);
    expect(result.frontmatter).toBeUndefined();
  });
});
