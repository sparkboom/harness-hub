// src/wiring/migrateSymlink.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, lstatSync, readlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wireMigrateSymlinkHarness } from './migrateSymlink';
import { getHarnessEntry } from '../registry';

describe('wireMigrateSymlinkHarness', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-wiring-'));
    writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('creates both symlinks from a clean repo', () => {
    wireMigrateSymlinkHarness(repoRoot, getHarnessEntry('claude-code'));

    expect(readlinkSync(join(repoRoot, 'CLAUDE.md'))).toBe('AGENTS.md');
    expect(readlinkSync(join(repoRoot, '.claude', 'skills'))).toBe(join('..', '.agents', 'skills'));
  });

  it('is idempotent when the symlinks already exist', () => {
    wireMigrateSymlinkHarness(repoRoot, getHarnessEntry('claude-code'));
    wireMigrateSymlinkHarness(repoRoot, getHarnessEntry('claude-code'));
    expect(lstatSync(join(repoRoot, 'CLAUDE.md')).isSymbolicLink()).toBe(true);
  });

  it('replaces a real .claude/skills directory that only contains already-migrated content', () => {
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'body');
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'body');

    wireMigrateSymlinkHarness(repoRoot, getHarnessEntry('claude-code'));

    expect(lstatSync(join(repoRoot, '.claude', 'skills')).isSymbolicLink()).toBe(true);
  });

  it('replaces a foreign CLAUDE.md (the --force path)', () => {
    writeFileSync(join(repoRoot, 'CLAUDE.md'), '# hand-written\n');
    wireMigrateSymlinkHarness(repoRoot, getHarnessEntry('claude-code'));
    expect(readlinkSync(join(repoRoot, 'CLAUDE.md'))).toBe('AGENTS.md');
  });

  it('adds both paths to .gitignore', () => {
    wireMigrateSymlinkHarness(repoRoot, getHarnessEntry('claude-code'));
    const gitignore = readFileSync(join(repoRoot, '.gitignore'), 'utf8');
    expect(gitignore).toContain('CLAUDE.md');
    expect(gitignore).toContain('.claude/skills');
  });
});
