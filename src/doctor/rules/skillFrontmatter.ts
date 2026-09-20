import { listSkillDirNames, readSkillFrontmatter } from '../../canon';
import { validateSkillFrontmatter } from '../../skills/validate';
import type { DoctorRule, Finding } from '../types';

const CODE_TO_RULE_ID: Record<string, string> = {
  'missing-name': 'skill-missing-name',
  'invalid-name-format': 'skill-invalid-name-format',
  'name-mismatch': 'skill-name-mismatch',
  'missing-description': 'skill-missing-description',
  'description-length': 'skill-description-length',
};

export const skillFrontmatterRule: DoctorRule = {
  id: 'skill-frontmatter',
  applies: () => true,
  check: (ctx) => {
    const findings: Finding[] = [];
    for (const name of listSkillDirNames(ctx.repoRoot)) {
      const { hasSkillMd, frontmatter } = readSkillFrontmatter(ctx.repoRoot, name);
      if (!hasSkillMd) continue; // reported by skill-shape instead
      for (const issue of validateSkillFrontmatter(name, frontmatter)) {
        findings.push({
          ruleId: CODE_TO_RULE_ID[issue.code] ?? 'skill-frontmatter',
          severity: 'error',
          message: issue.message,
          remediation: `Fix the frontmatter in .agents/skills/${name}/SKILL.md.`,
          forceable: false,
        });
      }
    }
    return findings;
  },
};
