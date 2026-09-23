### Task 1: Scenario schema types

**Files:**
- Create: `test/tools/verify/schema.ts`
- Create: `test/tools/verify/schema.test.ts`

**Interfaces:**
- Produces: `EvidenceLevel`, `ConventionUnderTest`, `SetupFile`, `Predicate`, `Scenario`, `ScenarioContext`, `Snapshot`, `FileEntry`, `ScenarioOutcome`, `PredicateResult`.

- [ ] **Step 1: Write `schema.ts`**

```ts
// test/tools/verify/schema.ts
import type { HarnessId } from '../../src/harnesses';

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
```

- [ ] **Step 2: Write the smoke test**

```ts
// test/tools/verify/schema.test.ts
import { describe, it, expect } from 'vitest';
import type { Snapshot } from './schema';

const emptySnapshot: Snapshot = { files: {} };

describe('schema', () => {
  it('is importable and Snapshot is structurally stable', () => {
    const s: Snapshot = { files: {} };
    expect(s.files).toEqual({});
    expect(emptySnapshot.files).toEqual({});
  });
});
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run test/tools/verify/schema.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add test/tools/verify/schema.ts test/tools/verify/schema.test.ts
git commit -m "feat(verify): add scenario schema types"
```

---

