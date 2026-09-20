import { isHarnessId, type HarnessId } from '../harnesses';
import { getHarnessEntry } from '../registry';

export function formatInfo(id: HarnessId): string {
  const e = getHarnessEntry(id);
  const lines = [`${e.displayName} (${e.id})`, `  version: ${e.verifiedVersion} (verified ${e.verifiedDate})`];
  if (e.agentsDoc.mode === 'symlink' && e.agentsDoc.symlinkPath) {
    lines.push(`  agent doc: symlink -> ${e.agentsDoc.symlinkPath}`);
  } else {
    lines.push(`  agent doc: native (reads AGENTS.md)`);
  }
  if (e.skills.mode === 'migrate-symlink' && e.skills.symlinkPath) {
    lines.push(`  skills: migrate-symlink -> ${e.skills.symlinkPath}`);
  } else {
    lines.push(`  skills: native (reads .agents/skills/)`);
  }
  if (e.skills.trustGate) {
    lines.push(`  trust gate: ${e.skills.trustGate.trustCommand}`);
    lines.push(`  trust ledger: ~/${e.skills.trustGate.configPathFromHome}`);
  }
  return lines.join('\n');
}

export function infoHarness(id: string): { output: string; exitCode: number } {
  if (!isHarnessId(id)) {
    return {
      output: `harness-hub info: unrecognized harness id "${id}" (valid: claude-code, cursor, opencode, codex, hermes, pi, deepseek)`,
      exitCode: 1,
    };
  }
  return { output: formatInfo(id), exitCode: 0 };
}
