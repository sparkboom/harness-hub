// src/wiring/migrateSymlink.ts
import { lstatSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ensureGitignoreEntries, isSymlinkTo, relativeSymlinkTarget } from '../fsutil';
import { skillsRootDir, AGENTS_MD_FILENAME } from '../canon';
import type { HarnessEntry } from '../registry';

/** True if `linkPath` is present as a symlink, dangling or not (unlike existsSync, which follows links). */
function pathPresent(linkPath: string): boolean {
  try {
    lstatSync(linkPath);
    return true;
  } catch {
    return false;
  }
}

function ensureSymlink(repoRoot: string, linkRelPath: string, targetAbsPath: string): void {
  const linkAbsPath = join(repoRoot, linkRelPath);
  const target = relativeSymlinkTarget(repoRoot, linkRelPath, targetAbsPath);
  if (pathPresent(linkAbsPath) && !isSymlinkTo(linkAbsPath, target)) {
    rmSync(linkAbsPath, { recursive: true, force: true });
  }
  if (!pathPresent(linkAbsPath)) {
    mkdirSync(dirname(linkAbsPath), { recursive: true });
    symlinkSync(target, linkAbsPath);
  }
}

/**
 * Wires a harness's AGENTS.md symlink and/or skills symlink per its registry
 * entry. Assumes doctor's blocking checks (claude-md-clobber,
 * claude-skills-clobber, unmigrated-skills, skill-migration-collision)
 * already passed for this harness.
 */
export function wireMigrateSymlinkHarness(repoRoot: string, entry: HarnessEntry): void {
  if (entry.skills.mode === 'migrate-symlink' && entry.skills.symlinkPath) {
    ensureSymlink(repoRoot, entry.skills.symlinkPath, skillsRootDir(repoRoot));
  }
  if (entry.agentsDoc.mode === 'symlink' && entry.agentsDoc.symlinkPath) {
    ensureSymlink(repoRoot, entry.agentsDoc.symlinkPath, join(repoRoot, AGENTS_MD_FILENAME));
  }
  const gitignoreEntries = [entry.agentsDoc.symlinkPath, entry.skills.symlinkPath].filter(
    (p): p is string => Boolean(p)
  );
  if (gitignoreEntries.length > 0) {
    ensureGitignoreEntries(repoRoot, gitignoreEntries);
  }
}
