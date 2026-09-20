## Task 2: Repo root resolution

**Files:**
- Create: `src/repo.ts`
- Test: `src/repo.test.ts`

**Interfaces:**
- Produces: `findRepoRoot(startDir: string): string`, `class NotAGitRepoError extends Error`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/repo.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/repo.test.ts`
Expected: FAIL — `Cannot find module './repo'`.

- [ ] **Step 3: Implement `findRepoRoot`**

```typescript
// src/repo.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/repo.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/repo.ts src/repo.test.ts
git commit -m "feat: findRepoRoot, matching Hermes's .git-ancestor resolution"
```

---

