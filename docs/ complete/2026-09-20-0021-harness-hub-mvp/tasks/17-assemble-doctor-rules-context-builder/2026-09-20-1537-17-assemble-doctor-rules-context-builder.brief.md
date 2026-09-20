# Task 17 Brief: Assemble doctor rules + context builder

**Plan:** /Users/matt/Repos/ai/harness-hub/docs/current/2026-09-20-0021-harness-hub-mvp/harness-hub-mvp.plan.md (Task 17, plan lines 2640–2774)

**Repo:** /Users/matt/Repos/ai/harness-hub (branch `initial-harness-hub`) — work in the repo root directly; the current HEAD (0730fca) already contains Tasks 1–16.

**Files:**
- Create: `src/doctor/rules/index.ts`
- Create: `src/doctor/context.ts`
- Test: `src/doctor/rules/index.test.ts`
- Test: `src/doctor/context.test.ts`

**Interfaces:**
- Consumes: every rule from Tasks 10, 11, 12, 14, 15, 16 (`src/doctor/rules/canonPresence.ts`, `configValidity.ts`, `skillShape.ts`, `skillFrontmatter.ts`, `clobberRisk.ts`, `skillMigration.ts`, `trustGate.ts`, `generatedFileDrift.ts` — all already merged); `loadConfig` (Task 5, `src/config.ts`).
- Produces: `ALL_DOCTOR_RULES: DoctorRule[]`, `buildDoctorContext(repoRoot, pendingHarnesses?, homeDir?): DoctorContext`.

## Step 1: Write the failing tests

```typescript
// src/doctor/rules/index.test.ts
import { describe, it, expect } from 'vitest';
import { ALL_DOCTOR_RULES } from './index';

describe('ALL_DOCTOR_RULES', () => {
  it('registers exactly the 8 rule modules backing spec §9, each with a unique id', () => {
    const ids = ALL_DOCTOR_RULES.map((r) => r.id);
    expect(ids).toEqual([
      'canon-presence',
      'config-validity',
      'skill-shape',
      'skill-frontmatter',
      'clobber-risk',
      'skill-migration',
      'trust-gate',
      'generated-file-drift',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

```typescript
// src/doctor/context.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDoctorContext } from './context';

describe('buildDoctorContext', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-ctx-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('defaults to an empty configuredHarnesses/pendingHarnesses when no config exists', () => {
    const ctx = buildDoctorContext(repoRoot);
    expect(ctx.configuredHarnesses).toEqual([]);
    expect(ctx.pendingHarnesses).toEqual([]);
    expect(ctx.homeDir).toBeTruthy();
  });

  it('reads configuredHarnesses from an existing config and accepts explicit pendingHarnesses/homeDir', () => {
    writeFileSync(join(repoRoot, 'harness-hub.yaml'), 'harnesses:\n  - cursor\n');
    const ctx = buildDoctorContext(repoRoot, ['hermes'], '/fake/home');
    expect(ctx.configuredHarnesses).toEqual(['cursor']);
    expect(ctx.pendingHarnesses).toEqual(['hermes']);
    expect(ctx.homeDir).toBe('/fake/home');
  });
});
```

## Step 2: Run tests to verify they fail

Run: `npx vitest run src/doctor/rules/index.test.ts src/doctor/context.test.ts`
Expected: FAIL — modules not found.

## Step 3: Implement `rules/index.ts`

```typescript
// src/doctor/rules/index.ts
import { canonPresenceRule } from './canonPresence';
import { configValidityRule } from './configValidity';
import { skillShapeRule } from './skillShape';
import { skillFrontmatterRule } from './skillFrontmatter';
import { clobberRiskRule } from './clobberRisk';
import { skillMigrationRule } from './skillMigration';
import { trustGateRule } from './trustGate';
import { generatedFileDriftRule } from './generatedFileDrift';
import type { DoctorRule } from '../types';

export const ALL_DOCTOR_RULES: DoctorRule[] = [
  canonPresenceRule,
  configValidityRule,
  skillShapeRule,
  skillFrontmatterRule,
  clobberRiskRule,
  skillMigrationRule,
  trustGateRule,
  generatedFileDriftRule,
];
```

## Step 4: Implement `context.ts`

```typescript
// src/doctor/context.ts
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
```

## Step 5: Run tests to verify they pass

Run: `npx vitest run src/doctor/rules/index.test.ts src/doctor/context.test.ts`
Expected: PASS (3 tests).

Also run the full suite and typecheck before committing:
- `npx vitest run` (all green)
- `npm run typecheck` (clean)

## Step 6: Commit

```bash
git add src/doctor/rules/index.ts src/doctor/rules/index.test.ts src/doctor/context.ts src/doctor/context.test.ts
git commit -m "feat: assemble all 8 doctor rules + doctor context builder"
```

## TDD discipline

Follow RED → GREEN exactly as in previous tasks: write both test files first, run them to see the failure (modules not found), then implement, then run to green. Include the RED and GREEN command outputs in your report.

## Report

When done, write your implementation report to:
/Users/matt/Repos/ai/harness-hub/docs/current/2026-09-20-0021-harness-hub-mvp/tasks/17-assemble-doctor-rules-context-builder/2026-09-20-1540-17-assemble-doctor-rules-context-builder.report.md

The report must include: commits made (hashes), test evidence (RED + GREEN + full suite + typecheck), any deviations from the brief with rationale, and anything you noticed but did not change (deferred notes for the reviewer).
