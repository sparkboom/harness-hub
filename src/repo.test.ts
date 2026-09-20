import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findRepoRoot, NotAGitRepoError } from './repo';

describe('findRepoRoot', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hh-repo-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('finds the repo root when starting at the root itself', () => {
    mkdirSync(join(root, '.git'));
    expect(findRepoRoot(root)).toBe(root);
  });

  it('walks up from a nested subdirectory', () => {
    mkdirSync(join(root, '.git'));
    const nested = join(root, 'a', 'b', 'c');
    mkdirSync(nested, { recursive: true });
    expect(findRepoRoot(nested)).toBe(root);
  });

  it('treats a .git file (linked worktree) as a valid marker', () => {
    writeFileSync(join(root, '.git'), 'gitdir: /somewhere/else\n');
    expect(findRepoRoot(root)).toBe(root);
  });

  it('throws NotAGitRepoError when no .git is found', () => {
    const nested = join(root, 'a', 'b');
    mkdirSync(nested, { recursive: true });
    expect(() => findRepoRoot(nested)).toThrow(NotAGitRepoError);
  });
});
