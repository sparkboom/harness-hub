# harness-hub Playground & Test-Fixture Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a consumer-repo playground plus reusable test-fixture tooling (scenario generator, detection, probe), a machine-readable harness-versions manifest, a nix devShell pinning the researched harness versions, `harness-hub list`/`info` commands, and specific finding-id renames.

**Architecture:** A committed `tools/` TypeScript package (compiled separately, excluded from the npm package) holds the generator/detection/probe logic, layered on importable primitives. A root `harness-versions.json` is the single source of truth for harness versions, consumed by the runtime registry (`src/registry/data.ts`), the tools, and the nix flake. The playground is a git-ignored folder with its own nested `.git` so `harness-hub` resolves it as a consumer repo.

**Tech Stack:** TypeScript (CommonJS), Node ≥ 22.12.0, Vitest, commander, yaml, gray-matter, nix flakes.

**Spec:** [`harness-hub-playground.spec.md`](./harness-hub-playground.spec.md) — the plan argues from this spec; read both together.

## Global Constraints

- Node `>=22.12.0` (from `package.json` `engines`).
- TypeScript `^7.0.2`, Vitest `^5.0.1`, commander `^15.0.0`, yaml `^2.9.1`, gray-matter `^4.0.3` (existing deps — do not add runtime deps).
- Harness ids are the 7 values in `src/harnesses.ts` (`claude-code`, `cursor`, `opencode`, `codex`, `hermes`, `pi`, `deepseek`); `enable`/`disable`/`info` take harness ids, never skill names.
- Naming conventions (spec R2b/R10): finding `ruleId`s are **specific** (one per failure condition), harness-scoped findings are prefixed with the harness id; scenario names mirror the finding `ruleId`. Rule object `id` values are **unchanged**.
- `tools/` is excluded from the published npm package; `harness-versions.json` is **included** (the runtime reads it at module load).
- `playground/` stays git-ignored; nothing under it is ever committed. `tools/dist/` is build output and must be git-ignored.
- The nix devShell prerequisite applies **only** to the playground and future integration tests — never to general `harness-hub` users (spec R9).

---

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

### Task 2: Specific finding-id renames (R10)

**Files:**
- Modify: `src/doctor/rules/clobberRisk.ts`, `configValidity.ts`, `skillShape.ts`, `skillFrontmatter.ts`, `generatedFileDrift.ts`
- Modify: `src/commands/enable.ts`, `src/cli.ts`, `src/commands/migrate.ts`, `src/wiring/migrateSymlink.ts` (comment only)
- Test: `src/doctor/rules/generatedFileDrift.test.ts`, `src/commands/enable.test.ts`, `src/doctor/rules/clobberRisk.test.ts`, `src/doctor/rules/configValidity.test.ts`, `src/doctor/rules/skillShape.test.ts`, `src/doctor/rules/skillFrontmatter.test.ts`

**Interfaces:**
- Produces: finding `ruleId` values `claude-md-clobber`, `claude-skills-clobber`, `config-ambiguous`, `config-parse-error`, `config-invalid-shape`, `config-unknown-harness-id`, `skill-flat-file`, `skill-missing-skill-md`, `skill-missing-name`, `skill-invalid-name-format`, `skill-name-mismatch`, `skill-missing-description`, `skill-description-length`, `claude-drift`. Rule `id` values unchanged. `enable.ts` drift check now matches `'claude-drift'`.

- [ ] **Step 1: Update the two tests that already assert ruleId strings (RED)**

In `src/doctor/rules/generatedFileDrift.test.ts`, change the assertion:

```ts
expect.objectContaining({ ruleId: 'claude-drift', severity: 'warning', harnessId: 'claude-code' }),
```

In `src/commands/enable.test.ts`, change both `blockingFindings[0].ruleId` assertions from `'clobber-risk'` to `'claude-md-clobber'` (the "hand-written CLAUDE.md without --force" test and the "does not clobber a foreign file on drift-repair" test).

- [ ] **Step 2: Add specific-ruleId assertions to the rule tests (RED)**

In `src/doctor/rules/clobberRisk.test.ts`, add to the "flags a hand-written CLAUDE.md" test:

```ts
expect(findings.some((f) => f.ruleId === 'claude-md-clobber')).toBe(true);
```

and to the "flags a .claude/skills symlink pointing elsewhere" test:

```ts
expect(findings.some((f) => f.ruleId === 'claude-skills-clobber')).toBe(true);
```

In `src/doctor/rules/configValidity.test.ts`, add per-case ruleId assertions:
- unknown ids → `config-unknown-harness-id`
- ambiguous → `config-ambiguous`
- parse error → `config-parse-error`
- invalid shape → `config-invalid-shape`

In `src/doctor/rules/skillShape.test.ts`, assert the flat-file case emits `skill-flat-file` and the missing-SKILL.md case emits `skill-missing-skill-md`.

In `src/doctor/rules/skillFrontmatter.test.ts`, assert the name/dir mismatch case emits `skill-name-mismatch`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/doctor/rules src/commands/enable.test.ts`
Expected: FAIL — source still emits the old `ruleId` strings.

- [ ] **Step 4: Apply the renames in the rule source**

`clobberRisk.ts`: agents-doc branch → `ruleId: 'claude-md-clobber'`; skills branch → `ruleId: 'claude-skills-clobber'`.

`configValidity.ts`: map the four branches to `config-ambiguous`, `config-parse-error`, `config-invalid-shape`, `config-unknown-harness-id` (respectively: the `ambiguous` case, `parse-error` case, `invalid-shape` case, and the `ok`-with-`unknownIds` case).

`skillShape.ts`: flat-file branch → `ruleId: 'skill-flat-file'`; missing-SKILL.md branch → `ruleId: 'skill-missing-skill-md'`.

`skillFrontmatter.ts`: add a code→ruleId map and set `ruleId` from `issue.code`:

```ts
const CODE_TO_RULE_ID: Record<string, string> = {
  'missing-name': 'skill-missing-name',
  'invalid-name-format': 'skill-invalid-name-format',
  'name-mismatch': 'skill-name-mismatch',
  'missing-description': 'skill-missing-description',
  'description-length': 'skill-description-length',
};

// inside the loop, replace the literal with:
ruleId: CODE_TO_RULE_ID[issue.code] ?? 'skill-frontmatter',
```

`generatedFileDrift.ts`: `ruleId: 'generated-file-drift'` → `'claude-drift'`.

- [ ] **Step 5: Update the string-match consumers**

`src/commands/enable.ts` (drift check):

```ts
const drifted = harnessFindings.some((f) => f.ruleId === 'claude-drift' && f.severity === 'warning');
```

`src/cli.ts` (`--force` help text):

```ts
.option('--force', 'overwrite clobber findings (CLAUDE.md, .claude/skills symlink target)')
```

`src/commands/migrate.ts` (error prose): change `clobber-risk — refusing to adopt invalid skill(s)` to `invalid skill — refusing to adopt invalid skill(s)`.

`src/wiring/migrateSymlink.ts`: update the doc comment listing `(clobber-risk, …)` to `(claude-md-clobber, claude-skills-clobber, …)`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS (full suite — the renames touch rule ids used across `enable`/`migrate` tests).

- [ ] **Step 7: Commit**

```bash
git add src/doctor src/commands src/wiring src/cli.ts
git commit -m "refactor: rename finding ruleIds to be failure-specific"
```

---

### Task 3: `harness-hub list` and `harness-hub info` (R8)

**Files:**
- Create: `src/commands/list.ts`, `src/commands/info.ts`
- Modify: `src/cli.ts`
- Test: `src/commands/list.test.ts`, `src/commands/info.test.ts`

**Interfaces:**
- Consumes: `getHarnessEntry` (from `../registry`), `ALL_HARNESS_IDS` (from `../harnesses`), `isHarnessId`.
- Produces: `formatList(): string`, `formatInfo(id: HarnessId): string`, `infoHarness(id: string): { output: string; exitCode: number }`.

- [ ] **Step 1: Write the failing tests**

Create `src/commands/list.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ALL_HARNESS_IDS } from '../harnesses';
import { formatList } from './list';

describe('formatList', () => {
  it('names every harness id', () => {
    const out = formatList();
    for (const id of ALL_HARNESS_IDS) expect(out).toContain(id);
  });

  it('shows each harness version', () => {
    const out = formatList();
    expect(out).toContain('2.1.272'); // claude-code
    expect(out).toContain('1.18.31'); // opencode
  });

  it('is sorted by harness id', () => {
    const ids = ALL_HARNESS_IDS.map((id) => formatList().indexOf(id));
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
  });
});
```

Create `src/commands/info.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatInfo, infoHarness } from './info';

describe('infoHarness', () => {
  it('returns detail for a known harness', () => {
    const out = formatInfo('claude-code');
    expect(out).toContain('claude-code');
    expect(out).toContain('CLAUDE.md');
    expect(out).toContain('.claude/skills');
  });

  it('returns exit 1 for an unknown id, naming the valid ids', () => {
    const result = infoHarness('bogus');
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('bogus');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/commands/list.test.ts src/commands/info.test.ts`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement `formatList`**

Create `src/commands/list.ts`:

```ts
import { ALL_HARNESS_IDS } from '../harnesses';
import { getHarnessEntry } from '../registry';

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

export function formatList(): string {
  const rows = [...ALL_HARNESS_IDS].map((id) => {
    const e = getHarnessEntry(id);
    const skills = e.skills.mode === 'migrate-symlink' ? 'migrate-symlink' : e.skills.mode;
    return [
      pad(e.id, 12),
      pad(e.displayName, 18),
      pad(e.verifiedVersion, 12),
      pad(e.agentsDoc.mode, 12),
      skills,
    ].join(' ');
  });
  return [
    `${pad('ID', 12)}${pad('NAME', 18)}${pad('VERSION', 12)}${pad('AGENT DOC', 12)}SKILLS`,
    ...rows,
  ].join('\n');
}
```

- [ ] **Step 4: Implement `formatInfo` / `infoHarness`**

Create `src/commands/info.ts`:

```ts
import { isHarnessId, type HarnessId } from '../harnesses';
import { getHarnessEntry } from '../registry';

export function formatInfo(id: HarnessId): string {
  const e = getHarnessEntry(id);
  const lines = [`${e.displayName} (${e.id})`, `  version: ${e.verifiedVersion} (verified ${e.verifiedDate})`];
  if (e.agentsDoc.mode === 'symlink' && e.agentsDoc.symlinkPath) {
    lines.push(`  agent doc: symlink -> ${e.agentsDoc.symlinkPath}`);
  } else {
    lines.push(`  agent doc: native (reads AGENTS.md)`);
  }
  if (e.skills.mode === 'migrate-symlink' && e.skills.symlinkPath) {
    lines.push(`  skills: migrate-symlink -> ${e.skills.symlinkPath}`);
  } else {
    lines.push(`  skills: native (reads .agents/skills/)`);
  }
  if (e.skills.trustGate) {
    lines.push(`  trust gate: ${e.skills.trustGate.trustCommand}`);
    lines.push(`  trust ledger: ~/${e.skills.trustGate.configPathFromHome}`);
  }
  return lines.join('\n');
}

export function infoHarness(id: string): { output: string; exitCode: number } {
  if (!isHarnessId(id)) {
    return {
      output: `harness-hub info: unrecognized harness id "${id}" (valid: claude-code, cursor, opencode, codex, hermes, pi, deepseek)`,
      exitCode: 1,
    };
  }
  return { output: formatInfo(id), exitCode: 0 };
}
```

- [ ] **Step 5: Wire into the CLI**

In `src/cli.ts`, add two `program.command(...)` entries after `doctor`:

```ts
program.command('list').action(() => {
  console.log(formatList());
});

program.command('info <harness>').action((harness: string) => {
  const result = infoHarness(harness);
  console.log(result.output);
  exitCode = result.exitCode;
});
```

and add the imports for `formatList` and `infoHarness`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/commands/list.test.ts src/commands/info.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/commands/list.ts src/commands/info.ts src/commands/list.test.ts src/commands/info.test.ts src/cli.ts
git commit -m "feat: add harness-hub list and info commands"
```

---

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

### Task 5: scenario generator + scenarios (R2, R2b)

**Files:**
- Create: `tools/scenarios/shared.ts`, `tools/scenarios/index.ts`, and one module per scenario under `tools/scenarios/`
- Create: `tools/generate.ts`, `tools/generate.mjs`
- Test: `tools/generate.test.ts`

**Interfaces:**
- Consumes: `Asset`, `agentDoc`, `skill`, `raw` (Task 4); `writeAssets`, `resetTarget` (Task 4).
- Produces: `Scenario = { name: string; description: string; assets(target: string): Asset[]; actions?(target: string): void }`; `SCENARIOS: Record<string, Scenario>`; `generateScenario(target: string, name: string): void`; `main(argv: string[]): Promise<number>`.

- [ ] **Step 1: Write the failing test**

Create `tools/generate.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SCENARIOS } from './scenarios';
import { generateScenario } from './generate';

describe('scenario generator', () => {
  let target: string;
  beforeEach(() => { target = mkdtempSync(join(tmpdir(), 'hh-gen-')); });
  afterEach(() => { rmSync(target, { recursive: true, force: true }); });

  it('every scenario is named and has a description', () => {
    for (const s of Object.values(SCENARIOS)) {
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
    }
  });

  it('baseline renders AGENTS.md and one valid skill', () => {
    generateScenario(target, 'baseline');
    expect(existsSync(join(target, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(target, '.agents', 'skills', 'writing-tests', 'SKILL.md'))).toBe(true);
  });

  it('claude-md-clobber renders a hand-written CLAUDE.md', () => {
    generateScenario(target, 'claude-md-clobber');
    expect(readFileSync(join(target, 'CLAUDE.md'), 'utf8')).toContain('hand-written');
  });

  it('missing-agents-md renders no AGENTS.md', () => {
    generateScenario(target, 'missing-agents-md');
    expect(existsSync(join(target, 'AGENTS.md'))).toBe(false);
  });

  it('rejects an unknown scenario naming the available ones', () => {
    expect(() => generateScenario(target, 'nope')).toThrow(/Unknown scenario/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tools/generate.test.ts`
Expected: FAIL — `tools/scenarios` does not exist.

- [ ] **Step 3: Implement shared canon assets**

Create `tools/scenarios/shared.ts`:

```ts
import { agentDoc, skill, raw, type Asset } from '../primitives';

export function validAgentsDoc(): Asset {
  return agentDoc('AGENTS.md', '# Agents\n\nMinimal consumer-repo agent doc for harness-hub testing.\n');
}

export function validSkill(): Asset {
  return skill({
    name: 'writing-tests',
    location: '.agents/skills',
    frontmatter: { name: 'writing-tests', description: 'Write failing tests before implementation.' },
    body: 'Write the failing test first.\n',
  });
}

export function harnessConfig(harnesses: string[]): Asset {
  return raw('harness-hub.yaml', `harnesses:\n${harnesses.map((h) => `  - ${h}`).join('\n')}\n`);
}
```

- [ ] **Step 4: Implement each scenario module**

Create one module per scenario. Representative implementations (the rest follow the same pattern with the asset lists below):

`tools/scenarios/baseline.ts`:

```ts
import type { Scenario } from './index';
import { validAgentsDoc, validSkill } from './shared';

export const baseline: Scenario = {
  name: 'baseline',
  description: 'Valid canon (AGENTS.md + a valid skill), nothing wired — doctor finds nothing.',
  assets: () => [validAgentsDoc(), validSkill()],
};
```

`tools/scenarios/claude-md-clobber.ts`:

```ts
import { raw } from '../primitives';
import type { Scenario } from './index';
import { validAgentsDoc, validSkill } from './shared';

export const claudeMdClobber: Scenario = {
  name: 'claude-md-clobber',
  description: 'Hand-written CLAUDE.md blocks `enable claude-code` (clobber-risk → claude-md-clobber).',
  assets: () => [validAgentsDoc(), validSkill(), raw('CLAUDE.md', '# hand-written\n')],
};
```

`tools/scenarios/claude-drift.ts`:

```ts
import { mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { Scenario } from './index';
import { validAgentsDoc, validSkill } from './shared';

export const claudeDrift: Scenario = {
  name: 'claude-drift',
  description: 'Wired claude-code whose CLAUDE.md symlink is then removed (generated-file-drift → claude-drift).',
  assets: () => [validAgentsDoc(), validSkill()],
  actions: (target) => {
    symlinkSync('AGENTS.md', join(target, 'CLAUDE.md'));
    mkdirSync(join(target, '.claude'), { recursive: true });
    symlinkSync(join('..', '.agents', 'skills'), join(target, '.claude', 'skills'));
    rmSync(join(target, 'CLAUDE.md')); // introduce drift
  },
};
```

The remaining scenario modules, each exporting a `Scenario` with the listed asset composition (all use `validAgentsDoc`/`validSkill`/`raw`/`harnessConfig` from `shared.ts` and primitives):

- `missing-agents-md` — `assets: () => [validSkill()]` (no `AGENTS.md`).
- `ambiguous-config` — `[validAgentsDoc(), validSkill(), harnessConfig([]), raw('harness-hub.json', '{"harnesses":[]}\n')]`.
- `config-invalid-shape` — `[validAgentsDoc(), raw('harness-hub.yaml', 'foo: bar\n')]`.
- `config-parse-error` — `[validAgentsDoc(), raw('harness-hub.yaml', 'harnesses: [unclosed\n')]`.
- `unknown-harness-id` — `[validAgentsDoc(), harnessConfig(['bogus'])]`.
- `flat-skill-file` — `[validAgentsDoc(), raw('.agents/skills/stray.md', '# stray\n')]`.
- `skill-missing-skill-md` — `[validAgentsDoc(), raw('.agents/skills/empty/notes.txt', 'not a skill\n')]` (a dir with no `SKILL.md`).
- `skill-missing-name` — `[validAgentsDoc(), skill({ name: 'anon', location: '.agents/skills', frontmatter: { description: 'x' } })]`.
- `skill-name-mismatch` — `[validAgentsDoc(), skill({ name: 'writing-tests', location: '.agents/skills', frontmatter: { name: 'other', description: 'x' } })]`.
- `skill-missing-description` — `[validAgentsDoc(), skill({ name: 'writing-tests', location: '.agents/skills', frontmatter: { name: 'writing-tests' } })]`.
- `claude-enable` — `[validAgentsDoc(), validSkill()]`; description notes "run `harness-hub enable claude-code`".
- `claude-skills-clobber` — `[validAgentsDoc(), validSkill()]` plus an `actions` that creates `.claude/skills` as a symlink to `/somewhere/else` (mirrors the clobberRisk test fixture).
- `unmigrated-skills` — `[validAgentsDoc(), validSkill(), raw('.claude/skills/a/SKILL.md', 'body\n')]`.
- `skill-migration-collision` — `[validAgentsDoc(), validSkill(), raw('.claude/skills/writing-tests/SKILL.md', '---\nname: writing-tests\ndescription: x\n---\ndifferent\n')]`.
- `hermes-trust` — `[validAgentsDoc(), validSkill()]`; description notes "run `harness-hub enable hermes` (trust-gate → hermes-trust)".
- `multi` — `[validAgentsDoc(), validSkill()]`; description notes "enable several harnesses".

- [ ] **Step 5: Implement the scenario registry**

Create `tools/scenarios/index.ts`:

```ts
import type { Asset } from '../primitives';

export interface Scenario {
  name: string;
  description: string;
  assets(target: string): Asset[];
  actions?(target: string): void;
}

import { baseline } from './baseline';
import { claudeEnable } from './claude-enable';
import { claudeMdClobber } from './claude-md-clobber';
import { claudeSkillsClobber } from './claude-skills-clobber';
import { claudeDrift } from './claude-drift';
import { missingAgentsMd } from './missing-agents-md';
import { ambiguousConfig } from './ambiguous-config';
import { configInvalidShape } from './config-invalid-shape';
import { configParseError } from './config-parse-error';
import { unknownHarnessId } from './unknown-harness-id';
import { flatSkillFile } from './flat-skill-file';
import { skillMissingSkillMd } from './skill-missing-skill-md';
import { skillMissingName } from './skill-missing-name';
import { skillNameMismatch } from './skill-name-mismatch';
import { skillMissingDescription } from './skill-missing-description';
import { unmigratedSkills } from './unmigrated-skills';
import { skillMigrationCollision } from './skill-migration-collision';
import { hermesTrust } from './hermes-trust';
import { multi } from './multi';

export const SCENARIOS: Record<string, Scenario> = {
  baseline, 'claude-enable': claudeEnable, 'claude-md-clobber': claudeMdClobber,
  'claude-skills-clobber': claudeSkillsClobber, 'claude-drift': claudeDrift,
  'missing-agents-md': missingAgentsMd, 'ambiguous-config': ambiguousConfig,
  'config-invalid-shape': configInvalidShape, 'config-parse-error': configParseError,
  'unknown-harness-id': unknownHarnessId, 'flat-skill-file': flatSkillFile,
  'skill-missing-skill-md': skillMissingSkillMd, 'skill-missing-name': skillMissingName,
  'skill-name-mismatch': skillNameMismatch, 'skill-missing-description': skillMissingDescription,
  'unmigrated-skills': unmigratedSkills, 'skill-migration-collision': skillMigrationCollision,
  'hermes-trust': hermesTrust, multi,
};
```

- [ ] **Step 6: Implement the generator core + CLI**

Create `tools/generate.ts`:

```ts
import { writeAssets, resetTarget } from './fs';
import { SCENARIOS } from './scenarios';

export function generateScenario(target: string, name: string): void {
  const scenario = SCENARIOS[name];
  if (!scenario) {
    throw new Error(`Unknown scenario "${name}". Available: ${Object.keys(SCENARIOS).join(', ')}`);
  }
  resetTarget(target);
  writeAssets(target, scenario.assets(target));
  scenario.actions?.(target);
}

export function parseArgs(argv: string[]): { target: string; scenario: string } {
  let target = process.cwd();
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--target') { target = argv[++i]; }
    else if (argv[i].startsWith('--target=')) { target = argv[i].slice('--target='.length); }
    else { positional.push(argv[i]); }
  }
  if (positional.length !== 1) {
    throw new Error('Usage: generate <scenario> [--target <dir>]');
  }
  return { scenario: positional[0], target };
}

export async function main(argv: string[]): Promise<number> {
  try {
    const { target, scenario } = parseArgs(argv);
    generateScenario(target, scenario);
    console.log(`generated "${scenario}" into ${target}`);
    return 0;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
```

Create `tools/generate.mjs` (thin entrypoint):

```js
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, 'dist', 'generate.js');
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

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tools/generate.test.ts tools/primitives.test.ts`
Expected: PASS. (The `.mjs` shim is not unit-tested; verify manually in Task 9 after a `build:tools`.)

- [ ] **Step 8: Commit**

```bash
git add tools/scenarios tools/generate.ts tools/generate.mjs tools/generate.test.ts
git commit -m "feat: add declarative scenario generator"
```

---

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

### Task 7: probe tooling (R4)

**Files:**
- Create: `tools/probe.ts`, `tools/probe.mjs`, `tools/probe.test.ts`

**Interfaces:**
- Consumes: `loadManifest` (Task 6), `resolveBinary`/`runVersion` (Task 6).
- Produces: `probeHarness(id: string, repoRoot: string, run?: ProbeRunner): { exitCode: number; output: string }`; `main(argv: string[]): Promise<number>`.

- [ ] **Step 1: Write the failing test**

Create `tools/probe.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { probeHarness, PROBE_COMMANDS } from './probe';

describe('probe', () => {
  it('skips a missing harness with a clear message', () => {
    const result = probeHarness('codex', '/repo', () => { throw new Error('not installed'); });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('not installed');
  });

  it('has a probe command for every harness id', () => {
    for (const id of ['claude-code', 'cursor', 'opencode', 'codex', 'hermes', 'pi', 'deepseek']) {
      expect(PROBE_COMMANDS[id]).toBeDefined();
    }
  });

  it('runs the headless agent form for cursor with --workspace', () => {
    let captured: string[] = [];
    probeHarness('cursor', '/repo', (spec) => { captured = spec.args; return ''; });
    expect(captured).toContain('--workspace');
    expect(captured).toContain('/repo');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tools/probe.test.ts`
Expected: FAIL — `tools/probe` does not exist.

- [ ] **Step 3: Implement probe**

Create `tools/probe.ts`:

```ts
import { spawnSync } from 'node:child_process';
import { resolveBinary } from './detect';

export interface ProbeSpec {
  cmd: string;
  args: string[];
}

// First-cut headless invocations. The four well-documented harnesses use their
// scripted modes; hermes/pi/deepseek use their most likely `run`/`-p` forms
// and are confirmed by running this tool itself (spec R4 — probe is the
// verification aid).
export const PROBE_COMMANDS: Record<string, (repoRoot: string) => ProbeSpec> = {
  'claude-code': () => ({ cmd: 'claude', args: ['-p', 'List the skills available in this repo and summarize AGENTS.md.'] }),
  cursor: (root) => ({ cmd: 'agent', args: ['-p', 'List your skills and summarize AGENTS.md.', '--mode', 'ask', '--trust', '--workspace', root] }),
  opencode: () => ({ cmd: 'opencode', args: ['run', 'List the skills available in this repo and summarize AGENTS.md.'] }),
  codex: () => ({ cmd: 'codex', args: ['exec', 'List the skills available in this repo and summarize AGENTS.md.'] }),
  hermes: () => ({ cmd: 'hermes', args: ['run', 'List the skills available in this repo and summarize AGENTS.md.'] }),
  pi: () => ({ cmd: 'pi', args: ['-p', 'List the skills available in this repo and summarize AGENTS.md.'] }),
  deepseek: () => ({ cmd: 'dsh', args: ['run', 'List the skills available in this repo and summarize AGENTS.md.'] }),
};

export type ProbeRunner = (spec: ProbeSpec) => string;

function defaultRunner(spec: ProbeSpec): string {
  const r = spawnSync(spec.cmd, spec.args, { encoding: 'utf8', stdio: 'inherit', timeout: 120000 });
  return r.error ? r.error.message : '';
}

export function probeHarness(
  id: string,
  repoRoot: string,
  run: ProbeRunner = defaultRunner
): { exitCode: number; output: string } {
  const make = PROBE_COMMANDS[id];
  if (!make) {
    return { exitCode: 1, output: `probe: unrecognized harness id "${id}".` };
  }
  const binary = resolveBinary(id);
  if (!binary) {
    return { exitCode: 1, output: `probe: ${id} is not installed (run detect to see the roster).` };
  }
  const spec = make(repoRoot);
  const err = run(spec);
  if (err) {
    return { exitCode: 1, output: `probe: ${id} failed: ${err}` };
  }
  return { exitCode: 0, output: `probe: ${id} ran (${spec.cmd} ${spec.args.join(' ')}).` };
}

export async function main(argv: string[]): Promise<number> {
  if (argv.length !== 1) {
    console.error('Usage: probe <harness-id>');
    return 1;
  }
  const result = probeHarness(argv[0], process.cwd());
  if (result.output) console.log(result.output);
  return result.exitCode;
}
```

Note: the `defaultRunner` uses `stdio: 'inherit'` so real harness output streams to the terminal — that is the whole point of probe. The test injects a stub runner and never calls `defaultRunner`.

- [ ] **Step 4: Add the thin entrypoint**

Create `tools/probe.mjs` (same shape as `detect.mjs`, but `dist/probe.js`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tools/probe.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/probe.ts tools/probe.mjs tools/probe.test.ts
git commit -m "feat: add harness probe tooling"
```

---

### Task 8: nix flake (R5)

**Files:**
- Create: `flake.nix`

**Interfaces:**
- Consumes: `harness-versions.json` (read via `builtins.fromJSON`).
- Produces: `devShells.default` with `nodejs_22`, `git`, `curl`, and the npm-installable harnesses at their pinned versions; Cursor via an FHS wrapper (or detection-only if the wrapper fails).

- [ ] **Step 1: Write the flake structure**

Create `flake.nix`:

```nix
{
  description = "harness-hub playground dev shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      system = "aarch64-darwin";
      pkgs = import nixpkgs { inherit system; };
      versions = builtins.fromJSON (builtins.readFile ./harness-versions.json);

      # Build an npm-distributed harness at its pinned version.
      mkNpmHarness = pname: version: pkgs.buildNpmPackage {
        inherit pname version;
        src = pkgs.fetchurl {
          url = "https://registry.npmjs.org/${pname}/-/${builtins.baseNameOf pname}-${version}.tgz";
          sha256 = pkgs.lib.fakeSha256; # filled by `nix develop` first run (see Step 2)
        };
        npmDepsHash = pkgs.lib.fakeSha256; # filled the same way
        dontNpmBuild = true;
      };

      # Cursor headless `agent` CLI via a Community FHS wrapper (spec R5/R9 —
      # provisional; if this proves unreliable, cursor is detection-only).
      cursorFhs = pkgs.buildFHSUserEnv {
        name = "cursor-agent-fhs";
        targetPkgs = _: with pkgs; [ curl cacert bash ];
        runScript = ''
          curl -fsSL https://cursor.com/install | bash
        '';
      };
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        buildInputs = with pkgs; [
          nodejs_22 git curl cacert
          (mkNpmHarness "@anthropic-ai/claude-code" versions."claude-code".version)
          (mkNpmHarness "opencode-ai" versions.opencode.version)
          (mkNpmHarness "@openai/codex" versions.codex.version)
          (mkNpmHarness "hermes-agent" versions.hermes.version)
          (mkNpmHarness "@mariozechner/pi-coding-agent" versions.pi.version)
          (mkNpmHarness "@deepseek-ai/dsh" versions.deepseek.version)
        ];
        shellHook = ''
          echo "harness-hub playground shell — run \`detect\` to see the pinned harnesses."
        '';
      };
    };
}
```

This is a **first cut**: the exact npm tarball URL shape, `dontNpmBuild` flag, and per-package `npmDepsHash` vary by package (some harness packages are prebuilt binaries that `buildNpmPackage` will mis-handle; those need a `buildNpmPackage`→`runCommand` swap or a pinned binary fetch). The manifest read and the shell structure are correct; the per-package provisioning is settled by the loop in Step 2, not guessed here.

- [ ] **Step 2: Build loop to fill hashes and fix per-package quirks**

Run: `nix develop`
Expected on first run: nix reports the correct `sha256`/`npmDepsHash` for each fetch. Paste them over `pkgs.lib.fakeSha256` and re-run until the shell enters. For any package `buildNpmPackage` can't build (prebuilt binaries), replace that `mkNpmHarness` call with a `runCommand` that downloads the platform binary and installs it to `$out/bin`; note the substitution in the flake.

- [ ] **Step 3: Verify the shell yields the pinned harnesses**

Run: `nix develop -c node tools/detect.mjs` (after `npm run build:tools` in Task 9, or use `npx vitest`-independent manual run)
Expected: `detect` reports the pinned versions on `PATH` (claude-code `2.1.272`, opencode `1.18.31`, etc.); `cursor` reports the FHS-wrapped `agent` if the wrapper works, else `NOT INSTALLED` (acceptable per spec R5).

- [ ] **Step 4: Commit**

```bash
git add flake.nix
git commit -m "feat: add nix devShell pinning harness versions"
```

---

### Task 9: playground folder + scripts + setup (R6, R9)

**Files:**
- Create: `playground/package.json`, `playground/setup.sh`
- Modify: `.gitignore` (verify `playground/` is present — it already is)

**Interfaces:**
- Consumes: `tools/generate.mjs`, `tools/detect.mjs`, `tools/probe.mjs` (Tasks 5–7), `flake.nix` (Task 8).
- Produces: a working playground with npm scripts and a nested-git setup.

- [ ] **Step 1: Write the playground `package.json`**

Create `playground/package.json`:

```json
{
  "name": "harness-hub-playground",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "setup": "sh setup.sh",
    "generate": "node ../tools/generate.mjs",
    "scenario": "node ../tools/generate.mjs",
    "detect": "node ../tools/detect.mjs",
    "probe": "node ../tools/probe.mjs",
    "reset": "git clean -fdX .",
    "shell": "nix develop"
  }
}
```

- [ ] **Step 2: Write the setup script (nested git + CLI link, R9 shell check)**

Create `playground/setup.sh`:

```bash
#!/bin/sh
set -eu

# 1. Nested git — the playground must be its own consumer repo (spec: findRepoRoot).
if [ ! -d .git ]; then
  git init >/dev/null
  echo "playground: initialized nested git repo"
fi

# 2. Link the harness-hub CLI.
if ! command -v harness-hub >/dev/null 2>&1; then
  (cd .. && npm link) >/dev/null
fi
echo "playground: harness-hub CLI available at: $(command -v harness-hub)"

# 3. R9 — refuse harness observation outside the pinned shell.
if [ -z "${IN_NIX_SHELL:-}" ]; then
  echo "playground: WARNING — not in \`nix develop\`. Harness-observing commands"
  echo "  (probe, enable, doctor) may see unpinned harnesses. Run: npm run shell"
fi

echo "playground: ready. Try \`npm run generate -- baseline\`, then \`harness-hub doctor\`."
```

Make it executable: `chmod +x playground/setup.sh`.

- [ ] **Step 3: Build tools and smoke-test the full loop manually**

Run:

```bash
npm run build:tools
cd playground
npm run setup
npm run generate -- baseline
harness-hub doctor
npm run detect
```

Expected: `generate` writes `AGENTS.md` + `.agents/skills/writing-tests/SKILL.md`; `harness-hub doctor` resolves the playground as its own repo and reports no issues for `baseline`; `detect` prints the 7-harness table. (If run outside `nix develop`, `detect` reflects host installs — that's the documented R9 warning, not a failure.)

- [ ] **Step 4: Verify nothing in `playground/` is tracked**

Run: `cd .. && git status --short`
Expected: no `playground/` paths appear (only the tracked `playground/package.json`? — no: `playground/` is git-ignored entirely, so `playground/package.json` and `setup.sh` are **not** committed by the outer repo; they are documentation of the playground's own internal state). Confirm `git status` shows no `playground/` entries.

- [ ] **Step 5: Commit the tracked changes**

Because `playground/` is git-ignored, the only tracked artifacts from this task are none under `playground/`. If the plan wants the playground skeleton reproducible, its `package.json`/`setup.sh` live as *content the spec documents* rather than committed files. No commit needed here beyond verifying Tasks 1–8 are committed.

```bash
git status --short
# expect: only earlier tasks' files, nothing under playground/
```

---

## Self-Review

**Spec coverage:**
- R1 manifest + registry derivation → Task 1.
- R2/R2a/R2b generator, primitives, naming → Tasks 4–5.
- R3 detection → Task 6. R4 probe → Task 7.
- R5 flake → Task 8. R6 playground + scripts → Task 9.
- R7 nothing committed → Task 9 Step 4 + `.gitignore`.
- R8 `list`/`info` → Task 3.
- R9 nix-shell prerequisite (playground/tests only) → Task 9 `setup.sh` warning.
- R10 renames → Task 2.

**Placeholder scan:** No TBD/TODO. The two "first cut + loop" spots (flake hashes, hermes/pi/deepseek probe invocations) are concrete implementations with an explicit verification step, matching the spec's provisional framing for those items.

**Type consistency:** `Asset` is defined once (Task 4) and consumed by scenarios/generator (Task 5). `Scenario.assets(target): Asset[]` matches `writeAssets(target, Asset[])`. `loadManifest` (tools) and `loadVersionsManifest` (runtime) are deliberately separate but same-shape; `detect`/`probe` consume `loadManifest`/`resolveBinary` from `tools/manifest.ts` and `tools/detect.ts`. `ProbeSpec`/`ProbeRunner` signatures match between `probe.ts` and `probe.test.ts`.
