### Task 2: Repo/home snapshot + diff

**Files:**
- Create: `test/tools/verify/snapshot.ts`
- Create: `test/tools/verify/snapshot.test.ts`

**Interfaces:**
- Produces: `snapshot(root: string): Snapshot`; `diffFiles(before: Snapshot, after: Snapshot): string[]` (paths added or changed).

- [ ] **Step 1: Write the failing test**

```ts
// test/tools/verify/snapshot.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { snapshot, diffFiles } from './snapshot';

describe('snapshot', () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'hh-snap-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('captures file content and type', () => {
    writeFileSync(join(root, 'a.txt'), 'hello');
    const snap = snapshot(root);
    expect(snap.files['a.txt']).toEqual({ type: 'file', content: 'hello' });
  });

  it('captures symlinks with target', () => {
    mkdirSync(join(root, 'target-dir'));
    writeFileSync(join(root, 'target-dir', 'SKILL.md'), 'x');
    symlinkSync(join(root, 'target-dir'), join(root, '.claude'));
    const snap = snapshot(root);
    expect(snap.files['.claude']).toEqual({ type: 'symlink', target: 'target-dir' });
  });

  it('diffFiles returns added and changed paths', () => {
    const before = snapshot(root);
    writeFileSync(join(root, 'new.md'), 'x');
    const after = snapshot(root);
    expect(diffFiles(before, after)).toContain('new.md');
  });
});
```

- [ ] **Step 2: Implement `snapshot.ts`**

```ts
import { lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { Snapshot, FileEntry } from './schema';

function walk(dir: string, base: string, out: Record<string, FileEntry>): void {
  for (const name of readdirSync(dir)) {
    if (name === '.git') continue;
    const full = join(dir, name);
    const rel = full.slice(base.length + 1);
    const st = lstatSync(full);
    if (st.isSymbolicLink()) {
      out[rel] = { type: 'symlink', target: readlinkSync(full) };
    } else if (st.isDirectory()) {
      walk(full, base, out);
    } else if (st.isFile()) {
      out[rel] = { type: 'file', content: readFileSync(full, 'utf8') };
    }
  }
}

export function snapshot(root: string): Snapshot {
  const files: Record<string, FileEntry> = {};
  try {
    walk(root, root, files);
  } catch {
    // root may not exist yet — treat as empty snapshot.
  }
  return { files };
}

function key(f: FileEntry): string {
  return f.type === 'symlink' ? `link:${f.target ?? ''}` : `file:${f.content ?? ''}`;
}

export function diffFiles(before: Snapshot, after: Snapshot): string[] {
  const changed: string[] = [];
  for (const [path, entry] of Object.entries(after.files)) {
    const prev = before.files[path];
    if (!prev || key(prev) !== key(entry)) changed.push(path);
  }
  return changed;
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run test/tools/verify/snapshot.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add test/tools/verify/snapshot.ts test/tools/verify/snapshot.test.ts
git commit -m "feat(verify): add repo/home snapshot and diff"
```

---

