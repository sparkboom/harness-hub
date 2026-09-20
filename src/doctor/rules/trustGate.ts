import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ALL_HARNESS_IDS, type HarnessId } from '../../harnesses';
import { getHarnessEntry } from '../../registry';
import type { DoctorContext, DoctorRule, Finding } from '../types';

function getAtKeyPath(obj: unknown, keyPath: string[]): unknown {
  let current = obj;
  for (const key of keyPath) {
    if (typeof current !== 'object' || current === null || !(key in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function trustGatedHarnessIds(): HarnessId[] {
  return ALL_HARNESS_IDS.filter((id) => getHarnessEntry(id).skills.trustGate !== undefined);
}

function isRelevant(ctx: DoctorContext, id: HarnessId): boolean {
  return ctx.configuredHarnesses.includes(id) || ctx.pendingHarnesses.includes(id);
}

export const trustGateRule: DoctorRule = {
  id: 'trust-gate',
  applies: (ctx) => trustGatedHarnessIds().some((id) => isRelevant(ctx, id)),
  check: (ctx) => {
    const findings: Finding[] = [];
    for (const id of trustGatedHarnessIds()) {
      if (!isRelevant(ctx, id)) continue;
      const entry = getHarnessEntry(id);
      const trustGate = entry.skills.trustGate;
      if (!trustGate) continue;

      const configPath = join(ctx.homeDir, trustGate.configPathFromHome);
      const cantVerify = (reason: string) => {
        findings.push({
          ruleId: 'hermes-trust',
          severity: 'warning',
          message: `Can't verify ${entry.displayName} trust: ${reason}`,
          remediation: `Run \`${trustGate.trustCommand}\` inside the repo, or check ${configPath} manually.`,
          harnessId: id,
          forceable: false,
        });
      };

      if (!existsSync(configPath)) {
        cantVerify(`${configPath} does not exist.`);
        continue;
      }

      let parsed: unknown;
      try {
        parsed = parseYaml(readFileSync(configPath, 'utf8'));
      } catch (err) {
        cantVerify(`${configPath} failed to parse (${err instanceof Error ? err.message : String(err)}).`);
        continue;
      }

      const trustedDirs = getAtKeyPath(parsed, trustGate.trustedDirsKeyPath);
      if (!Array.isArray(trustedDirs)) {
        cantVerify(`${configPath} has no readable "${trustGate.trustedDirsKeyPath.join('.')}" list.`);
        continue;
      }

      const isTrusted = trustedDirs.some(
        (dir) => typeof dir === 'string' && dir.replace(/\/$/, '') === ctx.repoRoot.replace(/\/$/, '')
      );
      if (!isTrusted) {
        findings.push({
          ruleId: 'hermes-trust',
          severity: 'error',
          message: `${ctx.repoRoot} is not listed in ${configPath}'s "${trustGate.trustedDirsKeyPath.join('.')}".`,
          remediation: `Run \`${trustGate.trustCommand}\` inside the repo, then re-run enable.`,
          harnessId: id,
          forceable: false,
        });
      }
    }
    return findings;
  },
};
