## Task 9: Pluggable doctor-rule framework

**Files:**
- Create: `src/doctor/types.ts`
- Create: `src/doctor/run.ts`
- Test: `src/doctor/run.test.ts`

**Interfaces:**
- Consumes: `HarnessId` (Task 3), `ConfigLoadResult` (Task 5).
- Produces: `Severity`, `Finding`, `DoctorContext`, `DoctorRule`, `runDoctor(ctx, rules): Finding[]`, `hasBlockingErrors(findings): boolean`, `findingsForHarness(findings, harnessId): Finding[]`.

This is the "doctor checks as pluggable rules" architecture from `harness-doctor-architecture.insight.md` — every check in spec §9 becomes one `DoctorRule` implementation (Tasks 10, 11, 12, 14, 15, 16), and `runDoctor` is the single aggregator both `doctor` and `enable` use.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/doctor/run.test.ts
import { describe, it, expect } from 'vitest';
import { runDoctor, hasBlockingErrors, findingsForHarness } from './run';
import type { DoctorContext, DoctorRule, Finding } from './types';

function makeCtx(overrides: Partial<DoctorContext> = {}): DoctorContext {
  return {
    repoRoot: '/repo',
    homeDir: '/home/user',
    config: { status: 'absent' },
    configuredHarnesses: [],
    pendingHarnesses: [],
    ...overrides,
  };
}

describe('runDoctor', () => {
  it('only runs rules whose applies() returns true', () => {
    const ranRuleIds: string[] = [];
    const rules: DoctorRule[] = [
      {
        id: 'always',
        applies: () => true,
        check: () => {
          ranRuleIds.push('always');
          return [];
        },
      },
      {
        id: 'never',
        applies: () => false,
        check: () => {
          ranRuleIds.push('never');
          return [];
        },
      },
    ];
    runDoctor(makeCtx(), rules);
    expect(ranRuleIds).toEqual(['always']);
  });

  it('aggregates findings from every applicable rule', () => {
    const finding: Finding = { ruleId: 'a', severity: 'error', message: 'm', remediation: 'r', forceable: false };
    const rules: DoctorRule[] = [
      { id: 'a', applies: () => true, check: () => [finding] },
      { id: 'b', applies: () => true, check: () => [] },
    ];
    expect(runDoctor(makeCtx(), rules)).toEqual([finding]);
  });
});

describe('hasBlockingErrors', () => {
  it('is true when any finding is an error', () => {
    expect(
      hasBlockingErrors([{ ruleId: 'a', severity: 'error', message: '', remediation: '', forceable: false }])
    ).toBe(true);
  });

  it('is false when all findings are warnings', () => {
    expect(
      hasBlockingErrors([{ ruleId: 'a', severity: 'warning', message: '', remediation: '', forceable: false }])
    ).toBe(false);
  });

  it('is false for an empty list', () => {
    expect(hasBlockingErrors([])).toBe(false);
  });
});

describe('findingsForHarness', () => {
  const canonWide: Finding = { ruleId: 'canon', severity: 'error', message: '', remediation: '', forceable: false };
  const claudeOnly: Finding = {
    ruleId: 'claude',
    severity: 'error',
    message: '',
    remediation: '',
    forceable: false,
    harnessId: 'claude-code',
  };
  const hermesOnly: Finding = {
    ruleId: 'hermes',
    severity: 'error',
    message: '',
    remediation: '',
    forceable: false,
    harnessId: 'hermes',
  };

  it('includes canon-wide findings for every harness', () => {
    expect(findingsForHarness([canonWide, claudeOnly, hermesOnly], 'cursor')).toEqual([canonWide]);
  });

  it('includes a harness-scoped finding only for its own harness', () => {
    expect(findingsForHarness([canonWide, claudeOnly, hermesOnly], 'claude-code')).toEqual([canonWide, claudeOnly]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/doctor/run.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the types**

```typescript
// src/doctor/types.ts
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
}

export interface DoctorRule {
  id: string;
  applies(ctx: DoctorContext): boolean;
  check(ctx: DoctorContext): Finding[];
}
```

- [ ] **Step 4: Implement the runner**

```typescript
// src/doctor/run.ts
import type { DoctorContext, DoctorRule, Finding } from './types';

export function runDoctor(ctx: DoctorContext, rules: DoctorRule[]): Finding[] {
  const findings: Finding[] = [];
  for (const rule of rules) {
    if (rule.applies(ctx)) {
      findings.push(...rule.check(ctx));
    }
  }
  return findings;
}

export function hasBlockingErrors(findings: Finding[]): boolean {
  return findings.some((f) => f.severity === 'error');
}

/** Findings relevant to a specific harness: harness-scoped findings for it, plus every canon-wide finding. */
export function findingsForHarness(findings: Finding[], harnessId: string): Finding[] {
  return findings.filter((f) => f.harnessId === undefined || f.harnessId === harnessId);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/doctor/run.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/doctor/types.ts src/doctor/run.ts src/doctor/run.test.ts
git commit -m "feat: pluggable doctor-rule framework (DoctorRule, runDoctor)"
```

---

