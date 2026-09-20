import { lstatSync } from 'node:fs';
import { join } from 'node:path';
import { isSymlinkTo, relativeSymlinkTarget } from '../../fsutil';
import { skillsRootDir, AGENTS_MD_FILENAME } from '../../canon';
import { ALL_HARNESS_IDS } from '../../harnesses';
import { getHarnessEntry } from '../../registry';
import type { DoctorRule, Finding } from '../types';

function isRelevant(ctx: Parameters<DoctorRule['check']>[0], id: (typeof ALL_HARNESS_IDS)[number]): boolean {
  return ctx.configuredHarnesses.includes(id) || ctx.pendingHarnesses.includes(id);
}

/**
 * True when a directory entry exists at `linkPath`, including a dangling
 * symlink. existsSync is wrong here: it follows symlinks, so a foreign
 * dangling link would be silently skipped instead of flagged.
 */
function pathPresent(linkPath: string): boolean {
  try {
    lstatSync(linkPath);
    return true;
  } catch {
    return false;
  }
}

export const clobberRiskRule: DoctorRule = {
  id: 'clobber-risk',
  applies: (ctx) =>
    ALL_HARNESS_IDS.some((id) => {
      const entry = getHarnessEntry(id);
      return isRelevant(ctx, id) && (entry.agentsDoc.mode === 'symlink' || entry.skills.mode === 'migrate-symlink');
    }),
  check: (ctx) => {
    const findings: Finding[] = [];
    for (const id of ALL_HARNESS_IDS) {
      if (!isRelevant(ctx, id)) continue;
      const entry = getHarnessEntry(id);

      if (entry.agentsDoc.mode === 'symlink' && entry.agentsDoc.symlinkPath) {
        const linkPath = join(ctx.repoRoot, entry.agentsDoc.symlinkPath);
        const target = relativeSymlinkTarget(ctx.repoRoot, entry.agentsDoc.symlinkPath, join(ctx.repoRoot, AGENTS_MD_FILENAME));
        if (pathPresent(linkPath) && !isSymlinkTo(linkPath, target)) {
          findings.push({
            ruleId: 'claude-md-clobber',
            severity: 'error',
            message: `${entry.agentsDoc.symlinkPath} exists and is not a symlink to AGENTS.md.`,
            remediation: `Remove or back up ${entry.agentsDoc.symlinkPath}, or re-run enable with --force to replace it.`,
            harnessId: id,
            forceable: true,
          });
        }
      }

      if (entry.skills.mode === 'migrate-symlink' && entry.skills.symlinkPath) {
        const linkPath = join(ctx.repoRoot, entry.skills.symlinkPath);
        const target = relativeSymlinkTarget(ctx.repoRoot, entry.skills.symlinkPath, skillsRootDir(ctx.repoRoot));
        if (pathPresent(linkPath) && lstatSync(linkPath).isSymbolicLink() && !isSymlinkTo(linkPath, target)) {
          findings.push({
            ruleId: 'claude-skills-clobber',
            severity: 'error',
            message: `${entry.skills.symlinkPath} is a symlink, but not to .agents/skills.`,
            remediation: `Remove the existing ${entry.skills.symlinkPath} symlink, or re-run enable with --force to replace it.`,
            harnessId: id,
            forceable: true,
          });
        }
      }
    }
    return findings;
  },
};
