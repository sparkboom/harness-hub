# test/ Environment & Tooling Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize dev-only environment tooling so the Nix flake, tooling (generator/detection/probe + a new `env` manager), and committed scaffold templates live under one self-describing `test/` folder, with ephemeral environments under git-ignored `test/env/{name}/`, and relocate the harness-version manifest to a nested `config/config.json`.

**Architecture:** Three physical moves (`tools/` → `test/tools/`, `flake.nix`/`flake.lock` → `test/`, `harness-versions.json` → `config/config.json` nested under `harness.versions`) followed by two net-new additions: a committed scaffold (`test/template/`) and a fourth thin-CLI/importable-core tool (`test/tools/env.mjs` + `env.ts`) that constructs/tears down ephemeral envs cwd-independently. The runtime CLI under `src/` is product surface and stays behaviourally identical — only `src/registry/versions.ts` changes (where it reads versions from).

**Tech Stack:** TypeScript (Node ≥ 22.12.0), npm, Vitest, commander (runtime CLI only), Nix flakes (dev shell), git (nested consumer repos).

**Spec:** `test-environment-tooling.spec.md` (this deliverable folder).

## Global Constraints

- **Product surface untouched (R8):** no change to `src/` runtime CLI behaviour or output — `list`/`info`, `doctor`, `enable`/`disable`, `migrate`, wiring, registry `data.ts` are all unchanged. The *only* `src/` edit in this deliverable is `src/registry/versions.ts` (R9): it changes `MANIFEST_PATH` and reads the nested shape, but the registry it produces is byte-identical, so CLI output is unaffected.
- **Manifest shape (R9):** the single source of truth becomes `config/config.json` with a top-level `harness` object holding `versions`:

  ```json
  { "harness": { "versions": { "claude-code": { "displayName": "…", "version": "…", "verifiedDate": "…", "install": { … } }, "…": { … } } } }
  ```

  All three consumers (flake, `src/registry/versions.ts`, `test/tools/manifest.ts`) read through `harness.versions`.
- **Node floor:** `>=22.12.0` (from `package.json` `engines`).
- **Tools compile separately:** `build:tools` = `tsc -p test/tools/tsconfig.json`, emitting to `test/tools/dist/` (CommonJS). The `.mjs` shims at `test/tools/*.mjs` load `dist/*.js` and never change their inner logic.
- **Env names (R3):** a single non-dot, non-`..` path segment (no `/` or `\`); no `..`/`.`; otherwise free-form. Collision with a future integration-tests env name is a documented convention only (not enforced).
- **nix-shell observation (R7):** unpinned harnesses are never *silently* observed. `env` warns (not refuses) for construction/use; `probe` keeps its warn-and-continue banner. Full `nix develop` still **does not enter** until the HASH FILL loop completes (existing known-pending state; non-goal here).
- **Nix flake correctness precondition:** the repo is git-tracked. A flake located at `test/` resolves `../config/config.json` correctly *because* nix reads the enclosing git tree (verified empirically: `git+file://…?dir=test` and `nix develop ./test` both resolve a `../config` read; a bare `path:` flake copied in isolation would not). `env shell` / the template's `shell` script must invoke the flake by path-within-repo (relative or absolute), never by isolated path copy.

---

### Task 1: Relocate `tools/` → `test/tools/` (R6)

**Files:**
- Move: `tools/**` → `test/tools/**` (whole directory, via `git mv`)
- Modify: `package.json` (`build:tools` script)
- Modify: `test/tools/manifest.ts` (candidate list +1 level; still flat root `harness-versions.json` until Task 3)
- Modify: `.gitignore` (`tools/dist/` → `test/tools/dist/`)

**Interfaces:**
- Consumes: nothing (mechanical move).
- Produces: `test/tools/{generate,detect,probe,fs,manifest,primitives}.ts` + `.mjs` shims + `scenarios/`, compiled to `test/tools/dist/`. `loadManifest()` still returns the flat `Record<string, HarnessManifestEntry>` (Task 3 changes its internals).

- [ ] **Step 1: Move the directory and update the build script**

Run:

```bash
git mv tools test/tools
# The move leaves behind untracked git-ignored build output (tools/dist/). Remove it.
rm -rf tools
```

Edit `package.json` — change the single script:

```json
"build:tools": "tsc -p test/tools/tsconfig.json"
```

- [ ] **Step 2: Extend the manifest candidate list for the deeper location**

Edit `test/tools/manifest.ts` — replace the `MANIFEST_CANDIDATES` array (source layout `test/tools` now needs `../..`, compiled `test/tools/dist` needs `../../..`):

```ts
const MANIFEST_CANDIDATES = [
  join(__dirname, 'harness-versions.json'),
  join(__dirname, '..', 'harness-versions.json'),
  join(__dirname, '..', '..', 'harness-versions.json'),
  join(__dirname, '..', '..', '..', 'harness-versions.json'),
];
```

(The rest of `manifest.ts` — `loadManifest()` reading the flat map — is unchanged until Task 3.)

- [ ] **Step 3: Update `.gitignore` for the new dist location**

Edit `.gitignore`: remove the `tools/dist/` line, add `test/tools/dist/`. Result:

```
.cursor
dist/
node_modules/
playground/
test/tools/dist/
```

(`playground/` stays ignored until Task 4.)

- [ ] **Step 4: Verify the move is green**

Run:

```bash
npx vitest run
npm run build:tools
node test/tools/detect.mjs
node test/tools/generate.mjs baseline --target /tmp/hh-smoke-1
git status
```

Expected: full suite passes (tools tests discover `.ts` over `.mjs` via `vitest.config.mjs`'s `resolve.extensions` — unchanged; the `generate.mjs`/`generate.ts` comment remains valid with no path literal to fix). `build:tools` emits `test/tools/dist/*.js`; `detect.mjs` prints the 7-harness table (host-installed pins are the documented R9 host-truth case, not a failure); `generate.mjs` writes `AGENTS.md` + `writing-tests` skill into `/tmp/hh-smoke-1`; `git status` shows only the expected renames.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move tools/ to test/tools/ and repoint build + manifest candidates"
```

---

### Task 2: Relocate the Nix flake to `test/` (R2)

**Files:**
- Move: `flake.nix` → `test/flake.nix`, `flake.lock` → `test/flake.lock`
- Modify: `test/flake.nix` (`readFile` path + description/prose; still flat manifest until Task 3)

**Interfaces:**
- Consumes: repo-root `harness-versions.json` (flat) — for this task only.
- Produces: `test/flake.nix` with `versions` bound from a `readFile` that resolves relative to `test/`. Later tasks switch it to `../config/config.json` + `cfg.harness.versions`.

- [ ] **Step 1: Move the flake and its lock**

```bash
git mv flake.nix test/flake.nix
git mv flake.lock test/flake.lock
```

- [ ] **Step 2: Repoint the manifest read and prose**

Edit `test/flake.nix`. Change the `description`, the manifest comment/read, and the `shellHook` echo. Specifically:

```nix
  description = "harness-hub test environment shell";
```

and in the `let` block:

```nix
      # harness-versions.json (repo root) is the single source of truth for
      # pinned harness versions — see spec R10.
      versions = builtins.fromJSON (builtins.readFile ../harness-versions.json);
```

and in `shellHook`:

```nix
          echo "harness-hub test shell — run \`detect\` to see the pinned harnesses."
```

Leave everything else — `mkNpmHarness`, `cursorFhs`, the six `mkNpmHarness` calls, and the trailing `# HASH FILL` comment — unchanged.

- [ ] **Step 3: Verify the flake parses and resolves its manifest read**

Run (best-effort; nix must be available):

```bash
nix-instantiate --parse test/flake.nix
nix eval --impure --raw --expr 'let f = builtins.fromJSON (builtins.readFile ./harness-versions.json); in builtins.isAttrs f' 
```

Expected: `nix-instantiate --parse` prints no error (parses OK). The second command confirms the manifest still parses as an object (it is unchanged at this point). A full `nix develop --flake ./test` will not enter until hashes are filled (known-pending) — do **not** attempt the hash-fill loop; note the parse-only verification in the report.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move flake.nix and flake.lock to test/"
```

---

### Task 3: Relocate the manifest to `config/config.json` (R9)

**Files:**
- Create: `config/config.json` (nested `harness.versions`; content below)
- Delete: `harness-versions.json`
- Modify: `src/registry/versions.ts` (path + nested read)
- Modify: `test/tools/manifest.ts` (config candidates + nested read)
- Modify: `test/flake.nix` (`../config/config.json` + `cfg.harness.versions`)
- Modify: `package.json` (`files` array)

**Interfaces:**
- Consumes: the flat `harness-versions.json` entries (to nest them verbatim).
- Produces: `config/config.json` with shape `{ harness: { versions: { <id>: HarnessVersionEntry } } }`; `loadVersionsManifest()` and `loadManifest()` both now read `harness.versions`. The flake binds `versions = cfg.harness.versions`.

- [ ] **Step 1: Create the nested manifest and remove the old one**

Create `config/config.json` (verbatim values from the current `harness-versions.json`, nested under `harness.versions`):

```json
{
  "harness": {
    "versions": {
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
  }
}
```

Then:

```bash
git rm harness-versions.json
```

- [ ] **Step 2: Update `src/registry/versions.ts`**

Replace the `MANIFEST_PATH` constant and `loadVersionsManifest()` body. The full file becomes:

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

// Compiled to dist/registry/versions.js (__dirname = dist/registry) and run
// from src/registry under vitest; both are two levels below the repo root,
// where config/config.json ships (via the "files" array).
const MANIFEST_PATH = join(__dirname, '..', '..', 'config', 'config.json');

interface ManifestShape {
  harness: { versions: Record<string, HarnessVersionEntry> };
}

export function loadVersionsManifest(): Record<HarnessId, HarnessVersionEntry> {
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ManifestShape;
  const versions = raw.harness.versions;
  for (const id of ALL_HARNESS_IDS) {
    if (!(id in versions)) throw new Error(`config/config.json is missing an entry for "${id}"`);
  }
  return versions as Record<HarnessId, HarnessVersionEntry>;
}
```

Note: `src/registry/data.ts`, `src/registry/index.ts`, `src/registry/types.ts` are unchanged — they consume `loadVersionsManifest()`'s return value, whose shape is identical.

- [ ] **Step 3: Update `test/tools/manifest.ts`**

Replace the candidate list and `loadManifest()`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface HarnessManifestEntry {
  displayName: string;
  version: string;
  verifiedDate: string;
  install: { method: string; package?: string; url?: string };
}

// test/tools/ code runs from two layouts: source under vitest (__dirname =
// <repo>/test/tools) and compiled via build:tools (__dirname =
// <repo>/test/tools/dist). The config sits at the repo root
// (<repo>/config/config.json), so probe candidates in order and use the first
// that exists.
const MANIFEST_CANDIDATES = [
  join(__dirname, '..', '..', 'config', 'config.json'),       // source: test/tools → repo root
  join(__dirname, '..', '..', '..', 'config', 'config.json'), // compiled: test/tools/dist → repo root
];

const MANIFEST_PATH =
  MANIFEST_CANDIDATES.find((p) => existsSync(p)) ?? MANIFEST_CANDIDATES[MANIFEST_CANDIDATES.length - 1];

interface ManifestShape {
  harness: { versions: Record<string, HarnessManifestEntry> };
}

export function loadManifest(): Record<string, HarnessManifestEntry> {
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ManifestShape;
  return raw.harness.versions;
}
```

- [ ] **Step 4: Update `test/flake.nix` to the nested config**

Replace the manifest comment + read lines:

```nix
      # config/config.json (repo root) is the single source of truth for
      # pinned harness versions — nested under `harness.versions`.
      cfg = builtins.fromJSON (builtins.readFile ../config/config.json);
      versions = cfg.harness.versions;
```

(The `mkNpmHarness` calls already reference `versions."claude-code".version` etc., which continue to resolve through the new `versions` binding.)

- [ ] **Step 5: Update `package.json` `files` array**

```json
"files": ["dist", "config/config.json"],
```

- [ ] **Step 6: Verify**

Run:

```bash
npx vitest run
npm run typecheck
npm run build:tools
node test/tools/detect.mjs
nix-instantiate --parse test/flake.nix
git status
```

Expected: `src/registry/versions.test.ts` and `src/registry/index.test.ts` pass (they read through `loadVersionsManifest()` — no path literals). `detect.mjs` still prints the 7-harness table from the nested manifest. `nix-instantiate --parse test/flake.nix` parses. `git status` shows `config/config.json` added and `harness-versions.json` deleted.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: relocate manifest to config/config.json (nested harness.versions)"
```

---

### Task 4: Committed scaffold `test/template/` + ignore boundaries (R1, R4)

**Files:**
- Create: `test/template/package.json`
- Create: `test/template/AGENTS.md`
- Create: `test/tools/template.test.ts`
- Modify: `.gitignore` (remove `playground/`, add `test/env/**`)

**Interfaces:**
- Consumes: the relocated tools (Task 1) — the template's npm scripts point at `../../tools/*.mjs`; the flake (Task 2) — the `shell` script points at `../../`.
- Produces: `test/template/` (committed static scaffold, no setup script). `env.ts` (Task 5) copies + templating these files.

- [ ] **Step 1: Write the scaffold `package.json`**

Create `test/template/package.json` (corrected paths, one level deeper than the old `playground/`, and **no** `setup` script):

```json
{
  "name": "harness-hub-env-playground",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "generate": "node ../../tools/generate.mjs",
    "scenario": "node ../../tools/generate.mjs",
    "detect": "node ../../tools/detect.mjs",
    "probe": "node ../../tools/probe.mjs",
    "env": "node ../../tools/env.mjs",
    "reset": "git clean -fdX .",
    "shell": "nix develop --flake ../../"
  }
}
```

- [ ] **Step 2: Write the scaffold `AGENTS.md`**

Create `test/template/AGENTS.md` (identical content to the old `playground/AGENTS.md`):

```markdown
# Agents

Minimal consumer-repo agent doc for harness-hub testing.
```

- [ ] **Step 3: Lock the corrected paths with a test**

Create `test/tools/template.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('test/template scaffold', () => {
  it('uses corrected ../../ tool paths and drops the setup script', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'template', 'package.json'), 'utf8')) as {
      name: string;
      scripts: Record<string, string>;
    };
    expect(pkg.name).toBe('harness-hub-env-playground');
    expect(pkg.scripts.generate).toBe('node ../../tools/generate.mjs');
    expect(pkg.scripts.detect).toBe('node ../../tools/detect.mjs');
    expect(pkg.scripts.probe).toBe('node ../../tools/probe.mjs');
    expect(pkg.scripts.env).toBe('node ../../tools/env.mjs');
    expect(pkg.scripts.shell).toBe('nix develop --flake ../../');
    expect(pkg.scripts.setup).toBeUndefined();
  });

  it('ships a minimal AGENTS.md', () => {
    const md = readFileSync(join(__dirname, '..', 'template', 'AGENTS.md'), 'utf8');
    expect(md).toContain('# Agents');
  });
});
```

- [ ] **Step 4: Update `.gitignore` and remove the stale playground**

Edit `.gitignore`: remove the `playground/` line, add `test/env/**`. Result:

```
.cursor
dist/
node_modules/
test/env/**
test/tools/dist/
```

Then delete the stale, git-ignored `playground/` directory (it holds only the scrapped scaffold + a nested `.git`, all outside version control):

```bash
rm -rf playground
```

- [ ] **Step 5: Verify**

Run:

```bash
npx vitest run
git status
```

Expected: the new `template.test.ts` passes; `git status` shows `test/template/` tracked and **no** `test/env/` or `playground/` entries (confirm `playground/` is gone from disk and `.gitignore`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: committed test/template scaffold and tightened gitignore boundaries"
```

---

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

---

### Task 6: `env` CLI, shim, and R7 gate (R3)

**Files:**
- Create: `test/tools/env.mjs`
- Modify: `test/tools/env.ts` (add `parseArgs`, `runShell`, `confirmRemove`, `extractRoot`, `main`, `USAGE`)
- Modify: `test/tools/env.test.ts` (add `parseArgs` tests)

**Interfaces:**
- Consumes: the Task 5 core exports.
- Produces: the runnable `env` CLI: `env create [name]` (alias `init`), `env rm <name> [--yes]`, `env ls`, `env shell [name]`, `env generate <name> <scenario> [--target <dir>]`, with a global `--root <dir>` override. `main(argv, defaultRoot?)` returns a `Promise<number>`.

- [ ] **Step 1: Write the failing parseArgs tests**

Append to `test/tools/env.test.ts` (import `parseArgs` and add to the `env manager` describe block):

```ts
  it('parses create with default and explicit names', () => {
    expect(parseArgs(['create'])).toEqual({ kind: 'create', name: 'playground' });
    expect(parseArgs(['create', 'foo'])).toEqual({ kind: 'create', name: 'foo' });
  });

  it('parses rm with --yes', () => {
    expect(parseArgs(['rm', 'foo', '--yes'])).toEqual({ kind: 'rm', name: 'foo', yes: true });
    expect(parseArgs(['rm', 'foo'])).toEqual({ kind: 'rm', name: 'foo', yes: false });
  });

  it('parses ls', () => {
    expect(parseArgs(['ls'])).toEqual({ kind: 'ls' });
  });

  it('parses shell with optional name', () => {
    expect(parseArgs(['shell'])).toEqual({ kind: 'shell' });
    expect(parseArgs(['shell', 'foo'])).toEqual({ kind: 'shell', name: 'foo' });
  });

  it('parses generate with optional target', () => {
    expect(parseArgs(['generate', 'foo', 'baseline'])).toEqual({ kind: 'generate', name: 'foo', scenario: 'baseline' });
    expect(parseArgs(['generate', 'foo', 'baseline', '--target', '/tmp/x']))
      .toEqual({ kind: 'generate', name: 'foo', scenario: 'baseline', target: '/tmp/x' });
  });

  it('rejects an unknown command', () => {
    expect(() => parseArgs(['frobnicate'])).toThrow(/Unknown command/);
  });
```

- [ ] **Step 2: Run to confirm they fail**

Run: `npx vitest run test/tools/env.test.ts`
Expected: FAIL — `parseArgs` is not exported.

- [ ] **Step 3: Add the CLI surface to `env.ts`**

Add these imports to the top of `test/tools/env.ts` (extend the `node:fs` import with `readSync`):

```ts
import { readSync } from 'node:fs';
```

Then append the CLI section:

```ts
// ---- CLI ----
const USAGE = `usage: env <command> [args] [--root <test-dir>]
  env create [name]                 construct an env (default "playground"; alias: init)
  env rm <name> [--yes]             remove an env
  env ls                            list envs
  env shell [name]                  enter nix develop against test/flake.nix
  env generate <name> <scenario> [--target <dir>]
                                    generate a scenario into an env
`;

export type EnvCommand =
  | { kind: 'create'; name: string }
  | { kind: 'rm'; name: string; yes: boolean }
  | { kind: 'ls' }
  | { kind: 'shell'; name?: string }
  | { kind: 'generate'; name: string; scenario: string; target?: string };

export function parseArgs(argv: string[]): EnvCommand {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'create':
    case 'init':
      return { kind: 'create', name: rest[0] ?? DEFAULT_ENV_NAME };
    case 'rm': {
      if (!rest[0]) throw new Error('Usage: env rm <name> [--yes]');
      return { kind: 'rm', name: rest[0], yes: rest.includes('--yes') };
    }
    case 'ls':
      return { kind: 'ls' };
    case 'shell':
      return { kind: 'shell', name: rest[0] };
    case 'generate': {
      const [name, scenario, ...opts] = rest;
      if (!name || !scenario) throw new Error('Usage: env generate <name> <scenario> [--target <dir>]');
      let target: string | undefined;
      for (let i = 0; i < opts.length; i++) {
        if (opts[i] === '--target') target = opts[++i];
        else if (opts[i].startsWith('--target=')) target = opts[i].slice('--target='.length);
      }
      return target ? { kind: 'generate', name, scenario, target } : { kind: 'generate', name, scenario };
    }
    default:
      throw new Error(`Unknown command "${cmd}". ${USAGE}`);
  }
}

function extractRoot(argv: string[]): { root?: string; rest: string[] } {
  const rest: string[] = [];
  let root: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') { root = argv[++i]; }
    else if (argv[i].startsWith('--root=')) { root = argv[i].slice('--root='.length); }
    else { rest.push(argv[i]); }
  }
  return { root, rest };
}

export function runShell(root: string, name?: string): number {
  let cwd = dirname(root); // repo root
  if (name) {
    const envPath = resolveEnvPath(root, name);
    if (!existsSync(envPath)) {
      throw new Error(`Unknown env "${name}" — run \`env create ${name}\` first.`);
    }
    cwd = envPath;
  }
  const r = spawnSync('nix', ['develop', '--flake', root], { cwd, stdio: 'inherit' });
  return r.status ?? 1;
}

function confirmRemove(name: string): boolean {
  process.stdout.write(`Remove env "${name}" (test/env/${name}/) permanently? [y/N] `);
  const buf = Buffer.alloc(16);
  let n = 0;
  try {
    n = readSync(0, buf, 0, 16, null);
  } catch {
    return false;
  }
  const answer = buf.toString('utf8', 0, n).trim().toLowerCase();
  return answer === 'y' || answer === 'yes';
}

export async function main(argv: string[], defaultRoot?: string): Promise<number> {
  const { root: rootOverride, rest } = extractRoot(argv);
  const root = defaultRoot ?? rootOverride ?? resolveTestDir(__dirname);
  try {
    const cmd = parseArgs(rest);
    switch (cmd.kind) {
      case 'create': {
        warnIfUnpinned();
        const envPath = createEnv(root, cmd.name);
        console.log(`env: created ${cmd.name} at ${envPath}`);
        return 0;
      }
      case 'rm': {
        if (!cmd.yes && !confirmRemove(cmd.name)) return 1;
        rmEnv(root, cmd.name);
        console.log(`env: removed ${cmd.name}`);
        return 0;
      }
      case 'ls': {
        for (const name of listEnvs(root)) console.log(name);
        return 0;
      }
      case 'shell':
        return runShell(root, cmd.name);
      case 'generate': {
        warnIfUnpinned();
        const dest = cmd.target ?? resolveEnvPath(root, cmd.name);
        generateScenario(dest, cmd.scenario);
        console.log(`env: generated "${cmd.scenario}" into ${dest}`);
        return 0;
      }
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
```

- [ ] **Step 4: Create the `.mjs` shim**

Create `test/tools/env.mjs` (mirror of `generate.mjs`/`detect.mjs`/`probe.mjs`, loading `dist/env.js`):

```js
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, 'dist', 'env.js');
if (!existsSync(entry)) {
  console.error('tools not built — run: npm run build:tools');
  process.exit(1);
}
const require = createRequire(import.meta.url);
const { main } = require(entry);
main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

- [ ] **Step 5: Verify unit tests + build + smoke from outside `test/tools`**

Run:

```bash
npx vitest run test/tools/env.test.ts
npm run build:tools
node test/tools/env.mjs ls
node test/tools/env.mjs create smoke
node test/tools/env.mjs ls
node test/tools/env.mjs rm smoke --yes
```

Expected: unit tests pass; `build:tools` emits `test/tools/dist/env.js`; `env ls` prints nothing (no envs yet); `env create smoke` prints a warning banner (R7, since not in `nix develop`) then creates `test/env/smoke/` with a nested `.git`, `package.json` (name `harness-hub-env-smoke`), and `AGENTS.md`; `env ls` prints `smoke`; `env rm smoke --yes` removes it. Because `env.mjs` resolves its location via `import.meta.url` (and `env.ts` via `__dirname`), these commands work from any CWD — run them from the repo root to prove cwd-independence.

Confirm `git status` shows **no** `test/env/` entries (git-ignored via `test/env/**`).

- [ ] **Step 6: Commit**

```bash
git add test/tools/env.ts test/tools/env.test.ts test/tools/env.mjs
git commit -m "feat: env CLI (create/rm/ls/shell/generate) with R7 gate and .mjs shim"
```

---

### Task 7: R7 observation ownership (probe text) + references sweep + full verification

**Files:**
- Modify: `test/tools/probe.ts` (`warnIfUnpinned` banner text)

**Interfaces:**
- Consumes: nothing.
- Produces: an updated probe banner referencing the relocated shell entrypoint (`env shell`).

- [ ] **Step 1: Update the probe R9/R7 banner**

Edit `test/tools/probe.ts` — replace the `warnIfUnpinned` message string:

```ts
    stderr(
      'probe: WARNING — not running inside `nix develop`. Observing the unpinned host environment (R9). Run `env shell` (or an env\'s `npm run shell`) for pinned harnesses.'
    );
```

(`warnIfUnpinned()` stays warn-and-continue — no refusal, matching the prior deliverable's final ruling. `tools/probe.test.ts` does not assert the banner text, so it is unaffected.)

- [ ] **Step 2: Sweep for stale references**

Run and confirm only expected matches remain (no path-literal fixes needed beyond what Tasks 1–3 already changed):

```bash
rg -n "tools/generate|tools/detect|tools/probe|harness-versions\.json|flake\.nix" --glob '!node_modules/**' --glob '!deliverables/**'
```

Expected: no matches in committed source (the `deliverables/**` historical docs are intentionally excluded; `AGENTS.md`, `README.md`, and `.cursor/rules/` contain no `flake.nix`-at-root or `tools/` prose to fix). If a match appears in a tracked non-deliverable file, fix it in this step.

- [ ] **Step 3: Full verification (success criteria 1–7)**

Run:

```bash
npx vitest run
npm run typecheck
npm run build:tools
node test/tools/env.mjs create playground
node test/tools/env.mjs ls
node test/tools/env.mjs generate playground baseline
node test/tools/detect.mjs
node test/tools/probe.mjs claude-code
node test/tools/env.mjs rm playground --yes
nix-instantiate --parse test/flake.nix
git status
```

Expected, mapped to the spec's success criteria:
1. `test/` contains `flake.nix`, `flake.lock`, `tools/`, `template/`, `env/` (env is created then removed; the dir may be absent when empty — that is fine, it is constructed on demand).
2. `build:tools` emits `test/tools/dist/` and the `.mjs` shims resolve it (smoke commands above exit 0).
3. `env create playground` produces `test/env/playground/` with nested `.git`, copied `package.json`/`AGENTS.md`, linked `harness-hub`, R9 gate respected; `git status` shows **no** `test/env/` entries.
4. `env create foo && env generate <scenario>` + `detect` + `probe` work from outside `test/tools` (cwd-independent).
5. `nix-instantiate --parse test/flake.nix` parses; `env shell` / `nix develop --flake ./test` resolves `../config/config.json` (verified at eval; full shell entry remains pending on HASH FILL — note this in the report).
6. `npx vitest run`, `npm run typecheck`, `npm run build:tools` are all green.
7. `git status` is clean (the old `playground/` is already deleted in Task 4).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: probe R7 banner references env shell; final restructure verification"
```

---

## Self-Review

**Spec coverage:**
- R1 scaffold templates → Task 4 (`test/template/package.json`, `AGENTS.md`, corrected paths, no setup script).
- R2 moved flake → Task 2 (move) + Task 3 (`../config/config.json` + nested read).
- R3 env manager → Task 5 (core) + Task 6 (CLI/shim/`--root`/`import.meta.url`-style resolution, `create`/`init`/`rm`/`ls`/`shell`/`generate`).
- R4 git-ignore boundaries → Task 1 (`tools/dist` → `test/tools/dist`) + Task 4 (`playground/` removal, `test/env/**` addition, stale playground deletion).
- R6 references → Task 1 (`build:tools`, `manifest.ts` candidates, vitest verify) + Task 3 (manifest config candidates) + Task 7 (doc-prose sweep).
- R7 observation ownership → Task 5/6 (`env` `warnIfUnpinned`) + Task 7 (`probe.ts` banner text).
- R8 product surface untouched → Global Constraints; the only `src/` edit is `src/registry/versions.ts` (R9), with byte-identical registry output.
- R9 config relocation → Task 3 (all three consumers + `files` array).
- Success criteria 1–7 → Task 7 Step 3.

**Placeholder scan:** none — every code step carries full content; no TBD/TODO/"similar to".

**Type consistency:** `DEFAULT_ENV_NAME = 'playground'`, `resolveEnvPath(root, name)`, `createEnv(root, name, { link, gitInit })`, `rmEnv(root, name)`, `listEnvs(root) → string[]`, `generateIntoEnv(root, name, scenario)`, `warnIfUnpinned(stderr?)`, `parseArgs(argv) → EnvCommand`, `main(argv, defaultRoot?) → Promise<number>`, `runShell(root, name?) → number` are used consistently across Tasks 5–7 and their tests.
