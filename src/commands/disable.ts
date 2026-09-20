// src/commands/disable.ts
import { existsSync, lstatSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, saveConfig } from '../config';
import { getHarnessEntry } from '../registry';
import type { HarnessId } from '../harnesses';

export interface DisableCommandResult {
  output: string;
  exitCode: number;
}

function removeIfSymlink(path: string): void {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
    rmSync(path, { force: true });
  }
}

export function disableHarnesses(repoRoot: string, harnessIds: HarnessId[]): DisableCommandResult {
  const config = loadConfig(repoRoot);
  const currentlyEnabled = config.status === 'ok' ? config.harnesses : [];
  const remaining = currentlyEnabled.filter((id) => !harnessIds.includes(id));

  for (const harnessId of harnessIds) {
    const entry = getHarnessEntry(harnessId);
    if (entry.agentsDoc.mode === 'symlink' && entry.agentsDoc.symlinkPath) {
      removeIfSymlink(join(repoRoot, entry.agentsDoc.symlinkPath));
    }
    if (entry.skills.mode === 'migrate-symlink' && entry.skills.symlinkPath) {
      removeIfSymlink(join(repoRoot, entry.skills.symlinkPath));
    }
  }

  if (remaining.length !== currentlyEnabled.length) {
    saveConfig(repoRoot, remaining);
  }

  return {
    output: `harness-hub disable: ${harnessIds.join(', ')} disabled.`,
    exitCode: 0,
  };
}
