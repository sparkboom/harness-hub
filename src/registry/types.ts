import type { HarnessId } from '../harnesses';

export interface AgentsDocConvention {
  /** 'native' = harness reads AGENTS.md directly; 'symlink' = harness reads a generated symlink pointing at AGENTS.md. */
  mode: 'native' | 'symlink';
  /** Relative path (from repo root) of the symlink harness-hub creates. Only set when mode === 'symlink'. */
  symlinkPath?: string;
}

export interface TrustGateConvention {
  /** Path to the trust ledger, relative to the user's home directory. */
  configPathFromHome: string;
  /** Dotted key path inside that (YAML) file holding the list of trusted repo paths. */
  trustedDirsKeyPath: string[];
  /** The command a human runs to grant trust — shown verbatim in doctor remediation text. */
  trustCommand: string;
}

export interface SkillsConvention {
  /**
   * 'native'          = harness reads .agents/skills/ directly, nothing generated.
   * 'migrate-symlink' = harness reads its own dir; harness-hub adopts pre-existing
   *                     content into canon (migrate) then symlinks that dir to canon.
   */
  mode: 'native' | 'migrate-symlink';
  /** Relative path (from repo root) of the symlink/real dir this harness reads. Only set for 'migrate-symlink'. */
  symlinkPath?: string;
  /** Set only for harnesses that gate loading on a separate trust step (Hermes, MVP). */
  trustGate?: TrustGateConvention;
}

export interface HarnessEntry {
  id: HarnessId;
  displayName: string;
  /** The harness version this entry's conventions were last verified against. */
  verifiedVersion: string;
  /** ISO 8601 date (YYYY-MM-DD) of that verification. */
  verifiedDate: string;
  agentsDoc: AgentsDocConvention;
  skills: SkillsConvention;
}
