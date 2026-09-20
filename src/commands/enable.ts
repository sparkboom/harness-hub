// src/commands/enable.ts
import { buildDoctorContext } from '../doctor/context';
import { runDoctor } from '../doctor/run';
import { ALL_DOCTOR_RULES } from '../doctor/rules';
import { loadConfig, saveConfig } from '../config';
import { getHarnessEntry } from '../registry';
import { wireMigrateSymlinkHarness } from '../wiring/migrateSymlink';
import type { HarnessId } from '../harnesses';
import type { Finding } from '../doctor/types';

export interface EnableHarnessResult {
  harnessId: HarnessId;
  status: 'enabled' | 'already-enabled' | 'blocked';
  blockingFindings: Finding[];
}

export interface EnableCommandResult {
  results: EnableHarnessResult[];
  exitCode: number;
}

export function enableHarnesses(
  repoRoot: string,
  harnessIds: HarnessId[],
  options: { force?: boolean; homeDir?: string } = {}
): EnableCommandResult {
  const config = loadConfig(repoRoot);
  const alreadyEnabled = config.status === 'ok' ? config.harnesses : [];
  const toEnable = harnessIds.filter((id) => !alreadyEnabled.includes(id));

  const ctx = buildDoctorContext(repoRoot, toEnable, options.homeDir);
  const allFindings = runDoctor(ctx, ALL_DOCTOR_RULES);

  // A canon-wide (no harnessId) blocking error stops every harness — nothing
  // can safely wire without valid canon (Resolved Ambiguity #1/#2).
  const globalBlocking = allFindings.filter((f) => f.harnessId === undefined && f.severity === 'error');
  if (globalBlocking.length > 0) {
    return {
      results: harnessIds.map((harnessId) => ({ harnessId, status: 'blocked', blockingFindings: globalBlocking })),
      exitCode: 1,
    };
  }

  const results: EnableHarnessResult[] = [];
  const newlyEnabled: HarnessId[] = [];

  for (const harnessId of harnessIds) {
    if (alreadyEnabled.includes(harnessId)) {
      results.push({ harnessId, status: 'already-enabled', blockingFindings: [] });
      continue;
    }

    const harnessFindings = allFindings.filter((f) => f.harnessId === harnessId);
    const blocking = harnessFindings.filter((f) => f.severity === 'error' && (!f.forceable || !options.force));

    if (blocking.length > 0) {
      results.push({ harnessId, status: 'blocked', blockingFindings: blocking });
      continue;
    }

    const entry = getHarnessEntry(harnessId);
    if (entry.agentsDoc.mode === 'symlink' || entry.skills.mode === 'migrate-symlink') {
      wireMigrateSymlinkHarness(repoRoot, entry);
    }

    newlyEnabled.push(harnessId);
    results.push({ harnessId, status: 'enabled', blockingFindings: [] });
  }

  if (newlyEnabled.length > 0) {
    saveConfig(repoRoot, [...alreadyEnabled, ...newlyEnabled]);
  }

  const exitCode = results.some((r) => r.status === 'blocked') ? 1 : 0;
  return { results, exitCode };
}
