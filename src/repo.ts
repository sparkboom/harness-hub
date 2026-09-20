import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export class NotAGitRepoError extends Error {
  constructor(startDir: string) {
    super(`Not a git repository (or any parent up to "${startDir}"'s filesystem root): no .git found.`);
    this.name = 'NotAGitRepoError';
  }
}

/**
 * Walks up from `startDir` to find the nearest ancestor directory containing
 * a `.git` entry (directory for a normal checkout, file for a linked
 * worktree/submodule). Matches the resolution Hermes itself uses for
 * project trust (spec §6), so harness-hub and Hermes agree on "which repo
 * is this."
 */
export function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    if (existsSync(join(dir, '.git'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new NotAGitRepoError(startDir);
    }
    dir = parent;
  }
}
