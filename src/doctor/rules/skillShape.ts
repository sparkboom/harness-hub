import { listSkillDirNames, listSkillsRootNonDirEntries, readSkillFrontmatter } from '../../canon';
import type { DoctorRule, Finding } from '../types';

export const skillShapeRule: DoctorRule = {
  id: 'skill-shape',
  applies: () => true,
  check: (ctx) => {
    const findings: Finding[] = [];
    for (const entryName of listSkillsRootNonDirEntries(ctx.repoRoot)) {
      findings.push({
        ruleId: 'skill-shape',
        severity: 'error',
        message: `.agents/skills/${entryName} is not a directory — skills must be laid out as <name>/SKILL.md.`,
        remediation: `Move ${entryName} into its own <skill-name>/SKILL.md directory.`,
        forceable: false,
      });
    }
    for (const name of listSkillDirNames(ctx.repoRoot)) {
      const { hasSkillMd } = readSkillFrontmatter(ctx.repoRoot, name);
      if (!hasSkillMd) {
        findings.push({
          ruleId: 'skill-shape',
          severity: 'error',
          message: `.agents/skills/${name}/ has no SKILL.md.`,
          remediation: `Add .agents/skills/${name}/SKILL.md, or remove the directory if it isn't a skill.`,
          forceable: false,
        });
      }
    }
    return findings;
  },
};
