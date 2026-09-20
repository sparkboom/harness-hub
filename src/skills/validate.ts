export interface FrontmatterIssue {
  code:
    | 'missing-name'
    | 'invalid-name-format'
    | 'name-mismatch'
    | 'missing-description'
    | 'description-length';
  message: string;
}

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function validateSkillFrontmatter(
  dirName: string,
  frontmatter: Record<string, unknown> | undefined
): FrontmatterIssue[] {
  const issues: FrontmatterIssue[] = [];
  const name = frontmatter?.['name'];
  const description = frontmatter?.['description'];

  if (typeof name !== 'string' || name.length === 0) {
    issues.push({ code: 'missing-name', message: `Skill "${dirName}": frontmatter "name" is missing or empty.` });
  } else {
    if (name.length > 64 || !NAME_PATTERN.test(name)) {
      issues.push({
        code: 'invalid-name-format',
        message: `Skill "${dirName}": "name" must be 1-64 chars, lowercase a-z0-9 and single hyphens, no leading/trailing/consecutive hyphens (got "${name}").`,
      });
    }
    if (name !== dirName) {
      issues.push({
        code: 'name-mismatch',
        message: `Skill "${dirName}": frontmatter "name" ("${name}") must equal the parent directory name.`,
      });
    }
  }

  if (typeof description !== 'string' || description.length === 0) {
    issues.push({
      code: 'missing-description',
      message: `Skill "${dirName}": frontmatter "description" is missing or empty.`,
    });
  } else if (description.length > 1024) {
    issues.push({
      code: 'description-length',
      message: `Skill "${dirName}": "description" must be 1-1024 chars (got ${description.length}).`,
    });
  }

  return issues;
}
