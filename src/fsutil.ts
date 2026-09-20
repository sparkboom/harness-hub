import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  Stats,
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
    let statA: Stats;
    let statB: Stats;
    try {
      statA = lstatSync(pathA);
      statB = lstatSync(pathB);
    } catch {
      return false;
    }
    if (statA.isDirectory() !== statB.isDirectory()) return false;
    if (statA.isDirectory()) {
      if (!dirsByteIdentical(pathA, pathB)) return false;
    } else if (statA.isSymbolicLink() || statB.isSymbolicLink()) {
      // A symlink is never byte-identical to a real file/dir, and two symlinks
      // match only when their stored targets match exactly (spec §10 ownership
      // semantics — exact stored-target equality, no resolution).
      if (statA.isSymbolicLink() !== statB.isSymbolicLink()) return false;
      if (readlinkSync(pathA) !== readlinkSync(pathB)) return false;
    } else if (!readFileSync(pathA).equals(readFileSync(pathB))) {
      return false;
    }
  }
  return true;
}

/** True if `linkPath` exists, is a symlink, and resolves to exactly `expectedTarget`. */
export function isSymlinkTo(linkPath: string, expectedTarget: string): boolean {
  let stat;
  try {
    stat = lstatSync(linkPath);
  } catch {
    return false;
  }
  if (!stat.isSymbolicLink()) return false;
  return readlinkSync(linkPath) === expectedTarget;
}

/** The relative path a symlink at `repoRoot/linkRelPath` needs to point at `targetAbsPath`. */
export function relativeSymlinkTarget(
  repoRoot: string,
  linkRelPath: string,
  targetAbsPath: string
): string {
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
