## Task 10: Canon-presence + config-validity rules

**Files:**
- Create: `src/doctor/rules/canonPresence.ts`
- Create: `src/doctor/rules/configValidity.ts`
- Test: `src/doctor/rules/canonPresence.test.ts`
- Test: `src/doctor/rules/configValidity.test.ts`

**Interfaces:**
- Consumes: `hasAgentsMd` (Task 6), `DoctorRule`/`Finding` (Task 9), `ConfigLoadResult` (Task 5).
- Produces: `canonPresenceRule: DoctorRule`, `configValidityRule: DoctorRule`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/doctor/rules/canonPresence.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonPresenceRule } from './canonPresence';
import type { DoctorContext } from '../types';

function makeCtx(repoRoot: string): DoctorContext {
  return { repoRoot, homeDir: '/home/user', config: { status: 'absent' }, configuredHarnesses: [], pendingHarnesses: [] };
}

describe('canonPresenceRule', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-canonpresence-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('reports an error when AGENTS.md is missing', () => {
    const findings = canonPresenceRule.check(makeCtx(repoRoot));
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('error');
  });

  it('reports nothing when AGENTS.md exists', () => {
    writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
    expect(canonPresenceRule.check(makeCtx(repoRoot))).toEqual([]);
  });
});
```

```typescript
// src/doctor/rules/configValidity.test.ts
import { describe, it, expect } from 'vitest';
import { configValidityRule } from './configValidity';
import type { DoctorContext } from '../types';

function makeCtx(config: DoctorContext['config']): DoctorContext {
  return { repoRoot: '/repo', homeDir: '/home/user', config, configuredHarnesses: [], pendingHarnesses: [] };
}

describe('configValidityRule', () => {
  it('passes when config is absent', () => {
    expect(configValidityRule.check(makeCtx({ status: 'absent' }))).toEqual([]);
  });

  it('passes for a valid config with no unknown ids', () => {
    const ctx = makeCtx({ status: 'ok', format: 'yaml', path: '/repo/harness-hub.yaml', harnesses: ['cursor'], unknownIds: [] });
    expect(configValidityRule.check(ctx)).toEqual([]);
  });

  it('flags unknown harness ids in an otherwise-valid config', () => {
    const ctx = makeCtx({ status: 'ok', format: 'yaml', path: '/repo/harness-hub.yaml', harnesses: [], unknownIds: ['bogus'] });
    expect(configValidityRule.check(ctx)[0].severity).toBe('error');
  });

  it('flags ambiguous config (both files present)', () => {
    const ctx = makeCtx({ status: 'ambiguous', yamlPath: '/repo/harness-hub.yaml', jsonPath: '/repo/harness-hub.json' });
    expect(configValidityRule.check(ctx)[0].severity).toBe('error');
  });

  it('flags a parse error', () => {
    const ctx = makeCtx({ status: 'parse-error', format: 'yaml', path: '/repo/harness-hub.yaml', error: 'bad yaml' });
    expect(configValidityRule.check(ctx)[0].message).toContain('bad yaml');
  });

  it('flags an invalid shape', () => {
    const ctx = makeCtx({
      status: 'invalid-shape',
      format: 'yaml',
      path: '/repo/harness-hub.yaml',
      reason: '"harnesses" must be an array',
    });
    expect(configValidityRule.check(ctx)[0].severity).toBe('error');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/doctor/rules/canonPresence.test.ts src/doctor/rules/configValidity.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `canonPresenceRule`**

```typescript
// src/doctor/rules/canonPresence.ts
import { hasAgentsMd } from '../../canon';
import type { DoctorRule } from '../types';

export const canonPresenceRule: DoctorRule = {
  id: 'canon-presence',
  applies: () => true,
  check: (ctx) => {
    if (hasAgentsMd(ctx.repoRoot)) return [];
    return [
      {
        ruleId: 'canon-presence',
        severity: 'error',
        message: 'AGENTS.md is missing at the repo root.',
        remediation: 'Create AGENTS.md at the repo root — harness-hub never scaffolds it for you.',
        forceable: false,
      },
    ];
  },
};
```

- [ ] **Step 4: Implement `configValidityRule`**

```typescript
// src/doctor/rules/configValidity.ts
import type { DoctorRule } from '../types';

export const configValidityRule: DoctorRule = {
  id: 'config-validity',
  applies: () => true,
  check: (ctx) => {
    const { config } = ctx;
    switch (config.status) {
      case 'absent':
        return [];
      case 'ok':
        if (config.unknownIds.length === 0) return [];
        return [
          {
            ruleId: 'config-validity',
            severity: 'error',
            message: `${config.path} lists unrecognized harness id(s): ${config.unknownIds.join(', ')}`,
            remediation: 'Remove or fix the unrecognized id(s) in the "harnesses" list.',
            forceable: false,
          },
        ];
      case 'ambiguous':
        return [
          {
            ruleId: 'config-validity',
            severity: 'error',
            message: `Both ${config.yamlPath} and ${config.jsonPath} exist.`,
            remediation: 'Keep exactly one of harness-hub.yaml / harness-hub.json and delete the other.',
            forceable: false,
          },
        ];
      case 'parse-error':
        return [
          {
            ruleId: 'config-validity',
            severity: 'error',
            message: `${config.path} could not be parsed: ${config.error}`,
            remediation: `Fix the syntax error in ${config.path}.`,
            forceable: false,
          },
        ];
      case 'invalid-shape':
        return [
          {
            ruleId: 'config-validity',
            severity: 'error',
            message: `${config.path} is invalid: ${config.reason}`,
            remediation: `Fix ${config.path} so it has a top-level "harnesses" array.`,
            forceable: false,
          },
        ];
    }
  },
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/doctor/rules/canonPresence.test.ts src/doctor/rules/configValidity.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add src/doctor/rules/canonPresence.ts src/doctor/rules/canonPresence.test.ts src/doctor/rules/configValidity.ts src/doctor/rules/configValidity.test.ts
git commit -m "feat: canon-presence and config-validity doctor rules"
```

---

