### Task 6: Installed-version detection in the product surface

**Files:**
- Create: `src/harnessDetect.ts`
- Create: `src/harnessDetect.test.ts`

**Interfaces:**
- Produces:
  - `resolveBinary(id: HarnessId): string | null`
  - `runVersion(id: HarnessId): string | null` (runs `<binary> --version`, first trimmed line)
  - `detectInstalledVersions(): Record<HarnessId, string | null>`

- [ ] **Step 1: Write the failing test (inject the runner)**

```ts
// src/harnessDetect.test.ts
import { describe, it, expect } from 'vitest';
import { detectWith } from './harnessDetect';

describe('harnessDetect', () => {
  it('maps each id through the runner and normalizes output', () => {
    const rows = detectWith((id) => (id === 'codex' ? '0.155.1\n' : null));
    expect(rows.codex).toBe('0.155.1');
    expect(rows['claude-code']).toBeNull();
    expect(rows['cursor-cli']).toBeNull();
  });

  it('covers all eight ids', () => {
    const keys = Object.keys(detectWith(() => null)).sort();
    expect(keys).toEqual([
      'claude-code', 'codex', 'cursor', 'cursor-cli', 'deepseek', 'hermes', 'opencode', 'pi',
    ]);
  });
});
```

- [ ] **Step 2: Implement `harnessDetect.ts`**

```ts
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ALL_HARNESS_IDS, type HarnessId } from './harnesses';

const BINARY_CANDIDATES: Record<HarnessId, string[]> = {
  'claude-code': ['claude'],
  cursor: [], // IDE surface — no reliable headless version probe
  'cursor-cli': ['agent', join(homedir(), '.cursor', 'bin', 'agent'), join(homedir(), '.local', 'bin', 'agent')],
  opencode: ['opencode'],
  codex: ['codex'],
  hermes: ['hermes'],
  pi: ['pi'],
  deepseek: ['dsh'],
};

function which(bin: string): string | null {
  const r = spawnSync('sh', ['-c', `command -v "${bin}"`], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null;
}

export function resolveBinary(id: HarnessId): string | null {
  for (const cand of BINARY_CANDIDATES[id] ?? []) {
    if (cand.includes(homedir())) {
      if (existsSync(cand)) return cand;
    } else {
      const found = which(cand);
      if (found) return found;
    }
  }
  return null;
}

export type VersionRunner = (id: HarnessId) => string | null;

export function runVersion(id: HarnessId): string | null {
  const bin = resolveBinary(id);
  if (!bin) return null;
  const r = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 15000 });
  if (r.error || r.status !== 0) return null;
  const first = (r.stdout ?? '').split('\n')[0].trim();
  return first || null;
}

export function detectWith(runner: VersionRunner): Record<HarnessId, string | null> {
  return Object.fromEntries(ALL_HARNESS_IDS.map((id) => [id, runner(id)])) as Record<HarnessId, string | null>;
}

export function detectInstalledVersions(): Record<HarnessId, string | null> {
  return detectWith(runVersion);
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run src/harnessDetect.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/harnessDetect.ts src/harnessDetect.test.ts
git commit -m "feat: add installed-version detection to the product surface"
```

---

