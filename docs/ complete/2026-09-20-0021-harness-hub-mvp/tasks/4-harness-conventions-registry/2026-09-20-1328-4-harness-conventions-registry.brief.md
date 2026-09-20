## Task 4: Harness conventions registry

**Files:**
- Create: `src/registry/types.ts`
- Create: `src/registry/data.ts`
- Create: `src/registry/index.ts`
- Test: `src/registry/index.test.ts`

**Interfaces:**
- Consumes: `HarnessId`, `ALL_HARNESS_IDS` (Task 3).
- Produces: `HarnessEntry`, `AgentsDocConvention`, `SkillsConvention`, `TrustGateConvention` (types), `getHarnessEntry(id: HarnessId): HarnessEntry`, `HARNESS_REGISTRY`.

This is the declarative, internal per-harness conventions data described in `harness-doctor-architecture.insight.md` — every later module that needs to know "does this harness symlink, migrate, or trust-gate" reads it from here instead of hardcoding a harness id check.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/registry/index.test.ts
import { describe, it, expect } from 'vitest';
import { ALL_HARNESS_IDS } from '../harnesses';
import { getHarnessEntry } from './index';

describe('harness registry', () => {
  it('has a fully-populated entry for every recognized harness id', () => {
    for (const id of ALL_HARNESS_IDS) {
      const entry = getHarnessEntry(id);
      expect(entry.id).toBe(id);
      expect(entry.displayName).toBeTruthy();
      expect(entry.verifiedVersion).toBeTruthy();
      expect(entry.verifiedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('marks claude-code as the only symlink-based AGENTS.md wiring', () => {
    const symlinked = ALL_HARNESS_IDS.filter((id) => getHarnessEntry(id).agentsDoc.mode === 'symlink');
    expect(symlinked).toEqual(['claude-code']);
  });

  it('marks claude-code as the only migrate-symlink skills wiring', () => {
    const migrated = ALL_HARNESS_IDS.filter((id) => getHarnessEntry(id).skills.mode === 'migrate-symlink');
    expect(migrated).toEqual(['claude-code']);
  });

  it('marks hermes as the only harness with a trust gate', () => {
    const gated = ALL_HARNESS_IDS.filter((id) => getHarnessEntry(id).skills.trustGate !== undefined);
    expect(gated).toEqual(['hermes']);
  });

  it("hermes's trust gate has a runnable trust command and a dotted config key path", () => {
    const trustGate = getHarnessEntry('hermes').skills.trustGate;
    expect(trustGate?.trustCommand).toBe('hermes skills trust');
    expect(trustGate?.trustedDirsKeyPath).toEqual(['skills', 'trusted_project_dirs']);
    expect(trustGate?.configPathFromHome).toBe('.hermes/config.yaml');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/registry/index.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Define the registry types**

```typescript
// src/registry/types.ts
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
```

- [ ] **Step 4: Populate the registry data**

```typescript
// src/registry/data.ts
import type { HarnessId } from '../harnesses';
import type { HarnessEntry } from './types';

export const HARNESS_REGISTRY: Record<HarnessId, HarnessEntry> = {
  'claude-code': {
    id: 'claude-code',
    displayName: 'Claude Code',
    verifiedVersion: 'unpinned', // opaque native binary — not version-pinned in harness-versions.insight.md
    verifiedDate: '2026-09-20',
    agentsDoc: { mode: 'symlink', symlinkPath: 'CLAUDE.md' },
    skills: { mode: 'migrate-symlink', symlinkPath: '.claude/skills' },
  },
  cursor: {
    id: 'cursor',
    displayName: 'Cursor',
    verifiedVersion: '3.x',
    verifiedDate: '2026-09-10',
    agentsDoc: { mode: 'native' },
    skills: { mode: 'native' },
  },
  opencode: {
    id: 'opencode',
    displayName: 'OpenCode',
    verifiedVersion: '1.18.31',
    verifiedDate: '2026-09-14',
    agentsDoc: { mode: 'native' },
    skills: { mode: 'native' },
  },
  codex: {
    id: 'codex',
    displayName: 'Codex',
    verifiedVersion: '0.153.2',
    verifiedDate: '2026-09-03',
    agentsDoc: { mode: 'native' },
    skills: { mode: 'native' },
  },
  hermes: {
    id: 'hermes',
    displayName: 'Hermes',
    verifiedVersion: '0.21.2',
    verifiedDate: '2026-09-11',
    agentsDoc: { mode: 'native' },
    skills: {
      mode: 'native',
      trustGate: {
        configPathFromHome: '.hermes/config.yaml',
        trustedDirsKeyPath: ['skills', 'trusted_project_dirs'],
        trustCommand: 'hermes skills trust',
      },
    },
  },
  pi: {
    id: 'pi',
    displayName: 'Pi',
    verifiedVersion: '0.85.0',
    verifiedDate: '2026-09-04',
    agentsDoc: { mode: 'native' },
    skills: { mode: 'native' },
  },
  deepseek: {
    id: 'deepseek',
    displayName: 'DeepSeek Harness',
    verifiedVersion: '0.1.5-rc.1',
    verifiedDate: '2026-09-10',
    agentsDoc: { mode: 'native' },
    skills: { mode: 'native' },
  },
};
```

- [ ] **Step 5: Implement the accessor**

```typescript
// src/registry/index.ts
import type { HarnessId } from '../harnesses';
import { HARNESS_REGISTRY } from './data';
import type { HarnessEntry } from './types';

export function getHarnessEntry(id: HarnessId): HarnessEntry {
  return HARNESS_REGISTRY[id];
}

export { HARNESS_REGISTRY };
export type { HarnessEntry, AgentsDocConvention, SkillsConvention, TrustGateConvention } from './types';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/registry/index.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/registry
git commit -m "feat: declarative harness-conventions registry"
```

---

