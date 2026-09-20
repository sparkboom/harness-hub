import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

export const AGENTS_MD_FILENAME = 'AGENTS.md';
export const SKILLS_DIR = join('.agents', 'skills');

export function hasAgentsMd(repoRoot: string): boolean {
  return existsSync(join(repoRoot, AGENTS_MD_FILENAME));
}

export function skillsRootDir(repoRoot: string): string {
  return join(repoRoot, SKILLS_DIR);
}

/** Every direct child directory of .agents/skills/, by name. Empty array if the dir is absent. */
export function listSkillDirNames(repoRoot: string): string[] {
  const root = skillsRootDir(repoRoot);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/** Any entry directly under .agents/skills/ that is NOT a directory (e.g. a stray flat .md file). */
export function listSkillsRootNonDirEntries(repoRoot: string): string[] {
  const root = skillsRootDir(repoRoot);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => !entry.isDirectory())
    .map((entry) => entry.name);
}

export interface SkillFrontmatterResult {
  hasSkillMd: boolean;
  frontmatter?: Record<string, unknown>;
}

/** Reads <skillsRoot>/<name>/SKILL.md's frontmatter, if the file exists. */
export function readSkillFrontmatter(repoRoot: string, name: string): SkillFrontmatterResult {
  const skillMdPath = join(skillsRootDir(repoRoot), name, 'SKILL.md');
  if (!existsSync(skillMdPath) || !statSync(skillMdPath).isFile()) {
    return { hasSkillMd: false };
  }
  try {
    const raw = readFileSync(skillMdPath, 'utf8');
    const parsed = matter(raw);
    return { hasSkillMd: true, frontmatter: parsed.data };
  } catch {
    // Malformed SKILL.md: degrade to "present but unreadable" so the
    // skill-frontmatter doctor rule reports it instead of crashing.
    return { hasSkillMd: true, frontmatter: undefined };
  }
}
