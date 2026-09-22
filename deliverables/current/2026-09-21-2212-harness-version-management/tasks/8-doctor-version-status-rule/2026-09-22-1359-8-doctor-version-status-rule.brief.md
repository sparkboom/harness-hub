### Task 8: The doctor version-status rule

**Files:**
- Create: `src/doctor/rules/versionStatus.ts`
- Create: `src/doctor/rules/versionStatus.test.ts`
- Modify: `src/doctor/rules/index.ts`
- Modify: `src/doctor/context.ts`
- Modify: `src/commands/doctor.ts`

**Interfaces:**
- Consumes: `resolveHarnessStatus` (Task 5), `detectInstalledVersions` (Task 6), `DoctorContext`.
- Produces: a `version-status` rule that warns for each **configured/pending** harness whose installed version is `unverified` or `unrecognized`; non-zero only on `error` severity (this rule emits warnings only — status never blocks).

- [ ] **Step 1: Extend `DoctorContext` with installed versions**

```ts
// src/doctor/context.ts
export interface DoctorContext {
  // ...existing fields...
  installedVersions: Record<HarnessId, string | null>;
}

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
```

(Default is an empty map so the pure `doctor` unit tests stay fast; real detection is wired in `commands/doctor.ts` below.)

- [ ] **Step 2: Write the failing test**

```ts
// src/doctor/rules/versionStatus.test.ts
import { describe, it, expect } from 'vitest';
import type { HarnessId } from '../../harnesses';
import type { DoctorContext } from '../types';
import { versionStatusRule } from './versionStatus';

function ctx(configured: HarnessId[], installed: Record<HarnessId, string | null>): DoctorContext {
  return {
    repoRoot: '/tmp/repo',
    homeDir: '/tmp/home',
    config: { status: 'ok', format: 'yaml', path: 'x', harnesses: configured, unknownIds: [] },
    configuredHarnesses: configured,
    pendingHarnesses: [],
    installedVersions: installed,
  };
}

describe('version-status rule', () => {
  it('warns when an installed version falls in an unverified range', () => {
    const installed = { codex: '0.155.1' } as Record<HarnessId, string | null>;
    const findings = versionStatusRule.check(ctx(['codex'], installed));
    expect(findings.some((f) => f.ruleId === 'version-unverified' && f.harnessId === 'codex')).toBe(true);
  });

  it('warns when an installed version matches no range', () => {
    const installed = { codex: '9.9.9' } as Record<HarnessId, string | null>;
    const findings = versionStatusRule.check(ctx(['codex'], installed));
    expect(findings.some((f) => f.ruleId === 'version-unrecognized')).toBe(true);
  });

  it('is silent for a verified version', () => {
    const installed = { codex: '0.150.0' } as Record<HarnessId, string | null>;
    expect(versionStatusRule.check(ctx(['codex'], installed))).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Implement `versionStatus.ts`**

```ts
import { ALL_HARNESS_IDS, type HarnessId } from '../../harnesses';
import { resolveHarnessStatus } from '../../registry';
import type { DoctorContext, DoctorRule, Finding } from '../types';

function isRelevant(ctx: DoctorContext, id: HarnessId): boolean {
  return ctx.configuredHarnesses.includes(id) || ctx.pendingHarnesses.includes(id);
}

export const versionStatusRule: DoctorRule = {
  id: 'version-status',
  applies: (ctx) => ALL_HARNESS_IDS.some((id) => isRelevant(ctx, id)),
  check: (ctx) => {
    const findings: Finding[] = [];
    for (const id of ALL_HARNESS_IDS) {
      if (!isRelevant(ctx, id)) continue;
      const installed = ctx.installedVersions[id];
      const status = resolveHarnessStatus(id, installed).status;
      if (status === 'unrecognized') {
        findings.push({
          ruleId: 'version-unrecognized',
          severity: 'warning',
          message: `${id}: installed version ${installed ?? 'unknown'} matches no verified range.`,
          remediation: 'Run `reconcile --check`, then review the version (see scenarios.md).',
          harnessId: id,
          forceable: false,
        });
      } else if (status === 'unverified') {
        findings.push({
          ruleId: 'version-unverified',
          severity: 'warning',
          message: `${id}: installed version ${installed} is in an unverified range (upstream moved).`,
          remediation: 'Run `reconcile --check`, then review the version (see scenarios.md).',
          harnessId: id,
          forceable: false,
        });
      }
    }
    return findings;
  },
};
```

- [ ] **Step 4: Register the rule**

```ts
// src/doctor/rules/index.ts — add import + append to ALL_DOCTOR_RULES
import { versionStatusRule } from './versionStatus';
export const ALL_DOCTOR_RULES: DoctorRule[] = [
  // ...existing...
  generatedFileDriftRule,
  versionStatusRule,
];
```

- [ ] **Step 5: Wire real detection into the doctor command**

```ts
// src/commands/doctor.ts — pass installed versions explicitly
import { detectInstalledVersions } from '../harnessDetect';

export function runDoctorCommand(repoRoot: string, homeDir?: string): DoctorCommandResult {
  const ctx = buildDoctorContext(repoRoot, [], homeDir, detectInstalledVersions());
  const findings = runDoctor(ctx, ALL_DOCTOR_RULES);
  const exitCode = findings.some((f) => f.severity === 'error') ? 1 : 0;
  return { findings, output: formatFindings(findings), exitCode };
}
```

(The `runDoctorCommand` change is the only `commands/doctor.ts` edit; `buildDoctorContext`'s 4th arg is otherwise optional and defaults to empty for tests.)

- [ ] **Step 5: Run the rule tests and the doctor command tests**

Run: `npx vitest run src/doctor/rules/versionStatus.test.ts src/commands/doctor.test.ts`
Expected: PASS. (`doctor.test.ts`'s "minimal valid repo" still passes because no harnesses are configured, so the rule produces nothing.)

- [ ] **Step 6: Commit**

```bash
git add src/doctor/rules/versionStatus.ts src/doctor/rules/versionStatus.test.ts src/doctor/rules/index.ts src/doctor/context.ts src/commands/doctor.ts
git commit -m "feat(doctor): warn on unverified/unrecognized installed versions"
```

---

