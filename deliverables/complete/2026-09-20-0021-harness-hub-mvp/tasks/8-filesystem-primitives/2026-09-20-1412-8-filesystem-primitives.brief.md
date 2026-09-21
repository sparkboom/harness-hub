## Task 8: Filesystem primitives

**Files:**
- Create: `src/fsutil.ts`
- Test: `src/fsutil.test.ts`

**Interfaces:**
- Produces: `copyDirRecursive(src, dest): void`, `dirsByteIdentical(a, b): boolean`, `isSymlinkTo(linkPath, expectedTarget): boolean`, `relativeSymlinkTarget(repoRoot, linkRelPath, targetAbsPath): string`, `ensureGitignoreEntries(repoRoot, entries): void`.

These are the shared primitives every wiring/doctor module in later tasks builds on — kept dependency-free (no imports from `canon`/`registry`) so they're easy to reason about in isolation.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/fsutil.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/fsutil.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/fsutil.ts
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';

export function copyDirRecursive(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      symlinkSync(readlinkSync(srcPath), destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/** Recursively compares two directory trees for identical relative paths and byte-identical file contents. */
export function dirsByteIdentical(a: string, b: string): boolean {
  if (!existsSync(a) || !existsSync(b)) return false;
  const entriesA = readdirSync(a, { withFileTypes: true })
    .map((e) => e.name)
    .sort();
  const entriesB = readdirSync(b, { withFileTypes: true })
    .map((e) => e.name)
    .sort();
  if (entriesA.length !== entriesB.length || entriesA.some((name, i) => name !== entriesB[i])) {
    return false;
  }
  for (const name of entriesA) {
    const pathA = join(a, name);
    const pathB = join(b, name);
    const statA = lstatSync(pathA);
    const statB = lstatSync(pathB);
    if (statA.isDirectory() !== statB.isDirectory()) return false;
    if (statA.isDirectory()) {
      if (!dirsByteIdentical(pathA, pathB)) return false;
    } else if (!readFileSync(pathA).equals(readFileSync(pathB))) {
      return false;
    }
  }
  return true;
}

/** True if `linkPath` exists, is a symlink, and resolves to exactly `expectedTarget`. */
export function isSymlinkTo(linkPath: string, expectedTarget: string): boolean {
  if (!existsSync(linkPath)) return false;
  const stat = lstatSync(linkPath);
  if (!stat.isSymbolicLink()) return false;
  return readlinkSync(linkPath) === expectedTarget;
}

/** The relative path a symlink at `repoRoot/linkRelPath` needs to point at `targetAbsPath`. */
export function relativeSymlinkTarget(repoRoot: string, linkRelPath: string, targetAbsPath: string): string {
  return relative(dirname(join(repoRoot, linkRelPath)), targetAbsPath);
}

/** Appends any of `entries` to repoRoot/.gitignore that isn't already present as an exact line. Creates the file if absent. */
export function ensureGitignoreEntries(repoRoot: string, entries: string[]): void {
  const gitignorePath = join(repoRoot, '.gitignore');
  const existingLines = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8').split('\n') : [];
  const missing = entries.filter((entry) => !existingLines.includes(entry));
  if (missing.length === 0) return;
  const separator = existingLines.length > 0 && existingLines[existingLines.length - 1] !== '' ? '\n' : '';
  const updated = existingLines.join('\n') + separator + missing.join('\n') + '\n';
  writeFileSync(gitignorePath, updated, 'utf8');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/fsutil.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/fsutil.ts src/fsutil.test.ts
git commit -m "feat: filesystem primitives (copy, byte-compare, symlink checks, gitignore)"
```

---

