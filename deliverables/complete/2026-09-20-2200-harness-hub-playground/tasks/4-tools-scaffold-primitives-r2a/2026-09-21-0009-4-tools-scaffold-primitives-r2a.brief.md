### Task 4: tools scaffold + primitives (R2a)

**Files:**
- Create: `tools/tsconfig.json`, `tools/primitives.ts`, `tools/fs.ts`, `tools/primitives.test.ts`
- Modify: `package.json` (`build:tools` script), `vitest.config.ts` (include tools tests)

**Interfaces:**
- Produces: `Asset = { path: string; content: string }`; `agentDoc(path, content): Asset`; `skill(opts): Asset`; `raw(path, content): Asset`; `writeAssets(target, assets): void`; `resetTarget(target): void`.

- [ ] **Step 1: Write the failing tests**

Create `tools/primitives.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agentDoc, skill, raw, writeAssets, resetTarget } from './primitives';

describe('primitives', () => {
  let target: string;
  beforeEach(() => { target = mkdtempSync(join(tmpdir(), 'hh-tools-')); });
  afterEach(() => { rmSync(target, { recursive: true, force: true }); });

  it('agentDoc returns a root-level asset', () => {
    expect(agentDoc('AGENTS.md', '# Agents\n')).toEqual({ path: 'AGENTS.md', content: '# Agents\n' });
  });

  it('skill serializes frontmatter and body at <location>/<name>/SKILL.md', () => {
    const asset = skill({ name: 'writing-tests', location: '.agents/skills', frontmatter: { name: 'writing-tests', description: 'Write tests.' }, body: 'Body\n' });
    expect(asset.path).toBe('.agents/skills/writing-tests/SKILL.md');
    expect(asset.content).toContain('name: writing-tests');
    expect(asset.content).toContain('Body');
  });

  it('writeAssets writes files and creates parent dirs', () => {
    writeAssets(target, [raw('a/b/c.md', 'x')]);
    expect(readFileSync(join(target, 'a', 'b', 'c.md'), 'utf8')).toBe('x');
  });

  it('resetTarget clears everything except .git', () => {
    writeAssets(target, [raw('keep.md', 'x'), raw('.git/HEAD', 'ref: refs/heads/main')]);
    resetTarget(target);
    expect(existsSync(join(target, 'keep.md'))).toBe(false);
    expect(existsSync(join(target, '.git', 'HEAD'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tools/primitives.test.ts`
Expected: FAIL — `tools/primitives` does not exist.

- [ ] **Step 3: Create the tools tsconfig and build script**

Create `tools/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "types": ["node"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": false,
    "sourceMap": false
  },
  "include": ["**/*.ts"],
  "exclude": ["**/*.test.ts", "dist", "node_modules"]
}
```

Modify `package.json` scripts to add:

```json
"build:tools": "tsc -p tools/tsconfig.json"
```

Modify `vitest.config.ts` include:

```ts
include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
```

- [ ] **Step 4: Implement primitives**

Create `tools/primitives.ts`:

```ts
import { stringify } from 'yaml';
import { join } from 'node:path';

export interface Asset {
  path: string;
  content: string;
}

export function agentDoc(path: string, content: string): Asset {
  return { path, content };
}

export function skill(opts: {
  name: string;
  location: string;
  frontmatter: Record<string, unknown>;
  body?: string;
}): Asset {
  const fm = Object.keys(opts.frontmatter).length > 0
    ? `---\n${stringify(opts.frontmatter)}---\n`
    : '';
  const body = opts.body ?? `Placeholder body for skill "${opts.name}".\n`;
  return { path: join(opts.location, opts.name, 'SKILL.md'), content: fm + body };
}

export function raw(path: string, content: string): Asset {
  return { path, content };
}
```

Create `tools/fs.ts`:

```ts
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Asset } from './primitives';

export function writeAssets(target: string, assets: Asset[]): void {
  for (const a of assets) {
    const full = join(target, a.path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, a.content, 'utf8');
  }
}

/** Removes everything under `target` except `.git`, preserving a consumer repo's nested git. */
export function resetTarget(target: string): void {
  if (!existsSync(target)) {
    mkdirSync(target, { recursive: true });
    return;
  }
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    rmSync(join(target, entry.name), { recursive: true, force: true });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tools/primitives.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools package.json vitest.config.ts .gitignore
git commit -m "feat: add tools scaffold with asset primitives"
```

---

