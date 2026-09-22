### Task 5: `env` manager core functions (R3)

**Files:**
- Create: `test/tools/env.ts` (core only — no CLI `main` yet; that is Task 6)
- Create: `test/tools/env.test.ts`

**Interfaces:**
- Consumes: `generateScenario` from `./generate` (for `generateIntoEnv`).
- Produces (imported by Task 6): `DEFAULT_ENV_NAME`, `resolveTestDir(fromDir)`, `envDir(root)`, `templateDir(root)`, `isValidName(name)`, `resolveEnvPath(root, name)`, `renderTemplate(root, name)`, `createEnv(root, name, opts?)`, `linkHarnessHub(root)`, `listEnvs(root)`, `rmEnv(root, name)`, `generateIntoEnv(root, name, scenario)`, `warnIfUnpinned(stderr?)`.

> **Location resolution note:** the spec says the manager resolves its location via `import.meta.url` (cwd-independently). Because the tools compile to CommonJS, the core uses `__dirname` (the CJS equivalent); the ESM `.mjs` shim (Task 6) uses `import.meta.url`. Both are cwd-independent; `process.cwd()` is never used for location resolution.

- [ ] **Step 1: Write the failing tests**

Create `test/tools/env.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isValidName, resolveEnvPath, resolveTestDir, renderTemplate,
  createEnv, rmEnv, listEnvs, generateIntoEnv,
} from './env';

const TPL_PKG = JSON.stringify({
  name: 'harness-hub-env-playground', version: '0.0.0', private: true,
  scripts: { shell: 'nix develop --flake ../../' },
}, null, 2) + '\n';
const TPL_AGENTS = '# Agents\n\nMinimal consumer-repo agent doc for harness-hub testing.\n';

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'hh-env-root-'));
  mkdirSync(join(root, 'tools'), { recursive: true });
  mkdirSync(join(root, 'template'), { recursive: true });
  writeFileSync(join(root, 'flake.nix'), '{}\n');
  writeFileSync(join(root, 'template', 'package.json'), TPL_PKG);
  writeFileSync(join(root, 'template', 'AGENTS.md'), TPL_AGENTS);
  return root;
}

describe('env manager', () => {
  let root: string;
  beforeEach(() => { root = makeRoot(); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('resolves the test dir from nested tool paths', () => {
    expect(resolveTestDir(join(root, 'tools'))).toBe(root);
    mkdirSync(join(root, 'tools', 'dist'), { recursive: true });
    expect(resolveTestDir(join(root, 'tools', 'dist'))).toBe(root);
  });

  it('rejects invalid env names', () => {
    for (const bad of ['', '.', '..', 'a/b', 'a\\b']) expect(isValidName(bad)).toBe(false);
    for (const good of ['playground', 'foo', 'a-b', 'a_b', 'a1']) expect(isValidName(good)).toBe(true);
  });

  it('templates the package.json name per env', () => {
    const rendered = renderTemplate(root, 'foo');
    expect(JSON.parse(rendered.packageJson).name).toBe('harness-hub-env-foo');
    expect(rendered.agentsMd).toBe(TPL_AGENTS);
  });

  it('createEnv constructs an env with nested git and templated files', () => {
    const envPath = createEnv(root, 'foo', { link: false });
    expect(existsSync(join(envPath, '.git'))).toBe(true);
    expect(JSON.parse(readFileSync(join(envPath, 'package.json'), 'utf8')).name).toBe('harness-hub-env-foo');
    expect(readFileSync(join(envPath, 'AGENTS.md'), 'utf8')).toBe(TPL_AGENTS);
  });

  it('createEnv is idempotent (re-running keeps the nested git)', () => {
    const envPath = createEnv(root, 'foo', { link: false });
    createEnv(root, 'foo', { link: false });
    expect(existsSync(join(envPath, '.git'))).toBe(true);
    expect(JSON.parse(readFileSync(join(envPath, 'package.json'), 'utf8')).name).toBe('harness-hub-env-foo');
  });

  it('lists, then removes, created envs', () => {
    createEnv(root, 'foo', { link: false });
    createEnv(root, 'bar', { link: false });
    expect(listEnvs(root)).toEqual(['bar', 'foo']);
    rmEnv(root, 'foo');
    expect(listEnvs(root)).toEqual(['bar']);
  });

  it('rmEnv refuses an unknown env', () => {
    expect(() => rmEnv(root, 'nope')).toThrow(/Unknown env/);
  });

  it('generateIntoEnv renders a scenario into the env', () => {
    createEnv(root, 'foo', { link: false });
    generateIntoEnv(root, 'foo', 'baseline');
    expect(existsSync(join(root, 'env', 'foo', 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(root, 'env', 'foo', '.agents', 'skills', 'writing-tests', 'SKILL.md'))).toBe(true);
  });
});

```

- [ ] **Step 2: Run to confirm they fail**

Run: `npx vitest run test/tools/env.test.ts`
Expected: FAIL — `Cannot find module './env'`.

- [ ] **Step 3: Write the core implementation**

Create `test/tools/env.ts` (core only):

```ts
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { generateScenario } from './generate';

export const DEFAULT_ENV_NAME = 'playground';

// Walk up from a tool path (test/tools or test/tools/dist) to the `test/`
// folder, identified by the presence of flake.nix + tools/ + template/.
export function resolveTestDir(fromDir: string): string {
  let dir = fromDir;
  for (let i = 0; i < 4; i++) {
    if (
      existsSync(join(dir, 'flake.nix')) &&
      existsSync(join(dir, 'tools')) &&
      existsSync(join(dir, 'template'))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('test/ folder not found (expected flake.nix + tools/ + template/)');
}

export function envDir(root: string): string {
  return join(root, 'env');
}

export function templateDir(root: string): string {
  return join(root, 'template');
}

// A single non-dot, non-`..` path segment (defense against escaping test/env/).
export function isValidName(name: string): boolean {
  return name.length > 0 && name !== '.' && name !== '..' && !name.includes('/') && !name.includes('\\');
}

export function resolveEnvPath(root: string, name: string): string {
  if (!isValidName(name)) {
    throw new Error(`Invalid env name "${name}": must be a single path segment (no '/', not '.' or '..').`);
  }
  return join(root, 'env', name);
}

export interface TemplateRender {
  packageJson: string;
  agentsMd: string;
}

export function renderTemplate(root: string, name: string): TemplateRender {
  const pkg = JSON.parse(readFileSync(join(templateDir(root), 'package.json'), 'utf8')) as { name: string };
  pkg.name = `harness-hub-env-${name}`;
  return {
    packageJson: JSON.stringify(pkg, null, 2) + '\n',
    agentsMd: readFileSync(join(templateDir(root), 'AGENTS.md'), 'utf8'),
  };
}

export interface CreateOptions {
  link?: boolean;
  gitInit?: boolean;
}

export function createEnv(root: string, name: string, opts: CreateOptions = {}): string {
  const { link = true, gitInit = true } = opts;
  const envPath = resolveEnvPath(root, name);
  mkdirSync(envPath, { recursive: true });

  if (gitInit && !existsSync(join(envPath, '.git'))) {
    const r = spawnSync('git', ['init'], { cwd: envPath, encoding: 'utf8' });
    if (r.error || r.status !== 0) {
      throw new Error(`git init failed in ${envPath}: ${r.error?.message ?? r.stderr}`);
    }
  }

  const { packageJson, agentsMd } = renderTemplate(root, name);
  writeFileSync(join(envPath, 'package.json'), packageJson, 'utf8');
  writeFileSync(join(envPath, 'AGENTS.md'), agentsMd, 'utf8');

  if (link) {
    linkHarnessHub(root);
  }
  return envPath;
}

export function linkHarnessHub(root: string): void {
  const repoRoot = dirname(root); // test/ lives at the repo root
  const probe = spawnSync('sh', ['-c', 'command -v harness-hub'], { encoding: 'utf8' });
  if (probe.status === 0 && probe.stdout.trim()) {
    return; // already linked — skip
  }
  const r = spawnSync('npm', ['link'], { cwd: repoRoot, encoding: 'utf8', stdio: 'inherit' });
  if (r.error || r.status !== 0) {
    throw new Error(`npm link failed: ${r.error?.message ?? r.stderr}`);
  }
}

export function listEnvs(root: string): string[] {
  const dir = envDir(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

export function rmEnv(root: string, name: string): void {
  const envPath = resolveEnvPath(root, name);
  if (!existsSync(envPath)) {
    throw new Error(`Unknown env "${name}" (nothing at ${envPath}).`);
  }
  rmSync(envPath, { recursive: true, force: true });
}

export function generateIntoEnv(root: string, name: string, scenario: string): void {
  generateScenario(resolveEnvPath(root, name), scenario);
}

// R9/R7 gate: unpinned observation must never be silent. env commands warn
// (they construct/use, not observe) — they do not refuse.
export function warnIfUnpinned(stderr: (msg: string) => void = console.error): void {
  if (!process.env.IN_NIX_SHELL) {
    stderr('env: WARNING — not running inside `nix develop`. Run `env shell` for pinned harnesses.');
  }
}
```

- [ ] **Step 4: Run to confirm they pass**

Run: `npx vitest run test/tools/env.test.ts`
Expected: PASS (8 tests). Note `git init` runs inside the temp env dirs (git is available); `createEnv(..., { link: false })` avoids the `npm link` side effect in tests.

- [ ] **Step 5: Commit**

```bash
git add test/tools/env.ts test/tools/env.test.ts
git commit -m "feat: env manager core (create/rm/ls/generate, cwd-independent resolution)"
```