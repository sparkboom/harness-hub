import { homedir } from 'node:os';
import { loadConfig } from '../config';
import type { HarnessId } from '../harnesses';
import type { DoctorContext } from './types';

export function buildDoctorContext(
  repoRoot: string,
  pendingHarnesses: HarnessId[] = [],
  homeDir: string = homedir()
): DoctorContext {
  const config = loadConfig(repoRoot);
  const configuredHarnesses = config.status === 'ok' ? config.harnesses : [];
  return { repoRoot, homeDir, config, configuredHarnesses, pendingHarnesses };
}
