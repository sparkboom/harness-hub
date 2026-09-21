### Task 6: detection tooling (R3)

**Files:**
- Create: `tools/manifest.ts`, `tools/detect.ts`, `tools/detect.mjs`, `tools/detect.test.ts`

**Interfaces:**
- Consumes: `harness-versions.json` (via a tools-side loader in `tools/manifest.ts`).
- Produces: `DetectRow = { id: string; displayName: string; pin: string; installed: string | null }`; `detectInstalled(): DetectRow[]`; `formatDetect(rows: DetectRow[]): string`; `main(argv: string[]): Promise<number>`.

- [ ] **Step 1: Write the failing test (inject the runner)**

Create `tools/detect.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatDetect } from './detect';
import { detectWith } from './detect';

describe('detect', () => {
  it('reports a missing harness with null installed', () => {
    const rows = detectWith(() => null);
    const cursor = rows.find((r) => r.id === 'cursor')!;
    expect(cursor.installed).toBeNull();
    expect(cursor.pin).toBe('3.x');
  });

  it('reports an installed harness version', () => {
    const rows = detectWith((id) => (id === 'opencode' ? '1.16.2\n' : null));
    expect(rows.find((r) => r.id === 'opencode')!.installed).toBe('1.16.2');
    expect(rows.find((r) => r.id === 'claude-code')!.installed).toBeNull();
  });

  it('formats every harness id and its pin', () => {
    const rows = detectWith(() => null);
    const out = formatDetect(rows);
    expect(out).toContain('claude-code');
    expect(out).toContain('2.1.272');
    expect(out).toContain('NOT INSTALLED');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tools/detect.test.ts`
Expected: FAIL — `tools/detect` does not exist.

- [ ] **Step 3: Implement the tools-side manifest loader**

Create `tools/manifest.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface HarnessManifestEntry {
  displayName: string;
  version: string;
  verifiedDate: string;
  install: { method: string; package?: string; url?: string };
}

const MANIFEST_PATH = join(__dirname, '..', '..', 'harness-versions.json');

export function loadManifest(): Record<string, HarnessManifestEntry> {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Record<string, HarnessManifestEntry>;
}
```

- [ ] **Step 4: Implement detection**

Create `tools/detect.ts`:

```ts
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadManifest } from './manifest';

export interface DetectRow {
  id: string;
  displayName: string;
  pin: string;
  installed: string | null;
}

// Detection targets the harness *binary*, not any same-name editor binary.
// Cursor is the headless `agent` CLI, NOT the `cursor` IDE (spec R3).
const BINARY_CANDIDATES: Record<string, string[]> = {
  'claude-code': ['claude'],
  cursor: ['agent', join(homedir(), '.cursor', 'bin', 'agent')],
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

function resolveBinary(id: string): string | null {
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

export type VersionRunner = (id: string) => string | null;

export function runVersion(id: string): string | null {
  const bin = resolveBinary(id);
  if (!bin) return null;
  const r = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 15000 });
  if (r.error || r.status !== 0) return null;
  const firstLine = (r.stdout ?? '').split('\n')[0].trim();
  return firstLine || null;
}

export function detectWith(runner: VersionRunner = runVersion): DetectRow[] {
  const manifest = loadManifest();
  return Object.keys(manifest)
    .sort()
    .map((id) => ({
      id,
      displayName: manifest[id].displayName,
      pin: manifest[id].version,
      installed: runner(id),
    }));
}

export function detectInstalled(): DetectRow[] {
  return detectWith(runVersion);
}

export function formatDetect(rows: DetectRow[]): string {
  const header = ['ID', 'NAME', 'PIN', 'INSTALLED'];
  const pad = (v: string, w: number) => (v.length >= w ? v : v + ' '.repeat(w - v.length));
  const lines = [header.map((h, i) => pad(h, [14, 18, 14, 40][i])).join('')];
  for (const r of rows) {
    lines.push([pad(r.id, 14), pad(r.displayName, 18), pad(r.pin, 14), r.installed ?? 'NOT INSTALLED'].join(''));
  }
  return lines.join('\n');
}

export async function main(_argv: string[]): Promise<number> {
  console.log(formatDetect(detectInstalled()));
  return 0;
}
```

- [ ] **Step 5: Add the thin entrypoint**

Create `tools/detect.mjs` (identical shape to `generate.mjs`, but `dist/detect.js` and importing `{ main }`).

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tools/detect.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tools/manifest.ts tools/detect.ts tools/detect.mjs tools/detect.test.ts
git commit -m "feat: add harness detection tooling"
```

---

