import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agentDoc, skill, raw, writeAssets, resetTarget } from './primitives';

describe('primitives', () => {
  let target: string;
  beforeEach(() => { target = mkdtempSync(join(tmpdir(), 'hh-tools-')); });
  afterEach(() => { rmSync(target, { recursive: true, force: true }); });

  it('agentDoc returns a root-level asset', () => {
    expect(agentDoc('AGENTS.md', '# Agents\n')).toEqual({ path: 'AGENTS.md', content: '# Agents\n' });
  });

  it('skill serializes frontmatter and body at <location>/<name>/SKILL.md', () => {
    const asset = skill({ name: 'writing-tests', location: '.agents/skills', frontmatter: { name: 'writing-tests', description: 'Write tests.' }, body: 'Body\n' });
    expect(asset.path).toBe('.agents/skills/writing-tests/SKILL.md');
    expect(asset.content).toContain('name: writing-tests');
    expect(asset.content).toContain('Body');
  });

  it('writeAssets writes files and creates parent dirs', () => {
    writeAssets(target, [raw('a/b/c.md', 'x')]);
    expect(readFileSync(join(target, 'a', 'b', 'c.md'), 'utf8')).toBe('x');
  });

  it('resetTarget clears everything except .git', () => {
    writeAssets(target, [raw('keep.md', 'x'), raw('.git/HEAD', 'ref: refs/heads/main')]);
    resetTarget(target);
    expect(existsSync(join(target, 'keep.md'))).toBe(false);
    expect(existsSync(join(target, '.git', 'HEAD'))).toBe(true);
  });
});
