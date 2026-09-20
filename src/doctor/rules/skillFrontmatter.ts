import { listSkillDirNames, readSkillFrontmatter } from '../../canon';
import { validateSkillFrontmatter } from '../../skills/validate';
import type { DoctorRule, Finding } from '../types';

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
          ruleId: 'skill-frontmatter',
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
