# harness-hub MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `harness-hub` CLI (npm package, TypeScript) that implements the full MVP spec: `enable`/`disable`/`migrate`/`doctor` commands wiring `AGENTS.md` and `.agents/skills/` into any of seven coding harnesses.

**Architecture:** A declarative, internal **harness-conventions registry** (one entry per harness: how it reads `AGENTS.md`, how it reads skills, whether it needs migration or trust-gating) drives both the wiring code and a set of **pluggable doctor-check rules** (common `DoctorRule` interface, run through one aggregator). Commands (`enable`/`disable`/`migrate`/`doctor`) are thin orchestrators over: the registry, a doctor-rule run, and a small set of filesystem primitives (symlink/copy/compare). This directly implements the two future-proofing decisions recorded in `harness-doctor-architecture.insight.md` — as real code in this MVP, not deferred.

**Tech Stack:** TypeScript 7, Node.js ≥ 18, compiled via `tsc` to CommonJS `dist/`. CLI parsing via `commander`. YAML via the `yaml` package (used both for `harness-hub.yaml` and for reading Hermes's `~/.hermes/config.yaml`). Skill frontmatter via `gray-matter`. Tests via `vitest`, colocated as `*.test.ts` next to the source they test, using real temp directories (`fs.mkdtempSync`) rather than mocking the filesystem.

**Spec:** [`harness-hub-mvp.spec.md`](./harness-hub-mvp.spec.md) (this deliverable's folder). Companion implementation note: [`harness-doctor-architecture.insight.md`](./harness-doctor-architecture.insight.md).

## Global Constraints

- **Stack:** TypeScript / Node.js, distributed via npm (spec header).
- **Platform:** macOS and Linux only (spec header) — no Windows-specific code paths; symlinks are used unconditionally.
- **Canon root** `.agents/` is fixed, never configurable (spec §3).
- **Config:** exactly one of `harness-hub.yaml` (default) / `harness-hub.json` per repo (spec §4).
- **Skill validation** is frontmatter-only — no sidecar files, no cross-harness intent-key logic (spec §7).
- **Four commands only:** `enable`, `disable`, `doctor`, `migrate` (spec §2, §8).
- **`migrate`** adopts pre-existing skills into canon; in this deliverable only Claude Code's registry entry has a migratable skills mode, so `migrate` is functionally a no-op/error for every other harness id — this falls out of registry *data*, not a hardcoded per-command restriction (spec §2, §8, §11; see Architecture above).
- **Generated artifacts are symlinks only**; canon is read-only to harness-hub except `migrate`'s additive copy (spec §1, §10).
- **`--force`** only overrides the clobber-risk finding. Unmigrated-skills, skill-migration-collision, and Hermes-trust findings are never forceable (spec §8, §9, §10).
- **Node.js ≥ 18** (implementation choice — not spec-mandated, but needed for stable `fs` APIs used below).
- **Module system:** compiled output is CommonJS (implementation choice, for straightforward `bin` wiring).

## Resolved Ambiguities

The spec is behaviorally complete but under-specifies a few mechanics needed to write code. These are the calls made to fill those gaps — flag any of them to reconsider before or during implementation:

1. **Which findings block `enable`?** Spec §8 explicitly calls out clobber-risk, unmigrated-skills, and Hermes-trust as blocking, but doesn't explicitly say whether canon-presence / skill-shape / skill-frontmatter / config-validity errors also block. This plan treats **every error-severity finding as blocking; only clobber-risk is `--force`-overridable.** This is the only reading consistent with doctor's stated CI-gating purpose (§8) and doesn't contradict anything explicit in the spec.
2. **Multi-harness `enable a b c` partial failure.** Not specified. This plan: a **canon-wide** (non-harness-scoped) blocking error aborts the whole invocation (nothing can safely wire without valid canon). A **harness-scoped** blocking error skips only that harness; other requested harnesses still proceed. Overall exit code is non-zero if any harness was blocked.
3. **Repo-root resolution.** Not specified for harness-hub itself. This plan walks up from `process.cwd()` to the nearest ancestor containing `.git` (dir or file) — chosen because it must agree with Hermes's own resolution for the trust check (spec §6) to mean anything, and is a reasonable default for every other command too.

---

## Task 1: Project scaffold + version utility

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore` (append `dist/`, `node_modules/` — the existing repo `.gitignore` is otherwise untouched)
- Create: `src/version.ts`
- Test: `src/version.test.ts`

**Interfaces:**
- Produces: `getPackageVersion(): string` — used by Task 23's CLI `--version` wiring.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "harness-hub",
  "version": "0.1.0",
  "description": "Make a repo harness-agnostic: wire AGENTS.md and .agents/skills/ into whichever coding harnesses you enable.",
  "license": "MIT",
  "bin": {
    "harness-hub": "dist/bin.js"
  },
  "engines": {
    "node": ">=18"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "commander": "^15.0.0",
    "gray-matter": "^4.0.3",
    "yaml": "^2.9.1"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^7.0.2",
    "vitest": "^5.0.1"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts", "dist", "node_modules"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Append build artifacts to `.gitignore`**

Add to the existing `.gitignore`:

```
dist/
node_modules/
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: `package-lock.json` created, `node_modules/` populated, no errors.

- [ ] **Step 6: Write the failing test for `getPackageVersion`**

```typescript
// src/version.test.ts
import { describe, it, expect } from 'vitest';
import { getPackageVersion } from './version';

describe('getPackageVersion', () => {
  it('returns the version string from package.json', () => {
    const version = getPackageVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run src/version.test.ts`
Expected: FAIL — `Cannot find module './version'`.

- [ ] **Step 8: Implement `getPackageVersion`**

```typescript
// src/version.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function getPackageVersion(): string {
  const pkgPath = join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
  return pkg.version;
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run src/version.test.ts`
Expected: PASS.

- [ ] **Step 10: Verify the build toolchain compiles**

Run: `npm run build`
Expected: `dist/version.js` created, no errors.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore src/version.ts src/version.test.ts
git commit -m "chore: project scaffold (TS/vitest/tsc) + getPackageVersion"
```

---

## Task 2: Repo root resolution

**Files:**
- Create: `src/repo.ts`
- Test: `src/repo.test.ts`

**Interfaces:**
- Produces: `findRepoRoot(startDir: string): string`, `class NotAGitRepoError extends Error`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/repo.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findRepoRoot, NotAGitRepoError } from './repo';

describe('findRepoRoot', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hh-repo-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('finds the repo root when starting at the root itself', () => {
    mkdirSync(join(root, '.git'));
    expect(findRepoRoot(root)).toBe(root);
  });

  it('walks up from a nested subdirectory', () => {
    mkdirSync(join(root, '.git'));
    const nested = join(root, 'a', 'b', 'c');
    mkdirSync(nested, { recursive: true });
    expect(findRepoRoot(nested)).toBe(root);
  });

  it('treats a .git file (linked worktree) as a valid marker', () => {
    writeFileSync(join(root, '.git'), 'gitdir: /somewhere/else\n');
    expect(findRepoRoot(root)).toBe(root);
  });

  it('throws NotAGitRepoError when no .git is found', () => {
    const nested = join(root, 'a', 'b');
    mkdirSync(nested, { recursive: true });
    expect(() => findRepoRoot(nested)).toThrow(NotAGitRepoError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/repo.test.ts`
Expected: FAIL — `Cannot find module './repo'`.

- [ ] **Step 3: Implement `findRepoRoot`**

```typescript
// src/repo.ts
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export class NotAGitRepoError extends Error {
  constructor(startDir: string) {
    super(`Not a git repository (or any parent up to "${startDir}"'s filesystem root): no .git found.`);
    this.name = 'NotAGitRepoError';
  }
}

/**
 * Walks up from `startDir` to find the nearest ancestor directory containing
 * a `.git` entry (directory for a normal checkout, file for a linked
 * worktree/submodule). Matches the resolution Hermes itself uses for
 * project trust (spec §6), so harness-hub and Hermes agree on "which repo
 * is this."
 */
export function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    if (existsSync(join(dir, '.git'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new NotAGitRepoError(startDir);
    }
    dir = parent;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/repo.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/repo.ts src/repo.test.ts
git commit -m "feat: findRepoRoot, matching Hermes's .git-ancestor resolution"
```

---

## Task 3: Harness id type

**Files:**
- Create: `src/harnesses.ts`
- Test: `src/harnesses.test.ts`

**Interfaces:**
- Produces: `ALL_HARNESS_IDS: readonly HarnessId[]`, `type HarnessId`, `isHarnessId(value: string): value is HarnessId`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/harnesses.test.ts
import { describe, it, expect } from 'vitest';
import { ALL_HARNESS_IDS, isHarnessId } from './harnesses';

describe('harnesses', () => {
  it('lists exactly the seven recognized ids from spec §4', () => {
    expect([...ALL_HARNESS_IDS].sort()).toEqual(
      ['claude-code', 'codex', 'cursor', 'deepseek', 'hermes', 'opencode', 'pi'].sort()
    );
  });

  it('isHarnessId accepts every recognized id', () => {
    for (const id of ALL_HARNESS_IDS) {
      expect(isHarnessId(id)).toBe(true);
    }
  });

  it('isHarnessId rejects an unrecognized string', () => {
    expect(isHarnessId('not-a-real-harness')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/harnesses.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/harnesses.ts
export const ALL_HARNESS_IDS = [
  'claude-code',
  'cursor',
  'opencode',
  'codex',
  'hermes',
  'pi',
  'deepseek',
] as const;

export type HarnessId = (typeof ALL_HARNESS_IDS)[number];

export function isHarnessId(value: string): value is HarnessId {
  return (ALL_HARNESS_IDS as readonly string[]).includes(value);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/harnesses.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/harnesses.ts src/harnesses.test.ts
git commit -m "feat: HarnessId type + isHarnessId guard"
```

---

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

## Task 5: Config file (harness-hub.yaml / .json)

**Files:**
- Create: `src/config.ts`
- Test: `src/config.test.ts`

**Interfaces:**
- Consumes: `HarnessId`, `isHarnessId`, `ALL_HARNESS_IDS` (Task 3).
- Produces: `ConfigLoadResult` (discriminated union), `loadConfig(repoRoot: string): ConfigLoadResult`, `saveConfig(repoRoot: string, harnesses: HarnessId[]): void`, `YAML_CONFIG_FILENAME`, `JSON_CONFIG_FILENAME`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, saveConfig, YAML_CONFIG_FILENAME, JSON_CONFIG_FILENAME } from './config';

describe('config', () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-config-'));
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('reports absent when neither config file exists', () => {
    expect(loadConfig(repoRoot)).toEqual({ status: 'absent' });
  });

  it('reports ambiguous when both files exist', () => {
    writeFileSync(join(repoRoot, YAML_CONFIG_FILENAME), 'harnesses: []\n');
    writeFileSync(join(repoRoot, JSON_CONFIG_FILENAME), '{"harnesses": []}');
    expect(loadConfig(repoRoot).status).toBe('ambiguous');
  });

  it('loads a valid yaml config', () => {
    writeFileSync(join(repoRoot, YAML_CONFIG_FILENAME), 'harnesses:\n  - claude-code\n  - cursor\n');
    expect(loadConfig(repoRoot)).toEqual({
      status: 'ok',
      format: 'yaml',
      path: join(repoRoot, YAML_CONFIG_FILENAME),
      harnesses: ['claude-code', 'cursor'],
      unknownIds: [],
    });
  });

  it('loads a valid json config', () => {
    writeFileSync(join(repoRoot, JSON_CONFIG_FILENAME), JSON.stringify({ harnesses: ['hermes'] }));
    expect(loadConfig(repoRoot)).toEqual({
      status: 'ok',
      format: 'json',
      path: join(repoRoot, JSON_CONFIG_FILENAME),
      harnesses: ['hermes'],
      unknownIds: [],
    });
  });

  it('reports parse-error on malformed yaml', () => {
    writeFileSync(join(repoRoot, YAML_CONFIG_FILENAME), 'harnesses: [\n');
    expect(loadConfig(repoRoot).status).toBe('parse-error');
  });

  it('reports invalid-shape when harnesses is not an array', () => {
    writeFileSync(join(repoRoot, YAML_CONFIG_FILENAME), 'harnesses: "claude-code"\n');
    expect(loadConfig(repoRoot).status).toBe('invalid-shape');
  });

  it('collects unrecognized harness ids separately from valid ones', () => {
    writeFileSync(join(repoRoot, YAML_CONFIG_FILENAME), 'harnesses:\n  - claude-code\n  - not-a-real-harness\n');
    expect(loadConfig(repoRoot)).toMatchObject({
      status: 'ok',
      harnesses: ['claude-code'],
      unknownIds: ['not-a-real-harness'],
    });
  });

  it('saveConfig creates harness-hub.yaml by default', () => {
    saveConfig(repoRoot, ['cursor']);
    expect(existsSync(join(repoRoot, YAML_CONFIG_FILENAME))).toBe(true);
    expect(existsSync(join(repoRoot, JSON_CONFIG_FILENAME))).toBe(false);
  });

  it('saveConfig writes json when only a json config already existed', () => {
    writeFileSync(join(repoRoot, JSON_CONFIG_FILENAME), JSON.stringify({ harnesses: [] }));
    saveConfig(repoRoot, ['codex']);
    const written = JSON.parse(readFileSync(join(repoRoot, JSON_CONFIG_FILENAME), 'utf8'));
    expect(written).toEqual({ harnesses: ['codex'] });
    expect(existsSync(join(repoRoot, YAML_CONFIG_FILENAME))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/config.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/config.ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { ALL_HARNESS_IDS, isHarnessId, type HarnessId } from './harnesses';

export const YAML_CONFIG_FILENAME = 'harness-hub.yaml';
export const JSON_CONFIG_FILENAME = 'harness-hub.json';

export type ConfigFormat = 'yaml' | 'json';

export type ConfigLoadResult =
  | { status: 'absent' }
  | { status: 'ambiguous'; yamlPath: string; jsonPath: string }
  | { status: 'parse-error'; format: ConfigFormat; path: string; error: string }
  | { status: 'invalid-shape'; format: ConfigFormat; path: string; reason: string }
  | { status: 'ok'; format: ConfigFormat; path: string; harnesses: HarnessId[]; unknownIds: string[] };

export function loadConfig(repoRoot: string): ConfigLoadResult {
  const yamlPath = join(repoRoot, YAML_CONFIG_FILENAME);
  const jsonPath = join(repoRoot, JSON_CONFIG_FILENAME);
  const yamlExists = existsSync(yamlPath);
  const jsonExists = existsSync(jsonPath);

  if (yamlExists && jsonExists) {
    return { status: 'ambiguous', yamlPath, jsonPath };
  }
  if (!yamlExists && !jsonExists) {
    return { status: 'absent' };
  }

  const format: ConfigFormat = yamlExists ? 'yaml' : 'json';
  const path = yamlExists ? yamlPath : jsonPath;
  const raw = readFileSync(path, 'utf8');

  let parsed: unknown;
  try {
    parsed = format === 'yaml' ? parseYaml(raw) : JSON.parse(raw);
  } catch (err) {
    return { status: 'parse-error', format, path, error: err instanceof Error ? err.message : String(err) };
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('harnesses' in parsed) ||
    !Array.isArray((parsed as { harnesses: unknown }).harnesses)
  ) {
    return { status: 'invalid-shape', format, path, reason: '"harnesses" must be an array' };
  }

  const rawHarnesses = (parsed as { harnesses: unknown[] }).harnesses;
  const harnesses: HarnessId[] = [];
  const unknownIds: string[] = [];
  for (const entry of rawHarnesses) {
    if (typeof entry === 'string' && isHarnessId(entry)) {
      harnesses.push(entry);
    } else {
      unknownIds.push(String(entry));
    }
  }

  return { status: 'ok', format, path, harnesses, unknownIds };
}

export function saveConfig(repoRoot: string, harnesses: HarnessId[]): void {
  const yamlPath = join(repoRoot, YAML_CONFIG_FILENAME);
  const jsonPath = join(repoRoot, JSON_CONFIG_FILENAME);
  const format: ConfigFormat = existsSync(jsonPath) && !existsSync(yamlPath) ? 'json' : 'yaml';
  const sorted = [...harnesses].sort((a, b) => ALL_HARNESS_IDS.indexOf(a) - ALL_HARNESS_IDS.indexOf(b));

  if (format === 'json') {
    writeFileSync(jsonPath, JSON.stringify({ harnesses: sorted }, null, 2) + '\n', 'utf8');
  } else {
    writeFileSync(yamlPath, stringifyYaml({ harnesses: sorted }), 'utf8');
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/config.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config.ts src/config.test.ts
git commit -m "feat: harness-hub.yaml/.json load + save"
```

---

## Task 6: Canon reader

**Files:**
- Create: `src/canon.ts`
- Test: `src/canon.test.ts`

**Interfaces:**
- Produces: `AGENTS_MD_FILENAME`, `SKILLS_DIR`, `hasAgentsMd(repoRoot): boolean`, `skillsRootDir(repoRoot): string`, `listSkillDirNames(repoRoot): string[]`, `listSkillsRootNonDirEntries(repoRoot): string[]`, `readSkillFrontmatter(repoRoot, name): SkillFrontmatterResult`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/canon.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  hasAgentsMd,
  listSkillDirNames,
  listSkillsRootNonDirEntries,
  readSkillFrontmatter,
} from './canon';

describe('canon', () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-canon-'));
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('detects AGENTS.md presence', () => {
    expect(hasAgentsMd(repoRoot)).toBe(false);
    writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
    expect(hasAgentsMd(repoRoot)).toBe(true);
  });

  it('returns an empty list when .agents/skills is absent', () => {
    expect(listSkillDirNames(repoRoot)).toEqual([]);
  });

  it('lists only directories under .agents/skills, and reports stray non-dir entries separately', () => {
    const skillsDir = join(repoRoot, '.agents', 'skills');
    mkdirSync(join(skillsDir, 'writing-tests'), { recursive: true });
    mkdirSync(join(skillsDir, 'debugging'), { recursive: true });
    writeFileSync(join(skillsDir, 'stray.md'), '# stray\n');
    expect(listSkillDirNames(repoRoot).sort()).toEqual(['debugging', 'writing-tests']);
    expect(listSkillsRootNonDirEntries(repoRoot)).toEqual(['stray.md']);
  });

  it('reads a skill SKILL.md frontmatter', () => {
    const skillDir = join(repoRoot, '.agents', 'skills', 'writing-tests');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: writing-tests\ndescription: How to write tests.\n---\n\nBody text.\n'
    );
    const result = readSkillFrontmatter(repoRoot, 'writing-tests');
    expect(result.hasSkillMd).toBe(true);
    expect(result.frontmatter).toEqual({ name: 'writing-tests', description: 'How to write tests.' });
  });

  it('reports hasSkillMd: false when SKILL.md is missing', () => {
    mkdirSync(join(repoRoot, '.agents', 'skills', 'empty-dir'), { recursive: true });
    expect(readSkillFrontmatter(repoRoot, 'empty-dir').hasSkillMd).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/canon.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/canon.ts
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

export const AGENTS_MD_FILENAME = 'AGENTS.md';
export const SKILLS_DIR = join('.agents', 'skills');

export function hasAgentsMd(repoRoot: string): boolean {
  return existsSync(join(repoRoot, AGENTS_MD_FILENAME));
}

export function skillsRootDir(repoRoot: string): string {
  return join(repoRoot, SKILLS_DIR);
}

/** Every direct child directory of .agents/skills/, by name. Empty array if the dir is absent. */
export function listSkillDirNames(repoRoot: string): string[] {
  const root = skillsRootDir(repoRoot);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/** Any entry directly under .agents/skills/ that is NOT a directory (e.g. a stray flat .md file). */
export function listSkillsRootNonDirEntries(repoRoot: string): string[] {
  const root = skillsRootDir(repoRoot);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => !entry.isDirectory())
    .map((entry) => entry.name);
}

export interface SkillFrontmatterResult {
  hasSkillMd: boolean;
  frontmatter?: Record<string, unknown>;
}

/** Reads <skillsRoot>/<name>/SKILL.md's frontmatter, if the file exists. */
export function readSkillFrontmatter(repoRoot: string, name: string): SkillFrontmatterResult {
  const skillMdPath = join(skillsRootDir(repoRoot), name, 'SKILL.md');
  if (!existsSync(skillMdPath) || !statSync(skillMdPath).isFile()) {
    return { hasSkillMd: false };
  }
  const raw = readFileSync(skillMdPath, 'utf8');
  const parsed = matter(raw);
  return { hasSkillMd: true, frontmatter: parsed.data };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/canon.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/canon.ts src/canon.test.ts
git commit -m "feat: canon reader (AGENTS.md presence, skill dir listing, frontmatter)"
```

---

## Task 7: Skill frontmatter validation

**Files:**
- Create: `src/skills/validate.ts`
- Test: `src/skills/validate.test.ts`

**Interfaces:**
- Produces: `FrontmatterIssue`, `validateSkillFrontmatter(dirName: string, frontmatter: Record<string, unknown> | undefined): FrontmatterIssue[]`.

This implements spec §7's required-fields contract exactly: `name` (1–64 chars, lowercase `a-z0-9-`, no leading/trailing/consecutive hyphens, must equal the directory name) and `description` (1–1024 chars, non-empty).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/skills/validate.test.ts
import { describe, it, expect } from 'vitest';
import { validateSkillFrontmatter } from './validate';

describe('validateSkillFrontmatter', () => {
  it('passes a valid skill', () => {
    const issues = validateSkillFrontmatter('writing-tests', {
      name: 'writing-tests',
      description: 'How to write tests.',
    });
    expect(issues).toEqual([]);
  });

  it('flags a missing name', () => {
    const issues = validateSkillFrontmatter('writing-tests', { description: 'x' });
    expect(issues.map((i) => i.code)).toContain('missing-name');
  });

  it('flags an invalid name format (uppercase)', () => {
    const issues = validateSkillFrontmatter('Writing-Tests', { name: 'Writing-Tests', description: 'x' });
    expect(issues.map((i) => i.code)).toContain('invalid-name-format');
  });

  it('flags consecutive hyphens', () => {
    const issues = validateSkillFrontmatter('writing--tests', { name: 'writing--tests', description: 'x' });
    expect(issues.map((i) => i.code)).toContain('invalid-name-format');
  });

  it('flags a name that does not match its directory', () => {
    const issues = validateSkillFrontmatter('writing-tests', { name: 'other-name', description: 'x' });
    expect(issues.map((i) => i.code)).toContain('name-mismatch');
  });

  it('flags a missing description', () => {
    const issues = validateSkillFrontmatter('writing-tests', { name: 'writing-tests' });
    expect(issues.map((i) => i.code)).toContain('missing-description');
  });

  it('flags a description over 1024 chars', () => {
    const issues = validateSkillFrontmatter('writing-tests', {
      name: 'writing-tests',
      description: 'x'.repeat(1025),
    });
    expect(issues.map((i) => i.code)).toContain('description-length');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/skills/validate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/skills/validate.ts
export interface FrontmatterIssue {
  code:
    | 'missing-name'
    | 'invalid-name-format'
    | 'name-mismatch'
    | 'missing-description'
    | 'description-length';
  message: string;
}

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function validateSkillFrontmatter(
  dirName: string,
  frontmatter: Record<string, unknown> | undefined
): FrontmatterIssue[] {
  const issues: FrontmatterIssue[] = [];
  const name = frontmatter?.['name'];
  const description = frontmatter?.['description'];

  if (typeof name !== 'string' || name.length === 0) {
    issues.push({ code: 'missing-name', message: `Skill "${dirName}": frontmatter "name" is missing or empty.` });
  } else {
    if (name.length > 64 || !NAME_PATTERN.test(name)) {
      issues.push({
        code: 'invalid-name-format',
        message: `Skill "${dirName}": "name" must be 1-64 chars, lowercase a-z0-9 and single hyphens, no leading/trailing/consecutive hyphens (got "${name}").`,
      });
    }
    if (name !== dirName) {
      issues.push({
        code: 'name-mismatch',
        message: `Skill "${dirName}": frontmatter "name" ("${name}") must equal the parent directory name.`,
      });
    }
  }

  if (typeof description !== 'string' || description.length === 0) {
    issues.push({
      code: 'missing-description',
      message: `Skill "${dirName}": frontmatter "description" is missing or empty.`,
    });
  } else if (description.length > 1024) {
    issues.push({
      code: 'description-length',
      message: `Skill "${dirName}": "description" must be 1-1024 chars (got ${description.length}).`,
    });
  }

  return issues;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/skills/validate.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/skills/validate.ts src/skills/validate.test.ts
git commit -m "feat: skill frontmatter validation per spec §7"
```

---

## Task 8: Filesystem primitives

**Files:**
- Create: `src/fsutil.ts`
- Test: `src/fsutil.test.ts`

**Interfaces:**
- Produces: `copyDirRecursive(src, dest): void`, `dirsByteIdentical(a, b): boolean`, `isSymlinkTo(linkPath, expectedTarget): boolean`, `relativeSymlinkTarget(repoRoot, linkRelPath, targetAbsPath): string`, `ensureGitignoreEntries(repoRoot, entries): void`.

These are the shared primitives every wiring/doctor module in later tasks builds on — kept dependency-free (no imports from `canon`/`registry`) so they're easy to reason about in isolation.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/fsutil.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  copyDirRecursive,
  dirsByteIdentical,
  isSymlinkTo,
  relativeSymlinkTarget,
  ensureGitignoreEntries,
} from './fsutil';

describe('fsutil', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hh-fsutil-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  describe('copyDirRecursive', () => {
    it('copies nested files and directories', () => {
      const src = join(root, 'src');
      mkdirSync(join(src, 'scripts'), { recursive: true });
      writeFileSync(join(src, 'SKILL.md'), 'body');
      writeFileSync(join(src, 'scripts', 'run.sh'), 'echo hi');

      const dest = join(root, 'dest');
      copyDirRecursive(src, dest);

      expect(readFileSync(join(dest, 'SKILL.md'), 'utf8')).toBe('body');
      expect(readFileSync(join(dest, 'scripts', 'run.sh'), 'utf8')).toBe('echo hi');
    });
  });

  describe('dirsByteIdentical', () => {
    it('returns true for identical trees', () => {
      const a = join(root, 'a');
      const b = join(root, 'b');
      mkdirSync(join(a, 'sub'), { recursive: true });
      mkdirSync(join(b, 'sub'), { recursive: true });
      writeFileSync(join(a, 'sub', 'f.txt'), 'same');
      writeFileSync(join(b, 'sub', 'f.txt'), 'same');
      expect(dirsByteIdentical(a, b)).toBe(true);
    });

    it('returns false when file contents differ', () => {
      const a = join(root, 'a');
      const b = join(root, 'b');
      mkdirSync(a, { recursive: true });
      mkdirSync(b, { recursive: true });
      writeFileSync(join(a, 'f.txt'), 'one');
      writeFileSync(join(b, 'f.txt'), 'two');
      expect(dirsByteIdentical(a, b)).toBe(false);
    });

    it('returns false when one side has an extra file', () => {
      const a = join(root, 'a');
      const b = join(root, 'b');
      mkdirSync(a, { recursive: true });
      mkdirSync(b, { recursive: true });
      writeFileSync(join(a, 'f.txt'), 'one');
      writeFileSync(join(b, 'f.txt'), 'one');
      writeFileSync(join(b, 'extra.txt'), 'x');
      expect(dirsByteIdentical(a, b)).toBe(false);
    });

    it('returns false when either directory is missing', () => {
      expect(dirsByteIdentical(join(root, 'missing-a'), join(root, 'missing-b'))).toBe(false);
    });
  });

  describe('isSymlinkTo', () => {
    it('returns true when the symlink resolves to the expected target', () => {
      const link = join(root, 'link');
      symlinkSync('.agents/skills', link);
      expect(isSymlinkTo(link, '.agents/skills')).toBe(true);
    });

    it('returns false for a symlink pointing elsewhere', () => {
      const link = join(root, 'link');
      symlinkSync('somewhere/else', link);
      expect(isSymlinkTo(link, '.agents/skills')).toBe(false);
    });

    it('returns false for a real directory', () => {
      const dir = join(root, 'realdir');
      mkdirSync(dir);
      expect(isSymlinkTo(dir, '.agents/skills')).toBe(false);
    });

    it('returns false when the path does not exist', () => {
      expect(isSymlinkTo(join(root, 'nope'), '.agents/skills')).toBe(false);
    });
  });

  describe('relativeSymlinkTarget', () => {
    it('computes the relative target for a top-level file symlink', () => {
      expect(relativeSymlinkTarget('/repo', 'CLAUDE.md', '/repo/AGENTS.md')).toBe('AGENTS.md');
    });

    it('computes the relative target for a nested directory symlink', () => {
      expect(relativeSymlinkTarget('/repo', '.claude/skills', '/repo/.agents/skills')).toBe(
        join('..', '.agents', 'skills')
      );
    });
  });

  describe('ensureGitignoreEntries', () => {
    it('creates .gitignore when absent', () => {
      ensureGitignoreEntries(root, ['CLAUDE.md', '.claude/skills']);
      const content = readFileSync(join(root, '.gitignore'), 'utf8');
      expect(content).toContain('CLAUDE.md');
      expect(content).toContain('.claude/skills');
    });

    it('appends only missing entries, without duplicating existing ones', () => {
      writeFileSync(join(root, '.gitignore'), 'node_modules\nCLAUDE.md\n');
      ensureGitignoreEntries(root, ['CLAUDE.md', '.claude/skills']);
      const lines = readFileSync(join(root, '.gitignore'), 'utf8').split('\n').filter(Boolean);
      expect(lines.filter((l) => l === 'CLAUDE.md')).toHaveLength(1);
      expect(lines).toContain('.claude/skills');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/fsutil.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/fsutil.ts
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';

export function copyDirRecursive(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      symlinkSync(readlinkSync(srcPath), destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/** Recursively compares two directory trees for identical relative paths and byte-identical file contents. */
export function dirsByteIdentical(a: string, b: string): boolean {
  if (!existsSync(a) || !existsSync(b)) return false;
  const entriesA = readdirSync(a, { withFileTypes: true })
    .map((e) => e.name)
    .sort();
  const entriesB = readdirSync(b, { withFileTypes: true })
    .map((e) => e.name)
    .sort();
  if (entriesA.length !== entriesB.length || entriesA.some((name, i) => name !== entriesB[i])) {
    return false;
  }
  for (const name of entriesA) {
    const pathA = join(a, name);
    const pathB = join(b, name);
    const statA = lstatSync(pathA);
    const statB = lstatSync(pathB);
    if (statA.isDirectory() !== statB.isDirectory()) return false;
    if (statA.isDirectory()) {
      if (!dirsByteIdentical(pathA, pathB)) return false;
    } else if (!readFileSync(pathA).equals(readFileSync(pathB))) {
      return false;
    }
  }
  return true;
}

/** True if `linkPath` exists, is a symlink, and resolves to exactly `expectedTarget`. */
export function isSymlinkTo(linkPath: string, expectedTarget: string): boolean {
  if (!existsSync(linkPath)) return false;
  const stat = lstatSync(linkPath);
  if (!stat.isSymbolicLink()) return false;
  return readlinkSync(linkPath) === expectedTarget;
}

/** The relative path a symlink at `repoRoot/linkRelPath` needs to point at `targetAbsPath`. */
export function relativeSymlinkTarget(repoRoot: string, linkRelPath: string, targetAbsPath: string): string {
  return relative(dirname(join(repoRoot, linkRelPath)), targetAbsPath);
}

/** Appends any of `entries` to repoRoot/.gitignore that isn't already present as an exact line. Creates the file if absent. */
export function ensureGitignoreEntries(repoRoot: string, entries: string[]): void {
  const gitignorePath = join(repoRoot, '.gitignore');
  const existingLines = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8').split('\n') : [];
  const missing = entries.filter((entry) => !existingLines.includes(entry));
  if (missing.length === 0) return;
  const separator = existingLines.length > 0 && existingLines[existingLines.length - 1] !== '' ? '\n' : '';
  const updated = existingLines.join('\n') + separator + missing.join('\n') + '\n';
  writeFileSync(gitignorePath, updated, 'utf8');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/fsutil.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/fsutil.ts src/fsutil.test.ts
git commit -m "feat: filesystem primitives (copy, byte-compare, symlink checks, gitignore)"
```

---

## Task 9: Pluggable doctor-rule framework

**Files:**
- Create: `src/doctor/types.ts`
- Create: `src/doctor/run.ts`
- Test: `src/doctor/run.test.ts`

**Interfaces:**
- Consumes: `HarnessId` (Task 3), `ConfigLoadResult` (Task 5).
- Produces: `Severity`, `Finding`, `DoctorContext`, `DoctorRule`, `runDoctor(ctx, rules): Finding[]`, `hasBlockingErrors(findings): boolean`, `findingsForHarness(findings, harnessId): Finding[]`.

This is the "doctor checks as pluggable rules" architecture from `harness-doctor-architecture.insight.md` — every check in spec §9 becomes one `DoctorRule` implementation (Tasks 10, 11, 12, 14, 15, 16), and `runDoctor` is the single aggregator both `doctor` and `enable` use.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/doctor/run.test.ts
import { describe, it, expect } from 'vitest';
import { runDoctor, hasBlockingErrors, findingsForHarness } from './run';
import type { DoctorContext, DoctorRule, Finding } from './types';

function makeCtx(overrides: Partial<DoctorContext> = {}): DoctorContext {
  return {
    repoRoot: '/repo',
    homeDir: '/home/user',
    config: { status: 'absent' },
    configuredHarnesses: [],
    pendingHarnesses: [],
    ...overrides,
  };
}

describe('runDoctor', () => {
  it('only runs rules whose applies() returns true', () => {
    const ranRuleIds: string[] = [];
    const rules: DoctorRule[] = [
      {
        id: 'always',
        applies: () => true,
        check: () => {
          ranRuleIds.push('always');
          return [];
        },
      },
      {
        id: 'never',
        applies: () => false,
        check: () => {
          ranRuleIds.push('never');
          return [];
        },
      },
    ];
    runDoctor(makeCtx(), rules);
    expect(ranRuleIds).toEqual(['always']);
  });

  it('aggregates findings from every applicable rule', () => {
    const finding: Finding = { ruleId: 'a', severity: 'error', message: 'm', remediation: 'r', forceable: false };
    const rules: DoctorRule[] = [
      { id: 'a', applies: () => true, check: () => [finding] },
      { id: 'b', applies: () => true, check: () => [] },
    ];
    expect(runDoctor(makeCtx(), rules)).toEqual([finding]);
  });
});

describe('hasBlockingErrors', () => {
  it('is true when any finding is an error', () => {
    expect(
      hasBlockingErrors([{ ruleId: 'a', severity: 'error', message: '', remediation: '', forceable: false }])
    ).toBe(true);
  });

  it('is false when all findings are warnings', () => {
    expect(
      hasBlockingErrors([{ ruleId: 'a', severity: 'warning', message: '', remediation: '', forceable: false }])
    ).toBe(false);
  });

  it('is false for an empty list', () => {
    expect(hasBlockingErrors([])).toBe(false);
  });
});

describe('findingsForHarness', () => {
  const canonWide: Finding = { ruleId: 'canon', severity: 'error', message: '', remediation: '', forceable: false };
  const claudeOnly: Finding = {
    ruleId: 'claude',
    severity: 'error',
    message: '',
    remediation: '',
    forceable: false,
    harnessId: 'claude-code',
  };
  const hermesOnly: Finding = {
    ruleId: 'hermes',
    severity: 'error',
    message: '',
    remediation: '',
    forceable: false,
    harnessId: 'hermes',
  };

  it('includes canon-wide findings for every harness', () => {
    expect(findingsForHarness([canonWide, claudeOnly, hermesOnly], 'cursor')).toEqual([canonWide]);
  });

  it('includes a harness-scoped finding only for its own harness', () => {
    expect(findingsForHarness([canonWide, claudeOnly, hermesOnly], 'claude-code')).toEqual([canonWide, claudeOnly]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/doctor/run.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the types**

```typescript
// src/doctor/types.ts
import type { HarnessId } from '../harnesses';
import type { ConfigLoadResult } from '../config';

export type Severity = 'error' | 'warning';

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  remediation: string;
  /** Set when this finding is specific to one harness; undefined for canon-wide findings. */
  harnessId?: HarnessId;
  /** True only for findings `enable --force` may override (clobber risk, MVP). */
  forceable: boolean;
}

export interface DoctorContext {
  repoRoot: string;
  homeDir: string;
  config: ConfigLoadResult;
  /** Harnesses already configured ("ok" config's harnesses; [] if config is absent/invalid). */
  configuredHarnesses: HarnessId[];
  /** Harnesses `enable` is currently trying to wire, not yet in configuredHarnesses (empty for a plain `doctor` run). */
  pendingHarnesses: HarnessId[];
}

export interface DoctorRule {
  id: string;
  applies(ctx: DoctorContext): boolean;
  check(ctx: DoctorContext): Finding[];
}
```

- [ ] **Step 4: Implement the runner**

```typescript
// src/doctor/run.ts
import type { DoctorContext, DoctorRule, Finding } from './types';

export function runDoctor(ctx: DoctorContext, rules: DoctorRule[]): Finding[] {
  const findings: Finding[] = [];
  for (const rule of rules) {
    if (rule.applies(ctx)) {
      findings.push(...rule.check(ctx));
    }
  }
  return findings;
}

export function hasBlockingErrors(findings: Finding[]): boolean {
  return findings.some((f) => f.severity === 'error');
}

/** Findings relevant to a specific harness: harness-scoped findings for it, plus every canon-wide finding. */
export function findingsForHarness(findings: Finding[], harnessId: string): Finding[] {
  return findings.filter((f) => f.harnessId === undefined || f.harnessId === harnessId);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/doctor/run.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/doctor/types.ts src/doctor/run.ts src/doctor/run.test.ts
git commit -m "feat: pluggable doctor-rule framework (DoctorRule, runDoctor)"
```

---

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

## Task 11: Skill-shape + skill-frontmatter rules

**Files:**
- Create: `src/doctor/rules/skillShape.ts`
- Create: `src/doctor/rules/skillFrontmatter.ts`
- Test: `src/doctor/rules/skillShape.test.ts`
- Test: `src/doctor/rules/skillFrontmatter.test.ts`

**Interfaces:**
- Consumes: `listSkillDirNames`, `listSkillsRootNonDirEntries`, `readSkillFrontmatter` (Task 6), `validateSkillFrontmatter` (Task 7).
- Produces: `skillShapeRule: DoctorRule`, `skillFrontmatterRule: DoctorRule`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/doctor/rules/skillShape.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { skillShapeRule } from './skillShape';
import type { DoctorContext } from '../types';

function makeCtx(repoRoot: string): DoctorContext {
  return { repoRoot, homeDir: '/home/user', config: { status: 'absent' }, configuredHarnesses: [], pendingHarnesses: [] };
}

describe('skillShapeRule', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-skillshape-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('passes for a well-formed skill', () => {
    const dir = join(repoRoot, '.agents', 'skills', 'writing-tests');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: writing-tests\ndescription: x\n---\n');
    expect(skillShapeRule.check(makeCtx(repoRoot))).toEqual([]);
  });

  it('flags a skill directory with no SKILL.md', () => {
    mkdirSync(join(repoRoot, '.agents', 'skills', 'empty'), { recursive: true });
    const findings = skillShapeRule.check(makeCtx(repoRoot));
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('empty');
  });

  it('flags a flat .md file at the skills root', () => {
    mkdirSync(join(repoRoot, '.agents', 'skills'), { recursive: true });
    writeFileSync(join(repoRoot, '.agents', 'skills', 'stray.md'), '# stray');
    const findings = skillShapeRule.check(makeCtx(repoRoot));
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('stray.md');
  });
});
```

```typescript
// src/doctor/rules/skillFrontmatter.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { skillFrontmatterRule } from './skillFrontmatter';
import type { DoctorContext } from '../types';

function makeCtx(repoRoot: string): DoctorContext {
  return { repoRoot, homeDir: '/home/user', config: { status: 'absent' }, configuredHarnesses: [], pendingHarnesses: [] };
}

describe('skillFrontmatterRule', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-skillfm-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('passes for valid frontmatter', () => {
    const dir = join(repoRoot, '.agents', 'skills', 'writing-tests');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: writing-tests\ndescription: x\n---\n');
    expect(skillFrontmatterRule.check(makeCtx(repoRoot))).toEqual([]);
  });

  it('flags a name/directory mismatch', () => {
    const dir = join(repoRoot, '.agents', 'skills', 'writing-tests');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: other\ndescription: x\n---\n');
    expect(skillFrontmatterRule.check(makeCtx(repoRoot)).length).toBeGreaterThan(0);
  });

  it('skips directories with no SKILL.md (left to skill-shape rule)', () => {
    mkdirSync(join(repoRoot, '.agents', 'skills', 'empty'), { recursive: true });
    expect(skillFrontmatterRule.check(makeCtx(repoRoot))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/doctor/rules/skillShape.test.ts src/doctor/rules/skillFrontmatter.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `skillShapeRule`**

```typescript
// src/doctor/rules/skillShape.ts
import { listSkillDirNames, listSkillsRootNonDirEntries, readSkillFrontmatter } from '../../canon';
import type { DoctorRule, Finding } from '../types';

export const skillShapeRule: DoctorRule = {
  id: 'skill-shape',
  applies: () => true,
  check: (ctx) => {
    const findings: Finding[] = [];
    for (const entryName of listSkillsRootNonDirEntries(ctx.repoRoot)) {
      findings.push({
        ruleId: 'skill-shape',
        severity: 'error',
        message: `.agents/skills/${entryName} is not a directory — skills must be laid out as <name>/SKILL.md.`,
        remediation: `Move ${entryName} into its own <skill-name>/SKILL.md directory.`,
        forceable: false,
      });
    }
    for (const name of listSkillDirNames(ctx.repoRoot)) {
      const { hasSkillMd } = readSkillFrontmatter(ctx.repoRoot, name);
      if (!hasSkillMd) {
        findings.push({
          ruleId: 'skill-shape',
          severity: 'error',
          message: `.agents/skills/${name}/ has no SKILL.md.`,
          remediation: `Add .agents/skills/${name}/SKILL.md, or remove the directory if it isn't a skill.`,
          forceable: false,
        });
      }
    }
    return findings;
  },
};
```

- [ ] **Step 4: Implement `skillFrontmatterRule`**

```typescript
// src/doctor/rules/skillFrontmatter.ts
import { listSkillDirNames, readSkillFrontmatter } from '../../canon';
import { validateSkillFrontmatter } from '../../skills/validate';
import type { DoctorRule, Finding } from '../types';

export const skillFrontmatterRule: DoctorRule = {
  id: 'skill-frontmatter',
  applies: () => true,
  check: (ctx) => {
    const findings: Finding[] = [];
    for (const name of listSkillDirNames(ctx.repoRoot)) {
      const { hasSkillMd, frontmatter } = readSkillFrontmatter(ctx.repoRoot, name);
      if (!hasSkillMd) continue; // reported by skill-shape instead
      for (const issue of validateSkillFrontmatter(name, frontmatter)) {
        findings.push({
          ruleId: 'skill-frontmatter',
          severity: 'error',
          message: issue.message,
          remediation: `Fix the frontmatter in .agents/skills/${name}/SKILL.md.`,
          forceable: false,
        });
      }
    }
    return findings;
  },
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/doctor/rules/skillShape.test.ts src/doctor/rules/skillFrontmatter.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/doctor/rules/skillShape.ts src/doctor/rules/skillShape.test.ts src/doctor/rules/skillFrontmatter.ts src/doctor/rules/skillFrontmatter.test.ts
git commit -m "feat: skill-shape and skill-frontmatter doctor rules"
```

---

## Task 12: Clobber-risk rule (registry-driven)

**Files:**
- Create: `src/doctor/rules/clobberRisk.ts`
- Test: `src/doctor/rules/clobberRisk.test.ts`

**Interfaces:**
- Consumes: `isSymlinkTo`, `relativeSymlinkTarget` (Task 8), `skillsRootDir`, `AGENTS_MD_FILENAME` (Task 6), `ALL_HARNESS_IDS` (Task 3), `getHarnessEntry` (Task 4).
- Produces: `clobberRiskRule: DoctorRule`.

Loops over every registry entry with a symlink-based `agentsDoc` or `migrate-symlink` `skills` mode — today only `claude-code` qualifies, but nothing here hardcodes that id.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/doctor/rules/clobberRisk.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clobberRiskRule } from './clobberRisk';
import type { DoctorContext } from '../types';

function makeCtx(repoRoot: string, pendingHarnesses: DoctorContext['pendingHarnesses'] = []): DoctorContext {
  return { repoRoot, homeDir: '/home/user', config: { status: 'absent' }, configuredHarnesses: [], pendingHarnesses };
}

describe('clobberRiskRule', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-clobber-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('does not apply when claude-code is not configured or pending', () => {
    expect(clobberRiskRule.applies(makeCtx(repoRoot))).toBe(false);
  });

  it('applies when claude-code is pending', () => {
    expect(clobberRiskRule.applies(makeCtx(repoRoot, ['claude-code']))).toBe(true);
  });

  it('passes when CLAUDE.md is the expected symlink', () => {
    writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
    symlinkSync('AGENTS.md', join(repoRoot, 'CLAUDE.md'));
    expect(clobberRiskRule.check(makeCtx(repoRoot, ['claude-code']))).toEqual([]);
  });

  it('flags a hand-written CLAUDE.md', () => {
    writeFileSync(join(repoRoot, 'CLAUDE.md'), '# hand-written\n');
    const findings = clobberRiskRule.check(makeCtx(repoRoot, ['claude-code']));
    expect(findings.some((f) => f.message.includes('CLAUDE.md'))).toBe(true);
    expect(findings.every((f) => f.forceable)).toBe(true);
  });

  it('flags a .claude/skills symlink pointing elsewhere', () => {
    mkdirSync(join(repoRoot, '.claude'), { recursive: true });
    symlinkSync('/somewhere/else', join(repoRoot, '.claude', 'skills'));
    const findings = clobberRiskRule.check(makeCtx(repoRoot, ['claude-code']));
    expect(findings.some((f) => f.message.includes('.claude/skills'))).toBe(true);
  });

  it('does not flag .claude/skills when it is a real directory (handled by the skill-migration rule instead)', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills'), { recursive: true });
    expect(clobberRiskRule.check(makeCtx(repoRoot, ['claude-code']))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/doctor/rules/clobberRisk.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/doctor/rules/clobberRisk.ts
import { existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { isSymlinkTo, relativeSymlinkTarget } from '../../fsutil';
import { skillsRootDir, AGENTS_MD_FILENAME } from '../../canon';
import { ALL_HARNESS_IDS } from '../../harnesses';
import { getHarnessEntry } from '../../registry';
import type { DoctorRule, Finding } from '../types';

function isRelevant(ctx: Parameters<DoctorRule['check']>[0], id: (typeof ALL_HARNESS_IDS)[number]): boolean {
  return ctx.configuredHarnesses.includes(id) || ctx.pendingHarnesses.includes(id);
}

export const clobberRiskRule: DoctorRule = {
  id: 'clobber-risk',
  applies: (ctx) =>
    ALL_HARNESS_IDS.some((id) => {
      const entry = getHarnessEntry(id);
      return isRelevant(ctx, id) && (entry.agentsDoc.mode === 'symlink' || entry.skills.mode === 'migrate-symlink');
    }),
  check: (ctx) => {
    const findings: Finding[] = [];
    for (const id of ALL_HARNESS_IDS) {
      if (!isRelevant(ctx, id)) continue;
      const entry = getHarnessEntry(id);

      if (entry.agentsDoc.mode === 'symlink' && entry.agentsDoc.symlinkPath) {
        const linkPath = join(ctx.repoRoot, entry.agentsDoc.symlinkPath);
        const target = relativeSymlinkTarget(ctx.repoRoot, entry.agentsDoc.symlinkPath, join(ctx.repoRoot, AGENTS_MD_FILENAME));
        if (existsSync(linkPath) && !isSymlinkTo(linkPath, target)) {
          findings.push({
            ruleId: 'clobber-risk',
            severity: 'error',
            message: `${entry.agentsDoc.symlinkPath} exists and is not a symlink to AGENTS.md.`,
            remediation: `Remove or back up ${entry.agentsDoc.symlinkPath}, or re-run enable with --force to replace it.`,
            harnessId: id,
            forceable: true,
          });
        }
      }

      if (entry.skills.mode === 'migrate-symlink' && entry.skills.symlinkPath) {
        const linkPath = join(ctx.repoRoot, entry.skills.symlinkPath);
        const target = relativeSymlinkTarget(ctx.repoRoot, entry.skills.symlinkPath, skillsRootDir(ctx.repoRoot));
        if (existsSync(linkPath) && lstatSync(linkPath).isSymbolicLink() && !isSymlinkTo(linkPath, target)) {
          findings.push({
            ruleId: 'clobber-risk',
            severity: 'error',
            message: `${entry.skills.symlinkPath} is a symlink, but not to .agents/skills.`,
            remediation: `Remove the existing ${entry.skills.symlinkPath} symlink, or re-run enable with --force to replace it.`,
            harnessId: id,
            forceable: true,
          });
        }
      }
    }
    return findings;
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/doctor/rules/clobberRisk.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/doctor/rules/clobberRisk.ts src/doctor/rules/clobberRisk.test.ts
git commit -m "feat: clobber-risk doctor rule, driven by the harness registry"
```

---

## Task 13: Skill migration classification (registry-driven)

**Files:**
- Create: `src/skills/skillMigrationPlan.ts`
- Test: `src/skills/skillMigrationPlan.test.ts`

**Interfaces:**
- Consumes: `dirsByteIdentical` (Task 8), `skillsRootDir` (Task 6), `HarnessEntry` (Task 4).
- Produces: `SkillMigrationEntryPlan`, `listHarnessSkillDirNames(repoRoot, entry): string[]`, `planSkillMigration(repoRoot, entry): SkillMigrationEntryPlan[]`.

This classification is shared by the doctor rule (Task 14) and the `migrate` command (Task 21) — one function, two consumers, so they can never disagree about what counts as "new" vs "collision."

- [ ] **Step 1: Write the failing tests**

```typescript
// src/skills/skillMigrationPlan.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planSkillMigration } from './skillMigrationPlan';
import { getHarnessEntry } from '../registry';

describe('planSkillMigration', () => {
  let repoRoot: string;
  const claudeCode = getHarnessEntry('claude-code');

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-migplan-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('returns an empty plan when .claude/skills does not exist', () => {
    expect(planSkillMigration(repoRoot, claudeCode)).toEqual([]);
  });

  it('classifies a skill with no canon counterpart as new', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'body');
    const plan = planSkillMigration(repoRoot, claudeCode);
    expect(plan).toEqual([expect.objectContaining({ name: 'a', classification: 'new' })]);
  });

  it('classifies a byte-identical skill as identical', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'body');
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'body');
    expect(planSkillMigration(repoRoot, claudeCode)[0].classification).toBe('identical');
  });

  it('classifies a differing skill as a collision', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'body-one');
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'body-two');
    expect(planSkillMigration(repoRoot, claudeCode)[0].classification).toBe('collision');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/skills/skillMigrationPlan.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/skills/skillMigrationPlan.ts
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { dirsByteIdentical } from '../fsutil';
import { skillsRootDir } from '../canon';
import type { HarnessEntry } from '../registry';

export interface SkillMigrationEntryPlan {
  name: string;
  harnessSkillPath: string;
  canonSkillPath: string;
  classification: 'new' | 'identical' | 'collision';
}

/** Directory names directly under a migrate-symlink harness's own skills dir. Empty if that dir is absent, or the harness isn't migrate-symlink. */
export function listHarnessSkillDirNames(repoRoot: string, entry: HarnessEntry): string[] {
  if (entry.skills.mode !== 'migrate-symlink' || !entry.skills.symlinkPath) return [];
  const dir = join(repoRoot, entry.skills.symlinkPath);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

/** Classifies every entry under a migrate-symlink harness's own skills dir against canon `.agents/skills/<name>/`. */
export function planSkillMigration(repoRoot: string, entry: HarnessEntry): SkillMigrationEntryPlan[] {
  if (!entry.skills.symlinkPath) return [];
  return listHarnessSkillDirNames(repoRoot, entry).map((name) => {
    const harnessSkillPath = join(repoRoot, entry.skills.symlinkPath as string, name);
    const canonSkillPath = join(skillsRootDir(repoRoot), name);
    let classification: SkillMigrationEntryPlan['classification'];
    if (!existsSync(canonSkillPath)) {
      classification = 'new';
    } else if (dirsByteIdentical(harnessSkillPath, canonSkillPath)) {
      classification = 'identical';
    } else {
      classification = 'collision';
    }
    return { name, harnessSkillPath, canonSkillPath, classification };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/skills/skillMigrationPlan.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/skills/skillMigrationPlan.ts src/skills/skillMigrationPlan.test.ts
git commit -m "feat: registry-driven skill migration classification (new/identical/collision)"
```

---

## Task 14: Skill-migration doctor rule

**Files:**
- Create: `src/doctor/rules/skillMigration.ts`
- Test: `src/doctor/rules/skillMigration.test.ts`

**Interfaces:**
- Consumes: `ALL_HARNESS_IDS` (Task 3), `getHarnessEntry` (Task 4), `planSkillMigration` (Task 13).
- Produces: `skillMigrationRule: DoctorRule` — emits `unmigrated-skills` findings for `'new'` entries and `skill-migration-collision` findings for `'collision'` entries (spec §9's two distinct checks, one rule module).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/doctor/rules/skillMigration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { skillMigrationRule } from './skillMigration';
import type { DoctorContext } from '../types';

function makeCtx(repoRoot: string, pendingHarnesses: DoctorContext['pendingHarnesses'] = ['claude-code']): DoctorContext {
  return { repoRoot, homeDir: '/home/user', config: { status: 'absent' }, configuredHarnesses: [], pendingHarnesses };
}

describe('skillMigrationRule', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-migrule-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('does not apply when claude-code is irrelevant', () => {
    expect(skillMigrationRule.applies(makeCtx(repoRoot, []))).toBe(false);
  });

  it('reports unmigrated-skills for a new entry', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'body');
    const findings = skillMigrationRule.check(makeCtx(repoRoot));
    expect(findings).toEqual([
      expect.objectContaining({ ruleId: 'unmigrated-skills', severity: 'error', harnessId: 'claude-code', forceable: false }),
    ]);
  });

  it('reports skill-migration-collision for a differing entry', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'one');
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'two');
    const findings = skillMigrationRule.check(makeCtx(repoRoot));
    expect(findings).toEqual([
      expect.objectContaining({ ruleId: 'skill-migration-collision', severity: 'error', forceable: false }),
    ]);
  });

  it('reports nothing for an already-identical entry', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'same');
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'same');
    expect(skillMigrationRule.check(makeCtx(repoRoot))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/doctor/rules/skillMigration.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/doctor/rules/skillMigration.ts
import { ALL_HARNESS_IDS, type HarnessId } from '../../harnesses';
import { getHarnessEntry } from '../../registry';
import { planSkillMigration } from '../../skills/skillMigrationPlan';
import type { DoctorContext, DoctorRule, Finding } from '../types';

function migrateSymlinkHarnessIds(): HarnessId[] {
  return ALL_HARNESS_IDS.filter((id) => getHarnessEntry(id).skills.mode === 'migrate-symlink');
}

function isRelevant(ctx: DoctorContext, id: HarnessId): boolean {
  return ctx.configuredHarnesses.includes(id) || ctx.pendingHarnesses.includes(id);
}

export const skillMigrationRule: DoctorRule = {
  id: 'skill-migration',
  applies: (ctx) => migrateSymlinkHarnessIds().some((id) => isRelevant(ctx, id)),
  check: (ctx) => {
    const findings: Finding[] = [];
    for (const id of migrateSymlinkHarnessIds()) {
      if (!isRelevant(ctx, id)) continue;
      const entry = getHarnessEntry(id);
      for (const planEntry of planSkillMigration(ctx.repoRoot, entry)) {
        if (planEntry.classification === 'new') {
          findings.push({
            ruleId: 'unmigrated-skills',
            severity: 'error',
            message: `${entry.skills.symlinkPath}/${planEntry.name}/ has no counterpart yet in .agents/skills/${planEntry.name}/.`,
            remediation: `Run \`harness-hub migrate ${id}\` to adopt it into canon.`,
            harnessId: id,
            forceable: false,
          });
        } else if (planEntry.classification === 'collision') {
          findings.push({
            ruleId: 'skill-migration-collision',
            severity: 'error',
            message: `${entry.skills.symlinkPath}/${planEntry.name}/SKILL.md differs from .agents/skills/${planEntry.name}/SKILL.md.`,
            remediation: 'Reconcile by hand (rename one, merge manually, or delete the stale copy), then re-run migrate.',
            harnessId: id,
            forceable: false,
          });
        }
      }
    }
    return findings;
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/doctor/rules/skillMigration.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/doctor/rules/skillMigration.ts src/doctor/rules/skillMigration.test.ts
git commit -m "feat: skill-migration doctor rule (unmigrated-skills + skill-migration-collision)"
```

---

## Task 15: Trust-gate doctor rule (Hermes)

**Files:**
- Create: `src/doctor/rules/trustGate.ts`
- Test: `src/doctor/rules/trustGate.test.ts`

**Interfaces:**
- Consumes: `ALL_HARNESS_IDS` (Task 3), `getHarnessEntry` (Task 4), `yaml` package.
- Produces: `trustGateRule: DoctorRule`. Emits `hermes-trust` findings: `error` when the trust file parses but the repo is absent from it; `warning` when the file is missing/unparseable ("can't verify").

Scoped to exactly the currently-released mechanism (spec §6): `skills.trusted_project_dirs` in `~/.hermes/config.yaml`. Hermes's unreleased trust-sidecar migration is intentionally unsupported (spec §11) — a future harness-hub release adds it by extending the registry's `TrustGateConvention`, per `harness-doctor-architecture.insight.md`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/doctor/rules/trustGate.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { trustGateRule } from './trustGate';
import type { DoctorContext } from '../types';

function makeCtx(homeDir: string, repoRoot: string, pendingHarnesses: DoctorContext['pendingHarnesses'] = ['hermes']): DoctorContext {
  return { repoRoot, homeDir, config: { status: 'absent' }, configuredHarnesses: [], pendingHarnesses };
}

describe('trustGateRule', () => {
  let homeDir: string;
  let repoRoot: string;

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), 'hh-home-'));
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-repo-'));
  });

  afterEach(() => {
    rmSync(homeDir, { recursive: true, force: true });
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('does not apply when hermes is irrelevant', () => {
    expect(trustGateRule.applies(makeCtx(homeDir, repoRoot, []))).toBe(false);
  });

  it('warns (does not error) when ~/.hermes/config.yaml is missing', () => {
    const findings = trustGateRule.check(makeCtx(homeDir, repoRoot));
    expect(findings).toEqual([expect.objectContaining({ ruleId: 'hermes-trust', severity: 'warning', harnessId: 'hermes' })]);
  });

  it('warns when the config file fails to parse', () => {
    mkdirSync(join(homeDir, '.hermes'), { recursive: true });
    writeFileSync(join(homeDir, '.hermes', 'config.yaml'), 'skills: [\n');
    expect(trustGateRule.check(makeCtx(homeDir, repoRoot))[0].severity).toBe('warning');
  });

  it('errors when the repo is not in trusted_project_dirs', () => {
    mkdirSync(join(homeDir, '.hermes'), { recursive: true });
    writeFileSync(join(homeDir, '.hermes', 'config.yaml'), 'skills:\n  trusted_project_dirs:\n    - /some/other/repo\n');
    const findings = trustGateRule.check(makeCtx(homeDir, repoRoot));
    expect(findings).toEqual([
      expect.objectContaining({ ruleId: 'hermes-trust', severity: 'error', harnessId: 'hermes', forceable: false }),
    ]);
  });

  it('passes when the repo is listed', () => {
    mkdirSync(join(homeDir, '.hermes'), { recursive: true });
    writeFileSync(join(homeDir, '.hermes', 'config.yaml'), `skills:\n  trusted_project_dirs:\n    - ${repoRoot}\n`);
    expect(trustGateRule.check(makeCtx(homeDir, repoRoot))).toEqual([]);
  });

  it('normalizes a trailing slash on the trusted path', () => {
    mkdirSync(join(homeDir, '.hermes'), { recursive: true });
    writeFileSync(join(homeDir, '.hermes', 'config.yaml'), `skills:\n  trusted_project_dirs:\n    - ${repoRoot}/\n`);
    expect(trustGateRule.check(makeCtx(homeDir, repoRoot))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/doctor/rules/trustGate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/doctor/rules/trustGate.ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ALL_HARNESS_IDS, type HarnessId } from '../../harnesses';
import { getHarnessEntry } from '../../registry';
import type { DoctorContext, DoctorRule, Finding } from '../types';

function getAtKeyPath(obj: unknown, keyPath: string[]): unknown {
  let current = obj;
  for (const key of keyPath) {
    if (typeof current !== 'object' || current === null || !(key in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function trustGatedHarnessIds(): HarnessId[] {
  return ALL_HARNESS_IDS.filter((id) => getHarnessEntry(id).skills.trustGate !== undefined);
}

function isRelevant(ctx: DoctorContext, id: HarnessId): boolean {
  return ctx.configuredHarnesses.includes(id) || ctx.pendingHarnesses.includes(id);
}

export const trustGateRule: DoctorRule = {
  id: 'trust-gate',
  applies: (ctx) => trustGatedHarnessIds().some((id) => isRelevant(ctx, id)),
  check: (ctx) => {
    const findings: Finding[] = [];
    for (const id of trustGatedHarnessIds()) {
      if (!isRelevant(ctx, id)) continue;
      const entry = getHarnessEntry(id);
      const trustGate = entry.skills.trustGate;
      if (!trustGate) continue;

      const configPath = join(ctx.homeDir, trustGate.configPathFromHome);
      const cantVerify = (reason: string) => {
        findings.push({
          ruleId: 'hermes-trust',
          severity: 'warning',
          message: `Can't verify ${entry.displayName} trust: ${reason}`,
          remediation: `Run \`${trustGate.trustCommand}\` inside the repo, or check ${configPath} manually.`,
          harnessId: id,
          forceable: false,
        });
      };

      if (!existsSync(configPath)) {
        cantVerify(`${configPath} does not exist.`);
        continue;
      }

      let parsed: unknown;
      try {
        parsed = parseYaml(readFileSync(configPath, 'utf8'));
      } catch (err) {
        cantVerify(`${configPath} failed to parse (${err instanceof Error ? err.message : String(err)}).`);
        continue;
      }

      const trustedDirs = getAtKeyPath(parsed, trustGate.trustedDirsKeyPath);
      if (!Array.isArray(trustedDirs)) {
        cantVerify(`${configPath} has no readable "${trustGate.trustedDirsKeyPath.join('.')}" list.`);
        continue;
      }

      const isTrusted = trustedDirs.some(
        (dir) => typeof dir === 'string' && dir.replace(/\/$/, '') === ctx.repoRoot.replace(/\/$/, '')
      );
      if (!isTrusted) {
        findings.push({
          ruleId: 'hermes-trust',
          severity: 'error',
          message: `${ctx.repoRoot} is not listed in ${configPath}'s "${trustGate.trustedDirsKeyPath.join('.')}".`,
          remediation: `Run \`${trustGate.trustCommand}\` inside the repo, then re-run enable.`,
          harnessId: id,
          forceable: false,
        });
      }
    }
    return findings;
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/doctor/rules/trustGate.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/doctor/rules/trustGate.ts src/doctor/rules/trustGate.test.ts
git commit -m "feat: trust-gate doctor rule (Hermes skills.trusted_project_dirs)"
```

---

## Task 16: Generated-file-drift rule (registry-driven)

**Files:**
- Create: `src/doctor/rules/generatedFileDrift.ts`
- Test: `src/doctor/rules/generatedFileDrift.test.ts`

**Interfaces:**
- Consumes: `isSymlinkTo`, `relativeSymlinkTarget` (Task 8), `skillsRootDir`, `AGENTS_MD_FILENAME` (Task 6), `ALL_HARNESS_IDS` (Task 3), `getHarnessEntry` (Task 4).
- Produces: `generatedFileDriftRule: DoctorRule`.

Unlike Task 12's clobber-risk rule, this only looks at `configuredHarnesses` (not `pendingHarnesses`) — it's about detecting drift for a harness that's *already* supposed to be wired, so it correctly stays silent during an in-progress `enable` (before the symlinks exist yet).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/doctor/rules/generatedFileDrift.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generatedFileDriftRule } from './generatedFileDrift';
import type { DoctorContext } from '../types';

function makeCtx(repoRoot: string, configuredHarnesses: DoctorContext['configuredHarnesses'] = ['claude-code']): DoctorContext {
  return { repoRoot, homeDir: '/home/user', config: { status: 'absent' }, configuredHarnesses, pendingHarnesses: [] };
}

describe('generatedFileDriftRule', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-drift-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('does not apply when claude-code is not configured', () => {
    expect(generatedFileDriftRule.applies(makeCtx(repoRoot, []))).toBe(false);
  });

  it('warns when the symlinks are missing', () => {
    expect(generatedFileDriftRule.check(makeCtx(repoRoot))).toEqual([
      expect.objectContaining({ ruleId: 'generated-file-drift', severity: 'warning', harnessId: 'claude-code' }),
    ]);
  });

  it('passes when both symlinks are correct', () => {
    writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
    symlinkSync('AGENTS.md', join(repoRoot, 'CLAUDE.md'));
    mkdirSync(join(repoRoot, '.agents', 'skills'), { recursive: true });
    mkdirSync(join(repoRoot, '.claude'), { recursive: true });
    symlinkSync(join('..', '.agents', 'skills'), join(repoRoot, '.claude', 'skills'));
    expect(generatedFileDriftRule.check(makeCtx(repoRoot))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/doctor/rules/generatedFileDrift.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/doctor/rules/generatedFileDrift.ts
import { join } from 'node:path';
import { isSymlinkTo, relativeSymlinkTarget } from '../../fsutil';
import { skillsRootDir, AGENTS_MD_FILENAME } from '../../canon';
import { ALL_HARNESS_IDS } from '../../harnesses';
import { getHarnessEntry } from '../../registry';
import type { DoctorRule, Finding } from '../types';

export const generatedFileDriftRule: DoctorRule = {
  id: 'generated-file-drift',
  applies: (ctx) =>
    ALL_HARNESS_IDS.some((id) => {
      const entry = getHarnessEntry(id);
      return ctx.configuredHarnesses.includes(id) && (entry.agentsDoc.mode === 'symlink' || entry.skills.mode === 'migrate-symlink');
    }),
  check: (ctx) => {
    const findings: Finding[] = [];
    for (const id of ALL_HARNESS_IDS) {
      if (!ctx.configuredHarnesses.includes(id)) continue;
      const entry = getHarnessEntry(id);
      const problems: string[] = [];

      if (entry.agentsDoc.mode === 'symlink' && entry.agentsDoc.symlinkPath) {
        const linkPath = join(ctx.repoRoot, entry.agentsDoc.symlinkPath);
        const target = relativeSymlinkTarget(ctx.repoRoot, entry.agentsDoc.symlinkPath, join(ctx.repoRoot, AGENTS_MD_FILENAME));
        if (!isSymlinkTo(linkPath, target)) problems.push(entry.agentsDoc.symlinkPath);
      }
      if (entry.skills.mode === 'migrate-symlink' && entry.skills.symlinkPath) {
        const linkPath = join(ctx.repoRoot, entry.skills.symlinkPath);
        const target = relativeSymlinkTarget(ctx.repoRoot, entry.skills.symlinkPath, skillsRootDir(ctx.repoRoot));
        if (!isSymlinkTo(linkPath, target)) problems.push(entry.skills.symlinkPath);
      }

      if (problems.length > 0) {
        findings.push({
          ruleId: 'generated-file-drift',
          severity: 'warning',
          message: `${id} is enabled, but ${problems.join(' and ')} ${problems.length > 1 ? 'are' : 'is'} missing or not the expected symlink.`,
          remediation: `Re-run \`harness-hub enable ${id}\` to restore the expected symlink(s).`,
          harnessId: id,
          forceable: false,
        });
      }
    }
    return findings;
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/doctor/rules/generatedFileDrift.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/doctor/rules/generatedFileDrift.ts src/doctor/rules/generatedFileDrift.test.ts
git commit -m "feat: generated-file-drift doctor rule, driven by the harness registry"
```

---

## Task 17: Assemble doctor rules + context builder

**Files:**
- Create: `src/doctor/rules/index.ts`
- Create: `src/doctor/context.ts`
- Test: `src/doctor/rules/index.test.ts`
- Test: `src/doctor/context.test.ts`

**Interfaces:**
- Consumes: every rule from Tasks 10, 11, 12, 14, 15, 16; `loadConfig` (Task 5).
- Produces: `ALL_DOCTOR_RULES: DoctorRule[]`, `buildDoctorContext(repoRoot, pendingHarnesses?, homeDir?): DoctorContext`.

- [ ] **Step 1: Write the failing tests**

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

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/doctor/rules/index.test.ts src/doctor/context.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `rules/index.ts`**

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

- [ ] **Step 4: Implement `context.ts`**

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

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/doctor/rules/index.test.ts src/doctor/context.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/doctor/rules/index.ts src/doctor/rules/index.test.ts src/doctor/context.ts src/doctor/context.test.ts
git commit -m "feat: assemble all 8 doctor rules + doctor context builder"
```

---

## Task 18: `doctor` command

**Files:**
- Create: `src/commands/doctor.ts`
- Test: `src/commands/doctor.test.ts`

**Interfaces:**
- Consumes: `buildDoctorContext` (Task 17), `runDoctor` (Task 9), `ALL_DOCTOR_RULES` (Task 17).
- Produces: `DoctorCommandResult`, `formatFindings(findings): string`, `runDoctorCommand(repoRoot, homeDir?): DoctorCommandResult`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/commands/doctor.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDoctorCommand } from './doctor';

describe('runDoctorCommand', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-doctorcmd-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('exits non-zero when AGENTS.md is missing', () => {
    const result = runDoctorCommand(repoRoot);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('AGENTS.md');
  });

  it('exits zero for a minimal valid repo', () => {
    writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
    const result = runDoctorCommand(repoRoot);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('no issues found');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/commands/doctor.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/commands/doctor.ts
import { buildDoctorContext } from '../doctor/context';
import { runDoctor } from '../doctor/run';
import { ALL_DOCTOR_RULES } from '../doctor/rules';
import type { Finding } from '../doctor/types';

export interface DoctorCommandResult {
  findings: Finding[];
  output: string;
  exitCode: number;
}

export function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) {
    return 'harness-hub doctor: no issues found.';
  }
  return findings
    .map((f) => `[${f.severity.toUpperCase()}] (${f.ruleId}) ${f.message}\n  \u2192 ${f.remediation}`)
    .join('\n');
}

export function runDoctorCommand(repoRoot: string, homeDir?: string): DoctorCommandResult {
  const ctx = buildDoctorContext(repoRoot, [], homeDir);
  const findings = runDoctor(ctx, ALL_DOCTOR_RULES);
  const exitCode = findings.some((f) => f.severity === 'error') ? 1 : 0;
  return { findings, output: formatFindings(findings), exitCode };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/commands/doctor.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/commands/doctor.ts src/commands/doctor.test.ts
git commit -m "feat: doctor command (runs all rules, formats findings, sets exit code)"
```

---

## Task 19: Generic migrate-symlink wiring

**Files:**
- Create: `src/wiring/migrateSymlink.ts`
- Test: `src/wiring/migrateSymlink.test.ts`

**Interfaces:**
- Consumes: `ensureGitignoreEntries`, `isSymlinkTo`, `relativeSymlinkTarget` (Task 8), `skillsRootDir`, `AGENTS_MD_FILENAME` (Task 6), `HarnessEntry` (Task 4).
- Produces: `wireMigrateSymlinkHarness(repoRoot, entry): void`.

This is the actual filesystem-mutating half of `enable` for any harness whose registry entry has a symlink-based `agentsDoc` or `migrate-symlink` `skills` mode. It assumes doctor's blocking checks have already passed (no unmigrated/collision entries remain) — that precondition is enforced by the `enable` command (Task 20), not here.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/wiring/migrateSymlink.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, lstatSync, readlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wireMigrateSymlinkHarness } from './migrateSymlink';
import { getHarnessEntry } from '../registry';

describe('wireMigrateSymlinkHarness', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-wiring-'));
    writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('creates both symlinks from a clean repo', () => {
    wireMigrateSymlinkHarness(repoRoot, getHarnessEntry('claude-code'));
    expect(readlinkSync(join(repoRoot, 'CLAUDE.md'))).toBe('AGENTS.md');
    expect(readlinkSync(join(repoRoot, '.claude', 'skills'))).toBe(join('..', '.agents', 'skills'));
  });

  it('is idempotent when the symlinks already exist', () => {
    wireMigrateSymlinkHarness(repoRoot, getHarnessEntry('claude-code'));
    wireMigrateSymlinkHarness(repoRoot, getHarnessEntry('claude-code'));
    expect(lstatSync(join(repoRoot, 'CLAUDE.md')).isSymbolicLink()).toBe(true);
  });

  it('replaces a real .claude/skills directory that only contains already-migrated content', () => {
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'body');
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'body');

    wireMigrateSymlinkHarness(repoRoot, getHarnessEntry('claude-code'));

    expect(lstatSync(join(repoRoot, '.claude', 'skills')).isSymbolicLink()).toBe(true);
  });

  it('replaces a foreign CLAUDE.md (the --force path)', () => {
    writeFileSync(join(repoRoot, 'CLAUDE.md'), '# hand-written\n');
    wireMigrateSymlinkHarness(repoRoot, getHarnessEntry('claude-code'));
    expect(readlinkSync(join(repoRoot, 'CLAUDE.md'))).toBe('AGENTS.md');
  });

  it('adds both paths to .gitignore', () => {
    wireMigrateSymlinkHarness(repoRoot, getHarnessEntry('claude-code'));
    const gitignore = readFileSync(join(repoRoot, '.gitignore'), 'utf8');
    expect(gitignore).toContain('CLAUDE.md');
    expect(gitignore).toContain('.claude/skills');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/wiring/migrateSymlink.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/wiring/migrateSymlink.ts
import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ensureGitignoreEntries, isSymlinkTo, relativeSymlinkTarget } from '../fsutil';
import { skillsRootDir, AGENTS_MD_FILENAME } from '../canon';
import type { HarnessEntry } from '../registry';

function ensureSymlink(repoRoot: string, linkRelPath: string, targetAbsPath: string): void {
  const linkAbsPath = join(repoRoot, linkRelPath);
  const target = relativeSymlinkTarget(repoRoot, linkRelPath, targetAbsPath);
  if (existsSync(linkAbsPath) && !isSymlinkTo(linkAbsPath, target)) {
    rmSync(linkAbsPath, { recursive: true, force: true });
  }
  if (!existsSync(linkAbsPath)) {
    mkdirSync(dirname(linkAbsPath), { recursive: true });
    symlinkSync(target, linkAbsPath);
  }
}

/**
 * Wires a harness's AGENTS.md symlink and/or skills symlink per its registry
 * entry. Assumes doctor's blocking checks (clobber-risk, unmigrated-skills,
 * skill-migration-collision) already passed for this harness.
 */
export function wireMigrateSymlinkHarness(repoRoot: string, entry: HarnessEntry): void {
  if (entry.skills.mode === 'migrate-symlink' && entry.skills.symlinkPath) {
    ensureSymlink(repoRoot, entry.skills.symlinkPath, skillsRootDir(repoRoot));
  }
  if (entry.agentsDoc.mode === 'symlink' && entry.agentsDoc.symlinkPath) {
    ensureSymlink(repoRoot, entry.agentsDoc.symlinkPath, join(repoRoot, AGENTS_MD_FILENAME));
  }
  const gitignoreEntries = [entry.agentsDoc.symlinkPath, entry.skills.symlinkPath].filter(
    (p): p is string => Boolean(p)
  );
  if (gitignoreEntries.length > 0) {
    ensureGitignoreEntries(repoRoot, gitignoreEntries);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/wiring/migrateSymlink.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/wiring/migrateSymlink.ts src/wiring/migrateSymlink.test.ts
git commit -m "feat: generic migrate-symlink wiring for AGENTS.md + skills"
```

---

## Task 20: `enable` command

**Files:**
- Create: `src/commands/enable.ts`
- Test: `src/commands/enable.test.ts`

**Interfaces:**
- Consumes: `buildDoctorContext` (Task 17), `runDoctor` (Task 9), `ALL_DOCTOR_RULES` (Task 17), `loadConfig`/`saveConfig` (Task 5), `getHarnessEntry` (Task 4), `wireMigrateSymlinkHarness` (Task 19).
- Produces: `EnableHarnessResult`, `EnableCommandResult`, `enableHarnesses(repoRoot, harnessIds, options?): EnableCommandResult`.

Implements the two Resolved Ambiguities at the top of this plan: a canon-wide blocking error aborts every requested harness; a harness-scoped blocking error skips only that harness.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/commands/enable.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, lstatSync, readlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { enableHarnesses } from './enable';

function repoWithAgentsMd(): string {
  const repoRoot = mkdtempSync(join(tmpdir(), 'hh-enable-'));
  writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
  return repoRoot;
}

function readConfiguredHarnesses(repoRoot: string): string[] {
  const raw = readFileSync(join(repoRoot, 'harness-hub.yaml'), 'utf8');
  return (parseYaml(raw) as { harnesses: string[] }).harnesses;
}

describe('enableHarnesses', () => {
  let repoRoot: string;
  let homeDir: string;

  beforeEach(() => {
    repoRoot = repoWithAgentsMd();
    homeDir = mkdtempSync(join(tmpdir(), 'hh-home-'));
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
    rmSync(homeDir, { recursive: true, force: true });
  });

  it('enables a native harness and writes the config', () => {
    const result = enableHarnesses(repoRoot, ['cursor']);
    expect(result.exitCode).toBe(0);
    expect(result.results).toEqual([{ harnessId: 'cursor', status: 'enabled', blockingFindings: [] }]);
    expect(readConfiguredHarnesses(repoRoot)).toEqual(['cursor']);
  });

  it('reports already-enabled without duplicating work', () => {
    enableHarnesses(repoRoot, ['cursor']);
    const result = enableHarnesses(repoRoot, ['cursor']);
    expect(result.results).toEqual([{ harnessId: 'cursor', status: 'already-enabled', blockingFindings: [] }]);
  });

  it('wires claude-code from a clean repo', () => {
    const result = enableHarnesses(repoRoot, ['claude-code']);
    expect(result.exitCode).toBe(0);
    expect(lstatSync(join(repoRoot, 'CLAUDE.md')).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(repoRoot, 'CLAUDE.md'))).toBe('AGENTS.md');
    expect(lstatSync(join(repoRoot, '.claude', 'skills')).isSymbolicLink()).toBe(true);
    expect(readConfiguredHarnesses(repoRoot)).toEqual(['claude-code']);
  });

  it('blocks claude-code when .claude/skills has an unmigrated entry', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'body');
    const result = enableHarnesses(repoRoot, ['claude-code']);
    expect(result.exitCode).toBe(1);
    expect(result.results[0].status).toBe('blocked');
    expect(result.results[0].blockingFindings[0].ruleId).toBe('unmigrated-skills');
    expect(existsSync(join(repoRoot, 'harness-hub.yaml'))).toBe(false);
  });

  it('blocks claude-code on a skill-migration collision', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'one');
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'two');
    const result = enableHarnesses(repoRoot, ['claude-code']);
    expect(result.results[0].blockingFindings[0].ruleId).toBe('skill-migration-collision');
  });

  it('wires claude-code once every .claude/skills entry is already migrated (identical)', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'same');
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'same');
    const result = enableHarnesses(repoRoot, ['claude-code']);
    expect(result.exitCode).toBe(0);
    expect(lstatSync(join(repoRoot, '.claude', 'skills')).isSymbolicLink()).toBe(true);
  });

  it('blocks on a hand-written CLAUDE.md without --force', () => {
    writeFileSync(join(repoRoot, 'CLAUDE.md'), '# hand-written\n');
    const result = enableHarnesses(repoRoot, ['claude-code']);
    expect(result.results[0].status).toBe('blocked');
    expect(result.results[0].blockingFindings[0].ruleId).toBe('clobber-risk');
  });

  it('overwrites a hand-written CLAUDE.md with --force', () => {
    writeFileSync(join(repoRoot, 'CLAUDE.md'), '# hand-written\n');
    const result = enableHarnesses(repoRoot, ['claude-code'], { force: true });
    expect(result.exitCode).toBe(0);
    expect(lstatSync(join(repoRoot, 'CLAUDE.md')).isSymbolicLink()).toBe(true);
  });

  it('blocks every requested harness on a global error (missing AGENTS.md)', () => {
    rmSync(join(repoRoot, 'AGENTS.md'));
    const result = enableHarnesses(repoRoot, ['cursor', 'claude-code']);
    expect(result.exitCode).toBe(1);
    expect(result.results.every((r) => r.status === 'blocked')).toBe(true);
    expect(existsSync(join(repoRoot, 'harness-hub.yaml'))).toBe(false);
  });

  it('blocks hermes when the repo is not trusted', () => {
    const result = enableHarnesses(repoRoot, ['hermes'], { homeDir });
    expect(result.results[0].status).toBe('blocked');
    expect(result.results[0].blockingFindings[0].ruleId).toBe('hermes-trust');
  });

  it('enables hermes once the repo is trusted', () => {
    mkdirSync(join(homeDir, '.hermes'), { recursive: true });
    writeFileSync(join(homeDir, '.hermes', 'config.yaml'), `skills:\n  trusted_project_dirs:\n    - ${repoRoot}\n`);
    const result = enableHarnesses(repoRoot, ['hermes'], { homeDir });
    expect(result.exitCode).toBe(0);
    expect(readConfiguredHarnesses(repoRoot)).toEqual(['hermes']);
  });

  it('processes multiple harnesses independently: one succeeds, one blocks', () => {
    writeFileSync(join(repoRoot, 'CLAUDE.md'), '# hand-written\n');
    const result = enableHarnesses(repoRoot, ['cursor', 'claude-code']);
    expect(result.exitCode).toBe(1);
    expect(result.results.find((r) => r.harnessId === 'cursor')?.status).toBe('enabled');
    expect(result.results.find((r) => r.harnessId === 'claude-code')?.status).toBe('blocked');
    expect(readConfiguredHarnesses(repoRoot)).toEqual(['cursor']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/commands/enable.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/commands/enable.ts
import { buildDoctorContext } from '../doctor/context';
import { runDoctor } from '../doctor/run';
import { ALL_DOCTOR_RULES } from '../doctor/rules';
import { loadConfig, saveConfig } from '../config';
import { getHarnessEntry } from '../registry';
import { wireMigrateSymlinkHarness } from '../wiring/migrateSymlink';
import type { HarnessId } from '../harnesses';
import type { Finding } from '../doctor/types';

export interface EnableHarnessResult {
  harnessId: HarnessId;
  status: 'enabled' | 'already-enabled' | 'blocked';
  blockingFindings: Finding[];
}

export interface EnableCommandResult {
  results: EnableHarnessResult[];
  exitCode: number;
}

export function enableHarnesses(
  repoRoot: string,
  harnessIds: HarnessId[],
  options: { force?: boolean; homeDir?: string } = {}
): EnableCommandResult {
  const config = loadConfig(repoRoot);
  const alreadyEnabled = config.status === 'ok' ? config.harnesses : [];
  const toEnable = harnessIds.filter((id) => !alreadyEnabled.includes(id));

  const ctx = buildDoctorContext(repoRoot, toEnable, options.homeDir);
  const allFindings = runDoctor(ctx, ALL_DOCTOR_RULES);

  // A canon-wide (no harnessId) blocking error stops every harness — nothing
  // can safely wire without valid canon (Resolved Ambiguity #1/#2).
  const globalBlocking = allFindings.filter((f) => f.harnessId === undefined && f.severity === 'error');
  if (globalBlocking.length > 0) {
    return {
      results: harnessIds.map((harnessId) => ({ harnessId, status: 'blocked', blockingFindings: globalBlocking })),
      exitCode: 1,
    };
  }

  const results: EnableHarnessResult[] = [];
  const newlyEnabled: HarnessId[] = [];

  for (const harnessId of harnessIds) {
    if (alreadyEnabled.includes(harnessId)) {
      results.push({ harnessId, status: 'already-enabled', blockingFindings: [] });
      continue;
    }

    const harnessFindings = allFindings.filter((f) => f.harnessId === harnessId);
    const blocking = harnessFindings.filter((f) => f.severity === 'error' && (!f.forceable || !options.force));

    if (blocking.length > 0) {
      results.push({ harnessId, status: 'blocked', blockingFindings: blocking });
      continue;
    }

    const entry = getHarnessEntry(harnessId);
    if (entry.agentsDoc.mode === 'symlink' || entry.skills.mode === 'migrate-symlink') {
      wireMigrateSymlinkHarness(repoRoot, entry);
    }

    newlyEnabled.push(harnessId);
    results.push({ harnessId, status: 'enabled', blockingFindings: [] });
  }

  if (newlyEnabled.length > 0) {
    saveConfig(repoRoot, [...alreadyEnabled, ...newlyEnabled]);
  }

  const exitCode = results.some((r) => r.status === 'blocked') ? 1 : 0;
  return { results, exitCode };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/commands/enable.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/commands/enable.ts src/commands/enable.test.ts
git commit -m "feat: enable command (native + migrate-symlink harnesses, --force, multi-harness)"
```

---

## Task 21: `migrate` command

**Files:**
- Create: `src/commands/migrate.ts`
- Test: `src/commands/migrate.test.ts`

**Interfaces:**
- Consumes: `copyDirRecursive` (Task 8), `planSkillMigration` (Task 13), `getHarnessEntry` (Task 4).
- Produces: `MigrateCommandResult`, `migrateHarness(repoRoot, harnessId): MigrateCommandResult`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/commands/migrate.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateHarness } from './migrate';

describe('migrateHarness', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-migrate-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('errors for any harness other than claude-code', () => {
    const result = migrateHarness(repoRoot, 'cursor');
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('cursor');
  });

  it('reports nothing to migrate when .claude/skills is empty or absent', () => {
    const result = migrateHarness(repoRoot, 'claude-code');
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('nothing to migrate');
  });

  it('copies a new skill into canon without touching .claude/skills', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'body');
    const result = migrateHarness(repoRoot, 'claude-code');
    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'utf8')).toBe('body');
    expect(existsSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'))).toBe(true);
  });

  it('errors on a collision without copying anything', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'one');
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'two');
    const result = migrateHarness(repoRoot, 'claude-code');
    expect(result.exitCode).toBe(1);
    expect(readFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'utf8')).toBe('two');
  });

  it('is a no-op the second time it runs', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'body');
    migrateHarness(repoRoot, 'claude-code');
    const second = migrateHarness(repoRoot, 'claude-code');
    expect(second.output).toContain('nothing to migrate');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/commands/migrate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/commands/migrate.ts
import { copyDirRecursive } from '../fsutil';
import { planSkillMigration } from '../skills/skillMigrationPlan';
import { getHarnessEntry } from '../registry';
import type { HarnessId } from '../harnesses';

export interface MigrateCommandResult {
  output: string;
  exitCode: number;
}

export function migrateHarness(repoRoot: string, harnessId: HarnessId): MigrateCommandResult {
  const entry = getHarnessEntry(harnessId);
  if (entry.skills.mode !== 'migrate-symlink') {
    return {
      output: `harness-hub migrate: nothing to do for "${harnessId}" — it reads canon natively with no pre-existing content to adopt in this deliverable.`,
      exitCode: 1,
    };
  }

  const plan = planSkillMigration(repoRoot, entry);

  const collisions = plan.filter((e) => e.classification === 'collision');
  if (collisions.length > 0) {
    const lines = collisions.map(
      (e) => `  ${entry.skills.symlinkPath}/${e.name}/SKILL.md differs from .agents/skills/${e.name}/SKILL.md`
    );
    return {
      output: `harness-hub migrate: skill migration collision(s), fix by hand and re-run:\n${lines.join('\n')}`,
      exitCode: 1,
    };
  }

  const toCopy = plan.filter((e) => e.classification === 'new');
  if (toCopy.length === 0) {
    return { output: 'harness-hub migrate: nothing to migrate.', exitCode: 0 };
  }

  for (const planEntry of toCopy) {
    copyDirRecursive(planEntry.harnessSkillPath, planEntry.canonSkillPath);
  }

  return {
    output: `harness-hub migrate: adopted ${toCopy.length} skill(s) into canon: ${toCopy.map((e) => e.name).join(', ')}`,
    exitCode: 0,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/commands/migrate.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/commands/migrate.ts src/commands/migrate.test.ts
git commit -m "feat: migrate command"
```

---

## Task 22: `disable` command

**Files:**
- Create: `src/commands/disable.ts`
- Test: `src/commands/disable.test.ts`

**Interfaces:**
- Consumes: `loadConfig`/`saveConfig` (Task 5), `getHarnessEntry` (Task 4).
- Produces: `DisableCommandResult`, `disableHarnesses(repoRoot, harnessIds): DisableCommandResult`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/commands/disable.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { disableHarnesses } from './disable';
import { saveConfig } from '../config';

describe('disableHarnesses', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-disable-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('removes the claude-code symlinks but keeps canon skills intact', () => {
    writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'body');
    symlinkSync('AGENTS.md', join(repoRoot, 'CLAUDE.md'));
    mkdirSync(join(repoRoot, '.claude'), { recursive: true });
    symlinkSync(join('..', '.agents', 'skills'), join(repoRoot, '.claude', 'skills'));
    saveConfig(repoRoot, ['claude-code']);

    disableHarnesses(repoRoot, ['claude-code']);

    expect(existsSync(join(repoRoot, 'CLAUDE.md'))).toBe(false);
    expect(existsSync(join(repoRoot, '.claude', 'skills'))).toBe(false);
    expect(readFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'utf8')).toBe('body');
  });

  it('removes only the requested harness id from the config', () => {
    saveConfig(repoRoot, ['claude-code', 'cursor']);
    disableHarnesses(repoRoot, ['claude-code']);
    const harnesses = (parseYaml(readFileSync(join(repoRoot, 'harness-hub.yaml'), 'utf8')) as { harnesses: string[] })
      .harnesses;
    expect(harnesses).toEqual(['cursor']);
  });

  it('is a no-op for a harness that was never enabled', () => {
    saveConfig(repoRoot, ['cursor']);
    const result = disableHarnesses(repoRoot, ['hermes']);
    expect(result.exitCode).toBe(0);
    const harnesses = (parseYaml(readFileSync(join(repoRoot, 'harness-hub.yaml'), 'utf8')) as { harnesses: string[] })
      .harnesses;
    expect(harnesses).toEqual(['cursor']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/commands/disable.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/commands/disable.ts
import { existsSync, lstatSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, saveConfig } from '../config';
import { getHarnessEntry } from '../registry';
import type { HarnessId } from '../harnesses';

export interface DisableCommandResult {
  output: string;
  exitCode: number;
}

function removeIfSymlink(path: string): void {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
    rmSync(path, { force: true });
  }
}

export function disableHarnesses(repoRoot: string, harnessIds: HarnessId[]): DisableCommandResult {
  const config = loadConfig(repoRoot);
  const currentlyEnabled = config.status === 'ok' ? config.harnesses : [];
  const remaining = currentlyEnabled.filter((id) => !harnessIds.includes(id));

  for (const harnessId of harnessIds) {
    const entry = getHarnessEntry(harnessId);
    if (entry.agentsDoc.mode === 'symlink' && entry.agentsDoc.symlinkPath) {
      removeIfSymlink(join(repoRoot, entry.agentsDoc.symlinkPath));
    }
    if (entry.skills.mode === 'migrate-symlink' && entry.skills.symlinkPath) {
      removeIfSymlink(join(repoRoot, entry.skills.symlinkPath));
    }
  }

  if (remaining.length !== currentlyEnabled.length) {
    saveConfig(repoRoot, remaining);
  }

  return {
    output: `harness-hub disable: ${harnessIds.join(', ')} disabled.`,
    exitCode: 0,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/commands/disable.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/commands/disable.ts src/commands/disable.test.ts
git commit -m "feat: disable command"
```

---

## Task 23: CLI wiring + bin entry

**Files:**
- Create: `src/cli.ts`
- Create: `src/bin.ts`
- Test: `src/cli.test.ts`

**Interfaces:**
- Consumes: `findRepoRoot` (Task 2), `isHarnessId`/`HarnessId` (Task 3), `enableHarnesses` (Task 20), `disableHarnesses` (Task 22), `migrateHarness` (Task 21), `runDoctorCommand` (Task 18), `getPackageVersion` (Task 1).
- Produces: `main(argv: string[]): Promise<number>` — the only export `bin.ts` calls.

This is the final integration point: it exercises every module built in Tasks 1–22 together, through the same entry point real users hit.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/cli.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from './cli';

describe('cli main()', () => {
  let repoRoot: string;
  let originalCwd: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-cli-'));
    mkdirSync(join(repoRoot, '.git'));
    writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
    originalCwd = process.cwd();
    process.chdir(repoRoot);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(repoRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('doctor exits 0 for a minimal valid repo', async () => {
    expect(await main(['doctor'])).toBe(0);
  });

  it('enable writes harness-hub.yaml for a native harness', async () => {
    expect(await main(['enable', 'cursor'])).toBe(0);
    expect(existsSync(join(repoRoot, 'harness-hub.yaml'))).toBe(true);
  });

  it('enable then disable claude-code round-trips cleanly', async () => {
    expect(await main(['enable', 'claude-code'])).toBe(0);
    expect(existsSync(join(repoRoot, 'CLAUDE.md'))).toBe(true);
    expect(await main(['disable', 'claude-code'])).toBe(0);
    expect(existsSync(join(repoRoot, 'CLAUDE.md'))).toBe(false);
  });

  it('rejects an unrecognized harness id', async () => {
    expect(await main(['enable', 'not-a-harness'])).toBe(1);
  });

  it('migrate reports nothing to migrate for a clean claude-code repo', async () => {
    expect(await main(['migrate', 'claude-code'])).toBe(0);
  });

  it('fails clearly outside a git repo', async () => {
    const nonRepo = mkdtempSync(join(tmpdir(), 'hh-nonrepo-'));
    process.chdir(nonRepo);
    expect(await main(['doctor'])).toBe(1);
    rmSync(nonRepo, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/cli.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `cli.ts`**

```typescript
// src/cli.ts
import { Command } from 'commander';
import { findRepoRoot } from './repo';
import { isHarnessId, type HarnessId } from './harnesses';
import { enableHarnesses } from './commands/enable';
import { disableHarnesses } from './commands/disable';
import { migrateHarness } from './commands/migrate';
import { runDoctorCommand } from './commands/doctor';
import { getPackageVersion } from './version';

function parseHarnessIds(values: string[]): HarnessId[] {
  const invalid = values.filter((v) => !isHarnessId(v));
  if (invalid.length > 0) {
    throw new Error(`Unrecognized harness id(s): ${invalid.join(', ')}`);
  }
  return values as HarnessId[];
}

export async function main(argv: string[]): Promise<number> {
  let exitCode = 0;
  const program = new Command();
  program.name('harness-hub').version(getPackageVersion()).exitOverride();

  program
    .command('enable <harnesses...>')
    .option('--force', 'overwrite clobber-risk findings (CLAUDE.md, .claude/skills symlink target)')
    .action((harnesses: string[], opts: { force?: boolean }) => {
      const repoRoot = findRepoRoot(process.cwd());
      const harnessIds = parseHarnessIds(harnesses);
      const result = enableHarnesses(repoRoot, harnessIds, { force: opts.force });
      for (const r of result.results) {
        if (r.status === 'blocked') {
          console.error(`harness-hub enable ${r.harnessId}: blocked`);
          for (const f of r.blockingFindings) {
            console.error(`  [${f.severity.toUpperCase()}] ${f.message}\n  \u2192 ${f.remediation}`);
          }
        } else {
          console.log(`harness-hub enable ${r.harnessId}: ${r.status}`);
        }
      }
      exitCode = result.exitCode;
    });

  program.command('disable <harnesses...>').action((harnesses: string[]) => {
    const repoRoot = findRepoRoot(process.cwd());
    const harnessIds = parseHarnessIds(harnesses);
    const result = disableHarnesses(repoRoot, harnessIds);
    console.log(result.output);
    exitCode = result.exitCode;
  });

  program.command('migrate <harness>').action((harness: string) => {
    const repoRoot = findRepoRoot(process.cwd());
    const [harnessId] = parseHarnessIds([harness]);
    const result = migrateHarness(repoRoot, harnessId);
    console.log(result.output);
    exitCode = result.exitCode;
  });

  program.command('doctor').action(() => {
    const repoRoot = findRepoRoot(process.cwd());
    const result = runDoctorCommand(repoRoot);
    console.log(result.output);
    exitCode = result.exitCode;
  });

  try {
    await program.parseAsync(argv, { from: 'user' });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code;
      if (code === 'commander.helpDisplayed' || code === 'commander.version') {
        return 0;
      }
    }
    if (err instanceof Error) console.error(err.message);
    return exitCode || 1;
  }

  return exitCode;
}
```

- [ ] **Step 4: Implement `bin.ts`**

```typescript
#!/usr/bin/env node
// src/bin.ts
import { main } from './cli';

main(process.argv.slice(2)).then(
  (exitCode) => process.exit(exitCode),
  (err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/cli.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS — every test file from Tasks 1–23 green.

- [ ] **Step 7: Build and manually smoke-test the compiled CLI**

```bash
npm run build
cd "$(mktemp -d)"
git init -q
echo '# Agents' > AGENTS.md
node /path/to/harness-hub/dist/bin.js doctor
echo "exit code: $?"
node /path/to/harness-hub/dist/bin.js enable cursor
cat harness-hub.yaml
```

Expected: `doctor` prints "no issues found" and exits 0; `enable cursor` prints `harness-hub enable cursor: enabled` and `harness-hub.yaml` contains `harnesses:\n  - cursor`.

- [ ] **Step 8: Commit**

```bash
git add src/cli.ts src/bin.ts src/cli.test.ts
git commit -m "feat: CLI wiring (enable/disable/migrate/doctor) + bin entry"
```

---

## Self-Review Notes (for whoever executes this plan)

- **Spec coverage:** §1 (promises) — Tasks 20–22. §2 (scope) — Global Constraints + registry data (Task 4) enforces the "seven harnesses, migrate scoped to claude-code" boundary. §3 (canon layout) — Task 6. §4 (config) — Task 5. §5/§6 (wiring tables) — Tasks 4, 19, 20, 22. §7 (frontmatter) — Task 7. §8 (CLI surface) — Tasks 20–23. §9 (doctor checks, all 9 named checks across 8 rule modules) — Tasks 10, 11, 12, 14, 15, 16, assembled in 17. §10 (safety) — enforced by Tasks 12, 14, 15, 20 together (non-forceable findings, symlink-only artifacts, canon-additive-only `migrate`). §11 (non-goals) — no tasks; nothing implemented for them, by design.
- **Registry-driven architecture:** Tasks 12, 14, 15, 16, 19, 20, 21, 22 all read harness behavior from the Task 4 registry rather than hardcoding `if (harnessId === 'claude-code')` checks (except where the spec's actual command surface names a harness explicitly, e.g. CLI help text). Adding a second migrate-symlink or trust-gated harness in the future is a registry data change plus a new `migrate`/wiring case in the two spots that still branch on mode (Tasks 20–22) — not a new doctor rule.
- **Untested by design:** `src/bin.ts` (Task 23) is an intentionally thin shebang wrapper, verified by the manual smoke test in Task 23 Step 7 rather than a unit test.
