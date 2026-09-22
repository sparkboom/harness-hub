import { join } from 'node:path';
import { isSymlinkTo, relativeSymlinkTarget } from '../../fsutil';
import { skillsRootDir, AGENTS_MD_FILENAME } from '../../canon';
import { ALL_HARNESS_IDS } from '../../harnesses';
import { getHarnessEntry } from '../../registry';
import type { DoctorRule, Finding } from '../types';

export const generatedFileDriftRule: DoctorRule = {
  id: 'generated-file-drift',
  applies: (ctx) =>
    ALL_HARNESS_IDS.some((id) => {
      const entry = getHarnessEntry(id);
      return ctx.configuredHarnesses.includes(id) && (entry.agentsDoc.mode === 'symlink' || entry.skills.mode === 'migrate-symlink');
    }),
  check: (ctx) => {
    const findings: Finding[] = [];
    for (const id of ALL_HARNESS_IDS) {
      if (!ctx.configuredHarnesses.includes(id)) continue;
      const entry = getHarnessEntry(id);
      const problems: string[] = [];

      if (entry.agentsDoc.mode === 'symlink' && entry.agentsDoc.symlinkPath) {
        const linkPath = join(ctx.repoRoot, entry.agentsDoc.symlinkPath);
        const target = relativeSymlinkTarget(ctx.repoRoot, entry.agentsDoc.symlinkPath, join(ctx.repoRoot, AGENTS_MD_FILENAME));
        if (!isSymlinkTo(linkPath, target)) problems.push(entry.agentsDoc.symlinkPath);
      }
      if (entry.skills.mode === 'migrate-symlink' && entry.skills.symlinkPath) {
        const linkPath = join(ctx.repoRoot, entry.skills.symlinkPath);
        const target = relativeSymlinkTarget(ctx.repoRoot, entry.skills.symlinkPath, skillsRootDir(ctx.repoRoot));
        if (!isSymlinkTo(linkPath, target)) problems.push(entry.skills.symlinkPath);
      }

      if (problems.length > 0) {
        findings.push({
          ruleId: 'claude-drift',
          severity: 'warning',
          message: `${id} is enabled, but ${problems.join(' and ')} ${problems.length > 1 ? 'are' : 'is'} missing or not the expected symlink.`,
          remediation: `Re-run \`harness-hub enable ${id}\` to restore the expected symlink(s).`,
          harnessId: id,
          forceable: false,
        });
      }
    }
    return findings;
  },
};
