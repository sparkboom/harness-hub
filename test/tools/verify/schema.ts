// test/tools/verify/schema.ts
//
// `HarnessId` is duplicated from `src/harnesses.ts` (same 8-member union)
// because `test/tools` production code cannot import `src/`: the tools
// tsconfig's `rootDir` makes even type-only imports a compile error (TS6059).
// Keep in sync with `src/harnesses.ts` — schema.test.ts guards this.

/** Harness identifiers; mirrors `src/harnesses.ts` `ALL_HARNESS_IDS`. */
export type HarnessId =
  | 'claude-code'
  | 'cursor'
  | 'cursor-cli'
  | 'opencode'
  | 'codex'
  | 'hermes'
  | 'pi'
  | 'deepseek';

export type EvidenceLevel = 'deterministic' | 'gateway' | 'canary' | 'behavioral' | 'rubric';
export type ConventionUnderTest = 'agentsDoc' | 'skills' | 'skills-scoping' | 'trustGate';

export interface SetupFile {
  path: string;
  content?: string;
  kind?: 'file' | 'symlink';
  /** Required when kind === 'symlink': the link target (relative or absolute). */
  symlinkTarget?: string;
}

export interface FileEntry {
  type: 'file' | 'symlink';
  /** File content (small repos; full text, not hashed — scenarios are tiny). */
  content?: string;
  /** Symlink target. */
  target?: string;
}

export interface Snapshot {
  /** path → entry, paths relative to the snapshot root. */
  files: Record<string, FileEntry>;
}

export interface ScenarioContext {
  repoRoot: string;
  homeDir: string;
  /** Post-run repo snapshot. */
  repo: Snapshot;
  /** Post-run home snapshot (for trust-ledger predicates like S5). */
  home: Snapshot;
  /** Pre-run repo snapshot (for delta predicates). */
  beforeRepo: Snapshot;
  /** Pre-run home snapshot. */
  beforeHome: Snapshot;
}

export interface PredicateResult {
  pass: boolean;
  /** Human-readable reason, surfaced in the report. */
  reason: string;
}

/** A deterministic check over the post-prompt snapshot delta. */
export type Predicate = (ctx: ScenarioContext) => PredicateResult;

export interface RubricCriterion {
  id: string;
  text: string;
}

export interface Scenario {
  id: string;
  conventionUnderTest: ConventionUnderTest;
  harnessCompat: HarnessId[];
  setup: { files: SetupFile[]; canary?: string };
  prompt: string;
  predicate: Predicate;
  rubric?: RubricCriterion[];
  evidenceLevels: EvidenceLevel[];
}

export interface ScenarioOutcome {
  scenarioId: string;
  result: boolean;
  runs: number;
  passes: number;
  evidence: EvidenceLevel[];
  reason?: string;
  note?: string;
}
