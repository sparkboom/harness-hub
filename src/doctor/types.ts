import type { HarnessId } from '../harnesses';
import type { ConfigLoadResult } from '../config';

export type Severity = 'error' | 'warning';

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  remediation: string;
  /** Set when this finding is specific to one harness; undefined for canon-wide findings. */
  harnessId?: HarnessId;
  /** True only for findings `enable --force` may override (clobber risk, MVP). */
  forceable: boolean;
}

export interface DoctorContext {
  repoRoot: string;
  homeDir: string;
  config: ConfigLoadResult;
  /** Harnesses already configured ("ok" config's harnesses; [] if config is absent/invalid). */
  configuredHarnesses: HarnessId[];
  /** Harnesses `enable` is currently trying to wire, not yet in configuredHarnesses (empty for a plain `doctor` run). */
  pendingHarnesses: HarnessId[];
  /** Installed version per harness id, or null when not detected (see detectInstalledVersions). */
  installedVersions: Record<HarnessId, string | null>;
}

export interface DoctorRule {
  id: string;
  applies(ctx: DoctorContext): boolean;
  check(ctx: DoctorContext): Finding[];
}
