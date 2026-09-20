// src/commands/migrate.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateHarness } from './migrate';

describe('migrateHarness', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-migrate-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('errors for any harness other than claude-code', () => {
    const result = migrateHarness(repoRoot, 'cursor');
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('cursor');
  });

  it('reports nothing to migrate when .claude/skills is empty or absent', () => {
    const result = migrateHarness(repoRoot, 'claude-code');
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('nothing to migrate');
  });

  it('copies a new skill into canon without touching .claude/skills', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), '---\nname: a\ndescription: x\n---\nbody');
    const result = migrateHarness(repoRoot, 'claude-code');
    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'utf8')).toBe('---\nname: a\ndescription: x\n---\nbody');
    expect(existsSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'))).toBe(true);
  });

  it('errors on a collision without copying anything', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'one');
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'two');
    const result = migrateHarness(repoRoot, 'claude-code');
    expect(result.exitCode).toBe(1);
    expect(readFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'utf8')).toBe('two');
  });

  it('is a no-op the second time it runs', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), '---\nname: a\ndescription: x\n---\nbody');
    migrateHarness(repoRoot, 'claude-code');
    const second = migrateHarness(repoRoot, 'claude-code');
    expect(second.output).toContain('nothing to migrate');
  });

  it('refuses to adopt an entry without a SKILL.md (clobber-risk)', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'bad'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'bad', 'notaskill.md'), 'junk');
    const result = migrateHarness(repoRoot, 'claude-code');
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('clobber-risk');
    expect(result.output).toContain('bad');
    expect(existsSync(join(repoRoot, '.agents', 'skills', 'bad'))).toBe(false);
  });

  it('refuses to adopt an entry with invalid frontmatter (clobber-risk)', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'badname'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'badname', 'SKILL.md'), '---\nname: Bad_Name\ndescription: x\n---\nbody');
    const result = migrateHarness(repoRoot, 'claude-code');
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('clobber-risk');
    expect(existsSync(join(repoRoot, '.agents', 'skills', 'badname'))).toBe(false);
  });

  it('still adopts valid skills atomically after rejecting an invalid one', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'good'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'good', 'SKILL.md'), '---\nname: good\ndescription: fine\n---\nbody');
    mkdirSync(join(repoRoot, '.claude', 'skills', 'bad'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'bad', 'notaskill.md'), 'junk');
    const result = migrateHarness(repoRoot, 'claude-code');
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('bad');
    expect(existsSync(join(repoRoot, '.agents', 'skills', 'good'))).toBe(false);
    expect(existsSync(join(repoRoot, '.agents', 'skills', 'bad'))).toBe(false);
  });
});
