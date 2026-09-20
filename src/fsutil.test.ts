import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  copyDirRecursive,
  dirsByteIdentical,
  isSymlinkTo,
  relativeSymlinkTarget,
  ensureGitignoreEntries,
} from './fsutil';

describe('fsutil', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hh-fsutil-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  describe('copyDirRecursive', () => {
    it('copies nested files and directories', () => {
      const src = join(root, 'src');
      mkdirSync(join(src, 'scripts'), { recursive: true });
      writeFileSync(join(src, 'SKILL.md'), 'body');
      writeFileSync(join(src, 'scripts', 'run.sh'), 'echo hi');

      const dest = join(root, 'dest');
      copyDirRecursive(src, dest);

      expect(readFileSync(join(dest, 'SKILL.md'), 'utf8')).toBe('body');
      expect(readFileSync(join(dest, 'scripts', 'run.sh'), 'utf8')).toBe('echo hi');
    });
  });

  describe('dirsByteIdentical', () => {
    it('returns true for identical trees', () => {
      const a = join(root, 'a');
      const b = join(root, 'b');
      mkdirSync(join(a, 'sub'), { recursive: true });
      mkdirSync(join(b, 'sub'), { recursive: true });
      writeFileSync(join(a, 'sub', 'f.txt'), 'same');
      writeFileSync(join(b, 'sub', 'f.txt'), 'same');
      expect(dirsByteIdentical(a, b)).toBe(true);
    });

    it('returns false when file contents differ', () => {
      const a = join(root, 'a');
      const b = join(root, 'b');
      mkdirSync(a, { recursive: true });
      mkdirSync(b, { recursive: true });
      writeFileSync(join(a, 'f.txt'), 'one');
      writeFileSync(join(b, 'f.txt'), 'two');
      expect(dirsByteIdentical(a, b)).toBe(false);
    });

    it('returns false when one side has an extra file', () => {
      const a = join(root, 'a');
      const b = join(root, 'b');
      mkdirSync(a, { recursive: true });
      mkdirSync(b, { recursive: true });
      writeFileSync(join(a, 'f.txt'), 'one');
      writeFileSync(join(b, 'f.txt'), 'one');
      writeFileSync(join(b, 'extra.txt'), 'x');
      expect(dirsByteIdentical(a, b)).toBe(false);
    });

    it('returns false when either directory is missing', () => {
      expect(dirsByteIdentical(join(root, 'missing-a'), join(root, 'missing-b'))).toBe(false);
    });

    it('returns false when a symlink is compared to a regular file', () => {
      const a = join(root, 'a');
      const b = join(root, 'b');
      mkdirSync(a, { recursive: true });
      mkdirSync(b, { recursive: true });
      writeFileSync(join(a, 'entry'), 'same');
      symlinkSync('entry', join(b, 'entry'));
      expect(dirsByteIdentical(a, b)).toBe(false);
    });

    it('returns true for two symlinks with the same stored target', () => {
      const a = join(root, 'a');
      const b = join(root, 'b');
      mkdirSync(a, { recursive: true });
      mkdirSync(b, { recursive: true });
      symlinkSync('.agents/skills', join(a, 'entry'));
      symlinkSync('.agents/skills', join(b, 'entry'));
      expect(dirsByteIdentical(a, b)).toBe(true);
    });

    it('returns false for two symlinks with different stored targets', () => {
      const a = join(root, 'a');
      const b = join(root, 'b');
      mkdirSync(a, { recursive: true });
      mkdirSync(b, { recursive: true });
      symlinkSync('one', join(a, 'entry'));
      symlinkSync('two', join(b, 'entry'));
      expect(dirsByteIdentical(a, b)).toBe(false);
    });
  });

  describe('isSymlinkTo', () => {
    it('returns true when the symlink resolves to the expected target', () => {
      const link = join(root, 'link');
      symlinkSync('.agents/skills', link);
      expect(isSymlinkTo(link, '.agents/skills')).toBe(true);
    });

    it('returns false for a symlink pointing elsewhere', () => {
      const link = join(root, 'link');
      symlinkSync('somewhere/else', link);
      expect(isSymlinkTo(link, '.agents/skills')).toBe(false);
    });

    it('returns false for a real directory', () => {
      const dir = join(root, 'realdir');
      mkdirSync(dir);
      expect(isSymlinkTo(dir, '.agents/skills')).toBe(false);
    });

    it('returns false when the path does not exist', () => {
      expect(isSymlinkTo(join(root, 'nope'), '.agents/skills')).toBe(false);
    });
  });

  describe('relativeSymlinkTarget', () => {
    it('computes the relative target for a top-level file symlink', () => {
      expect(relativeSymlinkTarget('/repo', 'CLAUDE.md', '/repo/AGENTS.md')).toBe('AGENTS.md');
    });

    it('computes the relative target for a nested directory symlink', () => {
      expect(relativeSymlinkTarget('/repo', '.claude/skills', '/repo/.agents/skills')).toBe(
        join('..', '.agents', 'skills')
      );
    });
  });

  describe('ensureGitignoreEntries', () => {
    it('creates .gitignore when absent', () => {
      ensureGitignoreEntries(root, ['CLAUDE.md', '.claude/skills']);
      const content = readFileSync(join(root, '.gitignore'), 'utf8');
      expect(content).toContain('CLAUDE.md');
      expect(content).toContain('.claude/skills');
    });

    it('appends only missing entries, without duplicating existing ones', () => {
      writeFileSync(join(root, '.gitignore'), 'node_modules\nCLAUDE.md\n');
      ensureGitignoreEntries(root, ['CLAUDE.md', '.claude/skills']);
      const lines = readFileSync(join(root, '.gitignore'), 'utf8').split('\n').filter(Boolean);
      expect(lines.filter((l) => l === 'CLAUDE.md')).toHaveLength(1);
      expect(lines).toContain('.claude/skills');
    });
  });
});
