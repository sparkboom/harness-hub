### Task 1: `harness-versions.json` manifest + registry derivation

**Files:**
- Create: `harness-versions.json`
- Create: `src/registry/versions.ts`
- Modify: `src/registry/data.ts`
- Modify: `package.json` (`files` array)
- Modify: `.gitignore` (add `tools/dist/` — see Task 4; can add here)
- Test: `src/registry/versions.test.ts`

**Interfaces:**
- Produces: `loadVersionsManifest(): Record<HarnessId, HarnessVersionEntry>` where `HarnessVersionEntry = { displayName: string; version: string; verifiedDate: string; install: { method: 'npm' | 'fhs-wrapper'; package?: string; url?: string } }`. `HARNESS_REGISTRY` entries now derive `displayName`/`verifiedVersion`/`verifiedDate` from this.

- [ ] **Step 1: Write the failing test**

Create `src/registry/versions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ALL_HARNESS_IDS } from '../harnesses';
import { loadVersionsManifest } from './versions';
import { getHarnessEntry } from './index';

describe('harness versions manifest', () => {
  it('has an entry for every recognized harness id', () => {
    const manifest = loadVersionsManifest();
    expect(Object.keys(manifest).sort()).toEqual([...ALL_HARNESS_IDS].sort());
  });

  it('registers each harness version as a non-empty string', () => {
    const manifest = loadVersionsManifest();
    for (const id of ALL_HARNESS_IDS) {
      expect(manifest[id].version).toBeTruthy();
      expect(manifest[id].verifiedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('derives the registry verifiedVersion from the manifest (no drift)', () => {
    const manifest = loadVersionsManifest();
    for (const id of ALL_HARNESS_IDS) {
      expect(getHarnessEntry(id).verifiedVersion).toBe(manifest[id].version);
      expect(getHarnessEntry(id).verifiedDate).toBe(manifest[id].verifiedDate);
    }
  });

  it('pins claude-code to the researched 2.1.272 (not "unpinned")', () => {
    expect(loadVersionsManifest()['claude-code'].version).toBe('2.1.272');
  });

  it('marks cursor install as fhs-wrapper and every other harness as npm', () => {
    const m = loadVersionsManifest();
    expect(m.cursor.install.method).toBe('fhs-wrapper');
    for (const id of ALL_HARNESS_IDS) {
      if (id === 'cursor') continue;
      expect(m[id].install.method).toBe('npm');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/registry/versions.test.ts`
Expected: FAIL — `src/registry/versions.ts` does not exist (`Cannot find module`).

- [ ] **Step 3: Write the manifest**

Create `harness-versions.json` at the repo root:

```json
{
  "claude-code": {
    "displayName": "Claude Code",
    "version": "2.1.272",
    "verifiedDate": "2026-09-15",
    "install": { "method": "npm", "package": "@anthropic-ai/claude-code" }
  },
  "cursor": {
    "displayName": "Cursor",
    "version": "3.x",
    "verifiedDate": "2026-09-10",
    "install": { "method": "fhs-wrapper", "url": "https://cursor.com/install" }
  },
  "opencode": {
    "displayName": "OpenCode",
    "version": "1.18.31",
    "verifiedDate": "2026-09-14",
    "install": { "method": "npm", "package": "opencode-ai" }
  },
  "codex": {
    "displayName": "Codex",
    "version": "0.153.2",
    "verifiedDate": "2026-09-03",
    "install": { "method": "npm", "package": "@openai/codex" }
  },
  "hermes": {
    "displayName": "Hermes",
    "version": "0.21.2",
    "verifiedDate": "2026-09-11",
    "install": { "method": "npm", "package": "hermes-agent" }
  },
  "pi": {
    "displayName": "Pi",
    "version": "0.85.0",
    "verifiedDate": "2026-09-04",
    "install": { "method": "npm", "package": "@mariozechner/pi-coding-agent" }
  },
  "deepseek": {
    "displayName": "DeepSeek Harness",
    "version": "0.1.5-rc.1",
    "verifiedDate": "2026-09-10",
    "install": { "method": "npm", "package": "@deepseek-ai/dsh" }
  }
}
```

- [ ] **Step 4: Write the loader**

Create `src/registry/versions.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_HARNESS_IDS, type HarnessId } from '../harnesses';

export interface HarnessInstallManifest {
  method: 'npm' | 'fhs-wrapper';
  package?: string;
  url?: string;
}

export interface HarnessVersionEntry {
  displayName: string;
  version: string;
  verifiedDate: string;
  install: HarnessInstallManifest;
}

// Compiled to dist/registry/versions.js, so __dirname is dist/registry and the
// manifest is two levels up at the repo root (and ships in the npm package via
// the "files" array).
const MANIFEST_PATH = join(__dirname, '..', '..', 'harness-versions.json');

export function loadVersionsManifest(): Record<HarnessId, HarnessVersionEntry> {
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Record<string, HarnessVersionEntry>;
  for (const id of ALL_HARNESS_IDS) {
    if (!(id in raw)) throw new Error(`harness-versions.json is missing an entry for "${id}"`);
  }
  return raw as Record<HarnessId, HarnessVersionEntry>;
}
```

- [ ] **Step 5: Derive registry versions from the manifest**

Modify `src/registry/data.ts`: add `import { loadVersionsManifest } from './versions';` at the top, then replace each `displayName`/`verifiedVersion`/`verifiedDate` literal with the manifest values. Keep every `agentsDoc`/`skills` convention block unchanged. The top of the file becomes:

```ts
import type { HarnessId } from '../harnesses';
import type { HarnessEntry } from './types';
import { loadVersionsManifest } from './versions';

const versions = loadVersionsManifest();

export const HARNESS_REGISTRY: Record<HarnessId, HarnessEntry> = {
  'claude-code': {
    id: 'claude-code',
    displayName: versions['claude-code'].displayName,
    verifiedVersion: versions['claude-code'].version,
    verifiedDate: versions['claude-code'].verifiedDate,
    agentsDoc: { mode: 'symlink', symlinkPath: 'CLAUDE.md' },
    skills: { mode: 'migrate-symlink', symlinkPath: '.claude/skills' },
  },
  // … repeat for the other six, each pulling displayName/verifiedVersion/
  // verifiedDate from `versions`, keeping their existing agentsDoc/skills
  // blocks byte-for-byte unchanged.
};
```

Note: this deliberately changes `claude-code.verifiedVersion` from `'unpinned'` to `'2.1.272'` (spec Background; the old value was stale against `harness-versions.insight.md`).

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/registry/versions.test.ts src/registry/index.test.ts`
Expected: PASS (the existing `index.test.ts` only asserts `verifiedVersion` is truthy and `verifiedDate` matches `YYYY-MM-DD`, both still true).

- [ ] **Step 7: Ship the manifest and ignore tool build output**

Modify `package.json` `files` array:

```json
"files": ["dist", "harness-versions.json"]
```

Modify `.gitignore`, appending one line:

```
tools/dist/
```

- [ ] **Step 8: Commit**

```bash
git add harness-versions.json src/registry/versions.ts src/registry/data.ts src/registry/versions.test.ts package.json .gitignore
git commit -m "feat: add harness-versions.json manifest as single source of truth"
```

---

