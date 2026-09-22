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
