// test/tools/verify/snapshot.ts
import { lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import type { Snapshot, FileEntry } from './schema';

function walk(dir: string, base: string, out: Record<string, FileEntry>): void {
  for (const name of readdirSync(dir)) {
    if (name === '.git') continue;
    const full = join(dir, name);
    const rel = full.slice(base.length + 1);
    const st = lstatSync(full);
    if (st.isSymbolicLink()) {
      // Normalize absolute link targets to be relative to the snapshot root
      // so setup-created absolute links (e.g. `${repoRoot}/target-dir`)
      // compare equal across runs/roots.
      const raw = readlinkSync(full);
      out[rel] = {
        type: 'symlink',
        target: isAbsolute(raw) ? relative(base, raw) : raw,
      };
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
