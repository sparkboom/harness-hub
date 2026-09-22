import { homedir } from 'node:os';
import { loadConfig } from '../config';
import type { HarnessId } from '../harnesses';
import type { DoctorContext } from './types';

const EMPTY_VERSIONS = {} as Record<HarnessId, string | null>;

export function buildDoctorContext(
  repoRoot: string,
  pendingHarnesses: HarnessId[] = [],
  homeDir: string = homedir(),
  installedVersions: Record<HarnessId, string | null> = EMPTY_VERSIONS
): DoctorContext {
  const config = loadConfig(repoRoot);
  const configuredHarnesses = config.status === 'ok' ? config.harnesses : [];
  return { repoRoot, homeDir, config, configuredHarnesses, pendingHarnesses, installedVersions };
}
