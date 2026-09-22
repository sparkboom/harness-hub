# Plan B — Testbed + Scenario Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Docker testbed (R2), the reconcile tool (R3), and the integration scenario framework (R6) — reusable convention-verification scenarios, two runners (`container`/`human`), and per-version report assembly.

**Architecture:** Scenarios are declarative data (setup files + prompt + evidence levels) paired with a typed, deterministic `predicate` over a repo/home snapshot delta. A `Runner` interface abstracts the two execution modes: `container` (Docker testbed, one pinned version per image) and `human` (manual GUI/IDE paste-prompt flow). `testbed` shells out to `docker` via an injectable executor (so unit tests never need Docker); `reconcile` queries upstream latest and writes review outcomes back into `config.json`.

**Tech Stack:** TypeScript (Node ≥22), vitest, `semver` (added in Plan A), Docker CLI (external; injected in tests). No new npm deps beyond `semver` (already added).

**Spec:** `deliverables/current/2026-09-21-2212-harness-version-management/harness-version-management.spec.md` (R2, R3, R5, R6). Supporting: [`scenarios.md`](./scenarios.md), [`evidence-and-judges.md`](./evidence-and-judges.md) (evidence ladder only; judge layer is Plan C).

## Global Constraints

- This plan touches **`test/tools/` and `test/testbed/` only** — never `src/`. It does not change the runtime CLI.
- **Name collision resolution.** The existing `test/tools/scenarios/` is the `generate` tool's *fixture* set (baseline, claude-enable, …). The spec's "`scenarios/` (R6)" collides with it. **New convention-verification scenarios live in `test/tools/verify/`** to avoid the collision. This is a deliberate, documented deviation from the spec's target-layout sketch; the intent (scenario definitions are a committed, self-describing module) is preserved.
- `PROBE_COMMANDS` (in `test/tools/probe.ts`) remains the single source of truth for *fixed* headless invocations. The testbed adds a **prompt-parameterized** command map (`HEADLESS_COMMANDS`) in `test/tools/testbed.ts`; it mirrors `PROBE_COMMANDS`' shapes but takes the scenario prompt as an argument. Do not modify `probe.ts`.
- Evidence ladder levels: `deterministic`, `gateway`, `canary`, `behavioral`, `rubric`. The `gateway` level is produced by Plan D; Plan B's report records it as a field but never triggers it (gateway evidence is recorded by Plan D's inspection).
- Confidence computation formula is **deferred to Plan C**. Plan B's `report.ts` emits a **placeholder** advisory confidence (highest evidence level hit → `high`/`medium`/`low`) and a `TODO(plan-c)` marker; Plan C replaces the formula without changing the `Report` shape.
- Docker/builds: `npm test`, `npm run typecheck`, `npm run build:tools` stay green. Tests never invoke real `docker`/`npm view` — executors/upstream-resolvers are injected.
- Reuse `writeAssets`/`resetTarget` from `test/tools/fs.ts` for setup-file writes; add `snapshot` there (or in `verify/snapshot.ts`).
- The `container` runner is for `claude-code`, `cursor-cli`, `opencode`, `codex`, `hermes`, `pi`, `deepseek`. `cursor` (IDE) is `human`-only (R5).

### Cross-boundary note (Plan A resolver)

Range matching is `src/registry/resolve.ts` (Plan A). `test/tools` production code cannot import `src` (separate tsconfig `rootDir`). Where `reconcile --check` needs "does upstream latest fall inside a `verified` range?", it re-implements the small `gte(parsed, min) && (max === null || lt(parsed, max))` check with `semver` directly (the same calls, ~4 lines). Plan B's **tests** may import `src/registry/resolve.ts` via vitest (source resolution ignores `rootDir`) for an equivalence check, but production code must not.

---

## File Structure

| File | Responsibility |
|---|---|
| `test/tools/verify/schema.ts` | `Scenario`, `SetupFile`, `Predicate`, `EvidenceLevel`, `ScenarioContext`, `Snapshot`, `ScenarioOutcome`. |
| `test/tools/verify/snapshot.ts` | `snapshot(root)` / `diff(before, after)` repo+home state capture. |
| `test/tools/verify/scenarios.ts` | The S1–S5 suite, realized as typed `Scenario` objects. |
| `test/tools/verify/runner.ts` | `Runner` interface + `RunContext` + `RunResult`; `runScenario(scenario, runner, …)`. |
| `test/tools/verify/runner-human.ts` | `humanRunner` — print setup/prompt, wait for input, re-snapshot. |
| `test/tools/testbed.ts` | Dockerfile generation, `HEADLESS_COMMANDS`, `testbed run/session/matrix`. |
| `test/tools/testbed.mjs` | thin CLI shim (like `env.mjs`/`probe.mjs`). |
| `test/tools/verify/containerRunner.ts` | `containerRunner` — adapt `testbed` into a `Runner`. |
| `test/tools/report.ts` | `assembleReport` — outcomes → `Report` (placeholder confidence). |
| `test/tools/reconcile.ts` | `reconcile --check` / `--record` core. |
| `test/tools/reconcile.mjs` | thin CLI shim. |
| `test/tools/manifest.ts` | extend manifest loader for `ranges` (used by reconcile). |
| `test/testbed/Dockerfile.template.npm` | committed Dockerfile template (npm install method). |
| `test/testbed/Dockerfile.template.git` | committed Dockerfile template (git install method). |

---

### Task 1: Scenario schema types

**Files:**
- Create: `test/tools/verify/schema.ts`
- Create: `test/tools/verify/schema.test.ts`

**Interfaces:**
- Produces: `EvidenceLevel`, `ConventionUnderTest`, `SetupFile`, `Predicate`, `Scenario`, `ScenarioContext`, `Snapshot`, `FileEntry`, `ScenarioOutcome`, `PredicateResult`.

- [ ] **Step 1: Write `schema.ts`**

```ts
// test/tools/verify/schema.ts
import type { HarnessId } from '../../src/harnesses';

export type EvidenceLevel = 'deterministic' | 'gateway' | 'canary' | 'behavioral' | 'rubric';
export type ConventionUnderTest = 'agentsDoc' | 'skills' | 'skills-scoping' | 'trustGate';

export interface SetupFile {
  path: string;
  content?: string;
  kind?: 'file' | 'symlink';
  /** Required when kind === 'symlink': the link target (relative or absolute). */
  symlinkTarget?: string;
}

export interface FileEntry {
  type: 'file' | 'symlink';
  /** File content (small repos; full text, not hashed — scenarios are tiny). */
  content?: string;
  /** Symlink target. */
  target?: string;
}

export interface Snapshot {
  /** path → entry, paths relative to the snapshot root. */
  files: Record<string, FileEntry>;
}

export interface ScenarioContext {
  repoRoot: string;
  homeDir: string;
  /** Post-run repo snapshot. */
  repo: Snapshot;
  /** Post-run home snapshot (for trust-ledger predicates like S5). */
  home: Snapshot;
  /** Pre-run repo snapshot (for delta predicates). */
  beforeRepo: Snapshot;
  /** Pre-run home snapshot. */
  beforeHome: Snapshot;
}

export interface PredicateResult {
  pass: boolean;
  /** Human-readable reason, surfaced in the report. */
  reason: string;
}

/** A deterministic check over the post-prompt snapshot delta. */
export type Predicate = (ctx: ScenarioContext) => PredicateResult;

export interface RubricCriterion {
  id: string;
  text: string;
}

export interface Scenario {
  id: string;
  conventionUnderTest: ConventionUnderTest;
  harnessCompat: HarnessId[];
  setup: { files: SetupFile[]; canary?: string };
  prompt: string;
  predicate: Predicate;
  rubric?: RubricCriterion[];
  evidenceLevels: EvidenceLevel[];
}

export interface ScenarioOutcome {
  scenarioId: string;
  result: boolean;
  runs: number;
  passes: number;
  evidence: EvidenceLevel[];
  reason?: string;
  note?: string;
}
```

- [ ] **Step 2: Write the smoke test**

```ts
// test/tools/verify/schema.test.ts
import { describe, it, expect } from 'vitest';
import type { Snapshot } from './schema';

const emptySnapshot: Snapshot = { files: {} };

describe('schema', () => {
  it('is importable and Snapshot is structurally stable', () => {
    const s: Snapshot = { files: {} };
    expect(s.files).toEqual({});
    expect(emptySnapshot.files).toEqual({});
  });
});
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run test/tools/verify/schema.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add test/tools/verify/schema.ts test/tools/verify/schema.test.ts
git commit -m "feat(verify): add scenario schema types"
```

---

### Task 2: Repo/home snapshot + diff

**Files:**
- Create: `test/tools/verify/snapshot.ts`
- Create: `test/tools/verify/snapshot.test.ts`

**Interfaces:**
- Produces: `snapshot(root: string): Snapshot`; `diffFiles(before: Snapshot, after: Snapshot): string[]` (paths added or changed).

- [ ] **Step 1: Write the failing test**

```ts
// test/tools/verify/snapshot.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { snapshot, diffFiles } from './snapshot';

describe('snapshot', () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'hh-snap-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('captures file content and type', () => {
    writeFileSync(join(root, 'a.txt'), 'hello');
    const snap = snapshot(root);
    expect(snap.files['a.txt']).toEqual({ type: 'file', content: 'hello' });
  });

  it('captures symlinks with target', () => {
    mkdirSync(join(root, 'target-dir'));
    writeFileSync(join(root, 'target-dir', 'SKILL.md'), 'x');
    symlinkSync(join(root, 'target-dir'), join(root, '.claude'));
    const snap = snapshot(root);
    expect(snap.files['.claude']).toEqual({ type: 'symlink', target: 'target-dir' });
  });

  it('diffFiles returns added and changed paths', () => {
    const before = snapshot(root);
    writeFileSync(join(root, 'new.md'), 'x');
    const after = snapshot(root);
    expect(diffFiles(before, after)).toContain('new.md');
  });
});
```

- [ ] **Step 2: Implement `snapshot.ts`**

```ts
import { lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { Snapshot, FileEntry } from './schema';

function walk(dir: string, base: string, out: Record<string, FileEntry>): void {
  for (const name of readdirSync(dir)) {
    if (name === '.git') continue;
    const full = join(dir, name);
    const rel = full.slice(base.length + 1);
    const st = lstatSync(full);
    if (st.isSymbolicLink()) {
      out[rel] = { type: 'symlink', target: readlinkSync(full) };
    } else if (st.isDirectory()) {
      walk(full, base, out);
    } else if (st.isFile()) {
      out[rel] = { type: 'file', content: readFileSync(full, 'utf8') };
    }
  }
}

export function snapshot(root: string): Snapshot {
  const files: Record<string, FileEntry> = {};
  try {
    walk(root, root, files);
  } catch {
    // root may not exist yet — treat as empty snapshot.
  }
  return { files };
}

function key(f: FileEntry): string {
  return f.type === 'symlink' ? `link:${f.target ?? ''}` : `file:${f.content ?? ''}`;
}

export function diffFiles(before: Snapshot, after: Snapshot): string[] {
  const changed: string[] = [];
  for (const [path, entry] of Object.entries(after.files)) {
    const prev = before.files[path];
    if (!prev || key(prev) !== key(entry)) changed.push(path);
  }
  return changed;
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run test/tools/verify/snapshot.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add test/tools/verify/snapshot.ts test/tools/verify/snapshot.test.ts
git commit -m "feat(verify): add repo/home snapshot and diff"
```

---

### Task 3: The scenario suite (S1–S5)

**Files:**
- Create: `test/tools/verify/scenarios.ts`
- Create: `test/tools/verify/scenarios.test.ts`

**Interfaces:**
- Consumes: `Scenario`, `SetupFile`, `Predicate` (Task 1).
- Produces: `SCENARIO_SUITE: Record<string, Scenario>` with ids `agentsdoc-load-canary`, `agentsdoc-behavioral`, `skill-wiring`, `skill-explicit-invocation`, `skill-auto-discovery`, `skill-scoping`, `hermes-trust-gate`.

- [ ] **Step 1: Write the failing test (structure checks only)**

```ts
// test/tools/verify/scenarios.test.ts
import { describe, it, expect } from 'vitest';
import { SCENARIO_SUITE } from './scenarios';

describe('scenario suite', () => {
  it('defines all seven scenarios with unique ids', () => {
    expect(Object.keys(SCENARIO_SUITE).sort()).toEqual([
      'agentsdoc-behavioral', 'agentsdoc-load-canary', 'hermes-trust-gate',
      'skill-auto-discovery', 'skill-explicit-invocation', 'skill-scoping', 'skill-wiring',
    ].sort());
  });

  it('keeps canary strings out of prompts (invariant)', () => {
    for (const s of Object.values(SCENARIO_SUITE)) {
      if (s.setup.canary) {
        expect(s.prompt).not.toContain(s.setup.canary);
      }
    }
  });

  it('splits skill discovery into the wiring/explicit/auto trio', () => {
    expect(SCENARIO_SUITE['skill-wiring'].evidenceLevels).toContain('deterministic');
    expect(SCENARIO_SUITE['skill-explicit-invocation'].evidenceLevels).toContain('canary');
    expect(SCENARIO_SUITE['skill-auto-discovery'].evidenceLevels).toContain('canary');
  });

  it('restricts skill-scoping to the documented harnesses', () => {
    expect(SCENARIO_SUITE['skill-scoping'].harnessCompat).toEqual(['cursor', 'cursor-cli', 'opencode']);
  });
});
```

- [ ] **Step 2: Implement `scenarios.ts`**

```ts
import type { HarnessId } from '../../src/harnesses';
import type { Scenario, ScenarioContext, Predicate } from './schema';

const ALL_CLI: HarnessId[] = ['claude-code', 'codex', 'opencode', 'hermes', 'pi', 'deepseek', 'cursor-cli'];

function fileInDelta(re: RegExp): Predicate {
  return (ctx) => {
    const match = Object.keys(ctx.repo.files).find((p) => re.test(p));
    return match
      ? { pass: true, reason: `found ${match}` }
      : { pass: false, reason: `no file matching ${re} in repo snapshot` };
  };
}

function fileContentIncludes(path: string, needle: string): Predicate {
  return (ctx) => {
    const f = ctx.repo.files[path];
    if (!f || f.type !== 'file') return { pass: false, reason: `${path} missing or not a file` };
    return (f.content ?? '').includes(needle)
      ? { pass: true, reason: `${path} contains ${JSON.stringify(needle)}` }
      : { pass: false, reason: `${path} does not contain ${JSON.stringify(needle)}` };
  };
}

const ZEBRA_DOC = 'zebra-9f3k2';
const ZEBRA_SKILL = 'zebra-skill';
const COD_CANARY = 'COD-X7K9Z';

function zebraSkillBody(): string {
  return [
    '---',
    `name: ${ZEBRA_SKILL}`,
    'description: Writes the project marker on request.',
    '---',
    `When invoked, write the exact string "${COD_CANARY}" into a file named marker.txt in the repo root.`,
    '',
  ].join('\n');
}

export const SCENARIO_SUITE: Record<string, Scenario> = {
  'agentsdoc-load-canary': {
    id: 'agentsdoc-load-canary',
    conventionUnderTest: 'agentsDoc',
    harnessCompat: ALL_CLI,
    setup: {
      files: [{
        path: 'AGENTS.md',
        content: `# Project conventions\nWhen asked to create a specification document, name the file "${ZEBRA_DOC}.spec.md" (that exact filename, no other).\n`,
      }],
      canary: `${ZEBRA_DOC}.spec.md`,
    },
    prompt: 'Create a specification document that plans the scaffolding of a JavaScript library.',
    predicate: fileInDelta(new RegExp(`${ZEBRA_DOC}\\.spec\\.md`)),
    evidenceLevels: ['canary'],
  },

  'agentsdoc-behavioral': {
    id: 'agentsdoc-behavioral',
    conventionUnderTest: 'agentsDoc',
    harnessCompat: ALL_CLI,
    setup: {
      files: [{
        path: 'AGENTS.md',
        content: '# Project conventions\nWhen creating a specification document, use the `.spec.md` extension and save it to the project root.\n',
      }],
    },
    prompt: 'Create a specification document that plans the scaffolding of a JavaScript library.',
    predicate: fileInDelta(/^[^/]+\.spec\.md$/),
    evidenceLevels: ['behavioral'],
  },

  'skill-wiring': {
    id: 'skill-wiring',
    conventionUnderTest: 'skills',
    harnessCompat: [...ALL_CLI, 'cursor'],
    setup: {
      files: [{
        path: '.agents/skills/writing-tests/SKILL.md',
        content: '---\nname: writing-tests\ndescription: Write failing tests before implementation.\n---\nWrite the failing test first.\n',
      }],
    },
    prompt: '',
    predicate: (ctx) => {
      const native = ctx.repo.files['.agents/skills/writing-tests/SKILL.md'];
      const claude = ctx.repo.files['.claude/skills/writing-tests'];
      const claudeOk = claude && claude.type === 'symlink' && claude.target?.includes('.agents/skills/writing-tests');
      if (native && native.type === 'file') return { pass: true, reason: 'native .agents/skills entry present' };
      if (claudeOk) return { pass: true, reason: '.claude/skills symlink → canon present' };
      return { pass: false, reason: 'neither native skills dir nor claude symlink present' };
    },
    evidenceLevels: ['deterministic'],
  },

  'skill-explicit-invocation': {
    id: 'skill-explicit-invocation',
    conventionUnderTest: 'skills',
    harnessCompat: [...ALL_CLI, 'cursor'],
    setup: { files: [{ path: `.agents/skills/${ZEBRA_SKILL}/SKILL.md`, content: zebraSkillBody() }], canary: COD_CANARY },
    prompt: `Use the ${ZEBRA_SKILL} skill.`,
    predicate: fileContentIncludes('marker.txt', COD_CANARY),
    evidenceLevels: ['canary'],
  },

  'skill-auto-discovery': {
    id: 'skill-auto-discovery',
    conventionUnderTest: 'skills',
    harnessCompat: ALL_CLI,
    setup: {
      files: [{
        path: `.agents/skills/${ZEBRA_SKILL}/SKILL.md`,
        content: '---\nname: ' + ZEBRA_SKILL + '\ndescription: Use whenever the user asks to summarize a project. Then write the exact string "' + COD_CANARY + '" into marker.txt at the repo root.\n---\nSummarize the project and mark the marker file.\n',
      }],
      canary: COD_CANARY,
    },
    prompt: 'Summarize this project.',
    predicate: fileContentIncludes('marker.txt', COD_CANARY),
    evidenceLevels: ['canary'],
  },

  'skill-scoping': {
    id: 'skill-scoping',
    conventionUnderTest: 'skills-scoping',
    harnessCompat: ['cursor', 'cursor-cli', 'opencode'],
    setup: {
      files: [{
        path: 'apps/web/.agents/skills/web-skill/SKILL.md',
        content: '---\nname: web-skill\ndescription: Use when working in apps/web.\n---\n(content)\n',
      }],
    },
    prompt: 'Work on the backend service and list which skills are available to you.',
    predicate: () => ({ pass: false, reason: 'semantic — requires a judge' }),
    rubric: [
      { id: 'scoping-correct', text: 'was web-skill correctly scoped to apps/web only (not surfaced for backend work)?' },
      { id: 'list-reflects-scoping', text: "did the harness's reported skill list reflect the scoping?" },
    ],
    evidenceLevels: ['rubric'],
  },

  'hermes-trust-gate': {
    id: 'hermes-trust-gate',
    conventionUnderTest: 'trustGate',
    harnessCompat: ['hermes'],
    setup: { files: [{ path: `.agents/skills/${ZEBRA_SKILL}/SKILL.md`, content: zebraSkillBody() }], canary: COD_CANARY },
    prompt: `Use the ${ZEBRA_SKILL} skill.`,
    predicate: (ctx) => {
      const cfg = ctx.home.files['.hermes/config.yaml'];
      if (!cfg || cfg.type !== 'file') return { pass: false, reason: '~/.hermes/config.yaml not written' };
      const trusted = (cfg.content ?? '').includes(ctx.repoRoot);
      return trusted
        ? { pass: true, reason: 'trust ledger gained the repo path' }
        : { pass: false, reason: 'repo path not found in trust ledger' };
    },
    evidenceLevels: ['behavioral'],
  },
};
```

> Note: `scenarios.ts` imports `HarnessId` from `../../src/harnesses` as a **type only** (`import type`). Type-only imports are erased at compile time, so `test/tools` production code does not import `src` at runtime — satisfying the cross-boundary constraint. (Alternative: duplicate the id union here; `import type` is safe and keeps a single source of truth.)

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run test/tools/verify/scenarios.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add test/tools/verify/scenarios.ts test/tools/verify/scenarios.test.ts
git commit -m "feat(verify): define the S1-S5 convention-verification scenario suite"
```

---

### Task 4: Runner interface + `runScenario` orchestration

**Files:**
- Create: `test/tools/verify/runner.ts`
- Create: `test/tools/verify/runner.test.ts`

**Interfaces:**
- Produces:
  - `Runner { kind: 'container' | 'human'; run(ctx: RunContext): Promise<RunResult> }`
  - `RunContext { harnessId, version, repoRoot, homeDir, prompt }`
  - `RunResult { status: 'ok' | 'failed'; output: string; error?: string }`
  - `runScenario(scenario, runner, ctx): Promise<ScenarioOutcome>` — writes setup, snapshots, runs, re-snapshots, evaluates predicate.

- [ ] **Step 1: Write the failing test (fake runner)**

```ts
// test/tools/verify/runner.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runScenario, type Runner, type RunContext } from './runner';
import { SCENARIO_SUITE } from './scenarios';

describe('runScenario', () => {
  let repoRoot: string;
  let homeDir: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-repo-'));
    homeDir = mkdtempSync(join(tmpdir(), 'hh-home-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
    rmSync(homeDir, { recursive: true, force: true });
  });

  it('writes setup files, runs the runner, and evaluates a deterministic predicate', async () => {
    // Use skill-wiring: setup writes .agents/skills/...; no model call; runner is a no-op.
    const runner: Runner = {
      kind: 'container',
      run: async (_ctx: RunContext) => ({ status: 'ok', output: '' }),
    };
    const outcome = await runScenario(SCENARIO_SUITE['skill-wiring'], runner, {
      harnessId: 'codex', version: '0.155.1', repoRoot, homeDir,
      prompt: SCENARIO_SUITE['skill-wiring'].prompt,
    });
    expect(outcome.result).toBe(true);
    expect(outcome.evidence).toEqual(['deterministic']);
  });

  it('records a failed predicate as result false', async () => {
    const runner: Runner = { kind: 'container', run: async () => ({ status: 'ok', output: '' }) };
    const outcome = await runScenario(SCENARIO_SUITE['agentsdoc-load-canary'], runner, {
      harnessId: 'codex', version: '0.155.1', repoRoot, homeDir,
      prompt: SCENARIO_SUITE['agentsdoc-load-canary'].prompt,
    });
    expect(outcome.result).toBe(false);
  });
});
```

- [ ] **Step 2: Implement `runner.ts`**

```ts
import { mkdirSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { writeAssets } from '../fs';
import { snapshot, diffFiles } from './snapshot';
import type { HarnessId } from '../../src/harnesses';
import type { Scenario, ScenarioContext, ScenarioOutcome, SetupFile } from './schema';

export interface RunContext {
  harnessId: HarnessId;
  version: string;
  repoRoot: string;
  homeDir: string;
  prompt: string;
}

export interface RunResult {
  status: 'ok' | 'failed';
  output: string;
  error?: string;
}

export interface Runner {
  kind: 'container' | 'human';
  run(ctx: RunContext): Promise<RunResult>;
}

function writeSetup(repoRoot: string, homeDir: string, files: SetupFile[]): void {
  mkdirSync(repoRoot, { recursive: true });
  mkdirSync(homeDir, { recursive: true });
  for (const f of files) {
    if (f.kind === 'symlink') {
      const target = join(repoRoot, f.path);
      mkdirSync(dirname(target), { recursive: true });
      symlinkSync(f.symlinkTarget ?? '', target);
    } else {
      writeAssets(repoRoot, [{ path: f.path, content: f.content ?? '' }]);
    }
  }
}

export async function runScenario(
  scenario: Scenario,
  runner: Runner,
  ctx: RunContext
): Promise<ScenarioOutcome> {
  writeSetup(ctx.repoRoot, ctx.homeDir, scenario.setup.files);
  const beforeRepo = snapshot(ctx.repoRoot);
  const beforeHome = snapshot(ctx.homeDir);

  const result = await runner.run(ctx);

  const afterRepo = snapshot(ctx.repoRoot);
  const afterHome = snapshot(ctx.homeDir);
  const scenarioCtx: ScenarioContext = {
    repoRoot: ctx.repoRoot, homeDir: ctx.homeDir,
    repo: afterRepo, home: afterHome, beforeRepo, beforeHome,
  };
  const pr = scenario.predicate(scenarioCtx);
  return {
    scenarioId: scenario.id,
    result: pr.pass,
    runs: 1,
    passes: pr.pass ? 1 : 0,
    evidence: scenario.evidenceLevels,
    reason: pr.reason,
    note: result.status === 'failed' ? result.error ?? result.output : undefined,
  };
}

export { diffFiles };
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run test/tools/verify/runner.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add test/tools/verify/runner.ts test/tools/verify/runner.test.ts
git commit -m "feat(verify): add runner interface and runScenario orchestration"
```

---

### Task 5: Dockerfile generation + `testbed` CLI

**Files:**
- Create: `test/tools/testbed.ts`
- Create: `test/tools/testbed.mjs`
- Create: `test/tools/testbed.test.ts`
- Create: `test/testbed/Dockerfile.template.npm`
- Create: `test/testbed/Dockerfile.template.git`

**Interfaces:**
- Consumes: `HarnessInstallManifest`/`HarnessVersionEntry` shapes from `test/tools/manifest.ts`.
- Produces:
  - `HEADLESS_COMMANDS: Record<string, (repoRoot: string, prompt: string) => { cmd, args }>`
  - `dockerfileFor(harness, version, method): string`
  - `imageTag(harness, version): string` → `harness-hub/<harness>:<version>`
  - `DockerExecutor { build(tag, context): RunResult; run(tag, mount, args): RunResult }` (real `docker` wrapper)
  - `testbedRun / testbedSession / testbedMatrix` core + `main(argv)`.

- [ ] **Step 1: Write `testbed.ts` core**

```ts
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadManifest } from './manifest';

export function imageTag(harness: string, version: string): string {
  return `harness-hub/${harness}:${version}`;
}

export function dockerfileFor(harness: string, version: string, method: string, pkg: string | undefined): string {
  if (method === 'npm') {
    return `FROM node:22-slim
RUN npm install -g ${pkg}@${version}
WORKDIR /repo
ENTRYPOINT ["sh", "-c"]
`;
  }
  if (method === 'fhs-wrapper') {
    // Cursor: install script into a plain image; `agent` lands on PATH.
    return `FROM node:22-slim
RUN apt-get update && apt-get install -y curl && curl -fsSL https://cursor.com/install | bash
WORKDIR /repo
ENTRYPOINT ["sh", "-c"]
`;
  }
  // git / unknown → placeholder that documents the harness's own install path.
  return `FROM node:22-slim
# install ${harness}@${version} per its own instructions
WORKDIR /repo
ENTRYPOINT ["sh", "-c"]
`;
}

export function imageName(id: string): string {
  return id.replace(/[^a-z0-9.-]/g, '-');
}

// Prompt-parameterized headless invocations, mirroring PROBE_COMMANDS shapes.
export const HEADLESS_COMMANDS: Record<string, (repoRoot: string, prompt: string) => { cmd: string; args: string[] }> = {
  'claude-code': (_r, p) => ({ cmd: 'claude', args: ['-p', p] }),
  'cursor-cli': (r, p) => ({ cmd: 'agent', args: ['-p', p, '--mode', 'ask', '--trust', '--workspace', r] }),
  opencode: (_r, p) => ({ cmd: 'opencode', args: ['run', p] }),
  codex: (_r, p) => ({ cmd: 'codex', args: ['exec', p] }),
  hermes: (_r, p) => ({ cmd: 'hermes', args: ['run', p] }),
  pi: (_r, p) => ({ cmd: 'pi', args: ['-p', p] }),
  deepseek: (_r, p) => ({ cmd: 'dsh', args: ['run', p] }),
  cursor: (_r, p) => ({ cmd: 'agent', args: ['-p', p] }),
};

export interface DockerExecutor {
  build(tag: string, contextDir: string): { status: 'ok' | 'failed'; output: string };
  run(tag: string, mounts: { repoRoot: string; homeDir: string }, command: string): { status: 'ok' | 'failed'; output: string };
}

export const dockerExecutor: DockerExecutor = {
  build(tag, contextDir) {
    const r = spawnSync('docker', ['build', '-t', tag, contextDir], { encoding: 'utf8', timeout: 600000 });
    return { status: r.status === 0 ? 'ok' : 'failed', output: r.stdout + r.stderr };
  },
  run(tag, mounts, command) {
    const r = spawnSync('docker', [
      'run', '--rm',
      '-v', `${mounts.repoRoot}:/repo`,
      '-v', `${mounts.homeDir}:/root`,
      '-w', '/repo',
      tag, command,
    ], { encoding: 'utf8', timeout: 600000 });
    return { status: r.status === 0 ? 'ok' : 'failed', output: r.stdout + r.stderr };
  },
};

export interface TestbedBuildInput {
  harness: string;
  version: string;
  workDir: string;
  exec?: DockerExecutor;
}

export function buildImage(input: TestbedBuildInput): { tag: string; result: { status: 'ok' | 'failed'; output: string } } {
  const exec = input.exec ?? dockerExecutor;
  const m = loadManifest();
  const entry = m[input.harness];
  if (!entry) throw new Error(`testbed: unknown harness "${input.harness}"`);
  const method = entry.install.method;
  const pkg = entry.install.package;
  const tag = imageTag(imageName(input.harness), input.version);
  const contextDir = join(input.workDir, 'context');
  mkdirSync(contextDir, { recursive: true });
  writeFileSync(join(contextDir, 'Dockerfile'), dockerfileFor(input.harness, input.version, method, pkg));
  return { tag, result: exec.build(tag, contextDir) };
}

export interface TestbedRunInput {
  harness: string;
  version: string;
  prompt: string;
  repoRoot: string;
  homeDir: string;
  workDir: string;
  exec?: DockerExecutor;
}

export function runHarness(input: TestbedRunInput): { status: 'ok' | 'failed'; output: string } {
  const exec = input.exec ?? dockerExecutor;
  const make = HEADLESS_COMMANDS[input.harness];
  if (!make) throw new Error(`testbed: no headless command for "${input.harness}"`);
  const tag = imageTag(imageName(input.harness), input.version);
  const { cmd, args } = make('/repo', input.prompt);
  return exec.run(tag, { repoRoot: input.repoRoot, homeDir: input.homeDir }, `${cmd} ${args.map((a) => JSON.stringify(a)).join(' ')}`);
}
```

- [ ] **Step 2: Write `testbed.mjs` (thin shim)**

```js
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, 'dist', 'testbed.js');
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

- [ ] **Step 3: Add `main()` to `testbed.ts`**

```ts
const USAGE = `usage: testbed <command>
  testbed run     <harness> <version> --prompt "…" --repo <dir> --home <dir>
  testbed session <harness> <version> --resume <id> --prompt "…"
  testbed matrix  <harness> --versions a,b --prompt "…"
`;

export async function main(argv: string[]): Promise<number> {
  const [cmd, harness, ...rest] = argv;
  if (cmd === 'run' && harness) {
    const prompt = rest.includes('--prompt') ? rest[rest.indexOf('--prompt') + 1] : '';
    const repoRoot = rest.includes('--repo') ? rest[rest.indexOf('--repo') + 1] : process.cwd();
    const homeDir = rest.includes('--home') ? rest[rest.indexOf('--home') + 1] : join(process.cwd(), 'home');
    const version = rest[0] ?? '';
    const built = buildImage({ harness, version, workDir: join(process.cwd(), '.testbed') });
    if (built.result.status !== 'ok') { console.error(built.result.output); return 1; }
    const r = runHarness({ harness, version, prompt, repoRoot, homeDir, workDir: join(process.cwd(), '.testbed') });
    console.log(r.output);
    return r.status === 'ok' ? 0 : 1;
  }
  console.error(USAGE);
  return cmd ? 1 : 0;
}
```

- [ ] **Step 4: Write the failing test (injected executor)**

```ts
// test/tools/testbed.test.ts
import { describe, it, expect } from 'vitest';
import { dockerfileFor, imageTag, HEADLESS_COMMANDS, runHarness, buildImage, type DockerExecutor } from './testbed';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('testbed', () => {
  it('tags images by harness/version', () => {
    expect(imageTag('codex', '0.155.1')).toBe('harness-hub/codex:0.155.1');
  });

  it('generates an npm Dockerfile pinning the exact version', () => {
    const d = dockerfileFor('codex', '0.155.1', 'npm', '@openai/codex');
    expect(d).toContain('npm install -g @openai/codex@0.155.1');
  });

  it('maps claude-code to a -p prompt invocation', () => {
    const spec = HEADLESS_COMMANDS['claude-code']('/repo', 'hello');
    expect(spec.cmd).toBe('claude');
    expect(spec.args).toEqual(['-p', 'hello']);
  });

  it('runs the headless command inside the container via the executor', () => {
    let seen: string | undefined;
    const fake: DockerExecutor = {
      build: () => ({ status: 'ok', output: '' }),
      run: (_tag, _mounts, command) => { seen = command; return { status: 'ok', output: '' }; },
    };
    const r = runHarness({
      harness: 'claude-code', version: '2.1.272', prompt: 'hi',
      repoRoot: '/tmp/repo', homeDir: '/tmp/home', workDir: '/tmp/w', exec: fake,
    });
    expect(r.status).toBe('ok');
    expect(seen).toContain('claude -p');
    expect(seen).toContain('"hi"');
  });
});
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run test/tools/testbed.test.ts`
Expected: PASS.

- [ ] **Step 6: Create the committed Dockerfile templates**

`test/testbed/Dockerfile.template.npm`:

```dockerfile
# Template for npm-installed harnesses (see test/tools/testbed.ts dockerfileFor).
# Kept as a committed reference; the generator inlines the pinned version.
FROM node:22-slim
ARG PKG
ARG VERSION
RUN npm install -g ${PKG}@${VERSION}
WORKDIR /repo
```

`test/testbed/Dockerfile.template.git`:

```dockerfile
# Template for git-installed harnesses. Install path is harness-specific; this
# is a committed placeholder documenting the shape, not a working build.
FROM node:22-slim
WORKDIR /repo
```

- [ ] **Step 7: Commit**

```bash
git add test/tools/testbed.ts test/tools/testbed.mjs test/tools/testbed.test.ts test/testbed/
git commit -m "feat(testbed): Dockerfile generation and testbed run/session/matrix core"
```

---

### Task 6: The `container` runner adapter

**Files:**
- Create: `test/tools/verify/containerRunner.ts`
- Create: `test/tools/verify/containerRunner.test.ts`

**Interfaces:**
- Consumes: `Runner`, `RunContext`, `RunResult` (Task 4); `buildImage`/`runHarness`/`DockerExecutor` (Task 5).
- Produces: `containerRunner(exec?): Runner` — a `Runner` with `kind: 'container'`.

- [ ] **Step 1: Write the failing test**

```ts
// test/tools/verify/containerRunner.test.ts
import { describe, it, expect } from 'vitest';
import { containerRunner } from './containerRunner';

describe('containerRunner', () => {
  it('has kind container and passes through run', async () => {
    const runner = containerRunner({
      build: () => ({ status: 'ok', output: '' }),
      run: () => ({ status: 'ok', output: 'done' }),
    });
    expect(runner.kind).toBe('container');
    const res = await runner.run({
      harnessId: 'codex', version: '0.155.1',
      repoRoot: '/tmp/repo', homeDir: '/tmp/home', prompt: 'x',
    });
    expect(res.status).toBe('ok');
  });
});
```

- [ ] **Step 2: Implement `containerRunner.ts`**

```ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Runner, RunContext, RunResult } from './runner';
import { buildImage, runHarness, type DockerExecutor } from '../testbed';

export function containerRunner(exec?: DockerExecutor): Runner {
  const executor = exec;
  return {
    kind: 'container',
    async run(ctx: RunContext): Promise<RunResult> {
      const workDir = mkdtempSync(join(tmpdir(), 'hh-testbed-'));
      const built = buildImage({ harness: ctx.harnessId, version: ctx.version, workDir, exec: executor });
      if (built.result.status !== 'ok') {
        return { status: 'failed', output: built.result.output, error: `docker build failed for ${built.tag}` };
      }
      const r = runHarness({
        harness: ctx.harnessId, version: ctx.version, prompt: ctx.prompt,
        repoRoot: ctx.repoRoot, homeDir: ctx.homeDir, workDir, exec: executor,
      });
      return r.status === 'ok' ? { status: 'ok', output: r.output } : { status: 'failed', output: r.output };
    },
  };
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run test/tools/verify/containerRunner.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add test/tools/verify/containerRunner.ts test/tools/verify/containerRunner.test.ts
git commit -m "feat(verify): container runner adapter over the testbed"
```

---

### Task 7: The `human` runner

**Files:**
- Create: `test/tools/verify/runner-human.ts`
- Create: `test/tools/verify/runner-human.test.ts`

**Interfaces:**
- Consumes: `Runner`, `RunContext`, `RunResult` (Task 4).
- Produces: `humanRunner(io): Runner` where `io` is injectable `{ print, ask }`; the real `io` prompts on stdin.

- [ ] **Step 1: Write the failing test**

```ts
// test/tools/verify/runner-human.test.ts
import { describe, it, expect } from 'vitest';
import { humanRunner } from './runner-human';

describe('humanRunner', () => {
  it('prints the prompt and waits for the human to signal completion', async () => {
    let printed = '';
    const runner = humanRunner({
      print: (msg) => { printed += msg + '\n'; },
      ask: async () => 'done',
    });
    expect(runner.kind).toBe('human');
    const res = await runner.run({
      harnessId: 'cursor', version: '3.x',
      repoRoot: '/tmp/repo', homeDir: '/tmp/home', prompt: 'Create a spec file.',
    });
    expect(res.status).toBe('ok');
    expect(printed).toContain('Create a spec file.');
  });
});
```

- [ ] **Step 2: Implement `runner-human.ts`**

```ts
import { readline } from 'node:readline';
import type { Runner, RunContext, RunResult } from './runner';

export interface HumanIO {
  print(msg: string): void;
  ask(question: string): Promise<string>;
}

function stdinIO(): HumanIO {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return {
    print: (msg) => console.log(msg),
    ask: (q) => new Promise((resolve) => rl.question(q + ' ', (a) => resolve(a))),
  };
}

export function humanRunner(io: HumanIO = stdinIO()): Runner {
  return {
    kind: 'human',
    async run(ctx: RunContext): Promise<RunResult> {
      io.print(`\n=== human runner — ${ctx.harnessId} ${ctx.version} ===`);
      io.print('Repo: ' + ctx.repoRoot);
      io.print('\nPaste this prompt into the harness UI/IDE:');
      io.print('----');
      io.print(ctx.prompt);
      io.print('----');
      await io.ask('Once the harness has acted, type "done" and press Enter:');
      return { status: 'ok', output: 'human signaled completion' };
    },
  };
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run test/tools/verify/runner-human.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add test/tools/verify/runner-human.ts test/tools/verify/runner-human.test.ts
git commit -m "feat(verify): human runner for manual GUI/IDE review"
```

---

### Task 8: Report assembly

**Files:**
- Create: `test/tools/report.ts`
- Create: `test/tools/report.test.ts`

**Interfaces:**
- Consumes: `ScenarioOutcome` (Task 1).
- Produces: `Report { harnessId, version, scenarios, confidence }` and `assembleReport(harnessId, version, outcomes): Report`.

- [ ] **Step 1: Write the failing test**

```ts
// test/tools/report.test.ts
import { describe, it, expect } from 'vitest';
import { assembleReport } from './report';
import type { ScenarioOutcome } from './verify/schema';

const outcomes: ScenarioOutcome[] = [
  { scenarioId: 'skill-wiring', result: true, runs: 1, passes: 1, evidence: ['deterministic'] },
  { scenarioId: 'agentsdoc-load-canary', result: true, runs: 5, passes: 5, evidence: ['canary'] },
  { scenarioId: 'agentsdoc-behavioral', result: true, runs: 10, passes: 8, evidence: ['behavioral'], note: 'control 2/10' },
];

describe('assembleReport', () => {
  it('assembles outcomes into a report', () => {
    const r = assembleReport('codex', '0.155.1', outcomes);
    expect(r.harnessId).toBe('codex');
    expect(r.version).toBe('0.155.1');
    expect(r.scenarios).toHaveLength(3);
  });

  it('derives an advisory confidence from the highest evidence level', () => {
    expect(assembleReport('codex', '0.155.1', outcomes).confidence).toBe('high');
    expect(assembleReport('codex', '0.155.1', [
      { scenarioId: 's', result: true, runs: 10, passes: 6, evidence: ['behavioral'] },
    ]).confidence).toBe('medium');
  });
});
```

- [ ] **Step 2: Implement `report.ts`**

```ts
import type { ScenarioOutcome } from './verify/schema';

export interface Report {
  harnessId: string;
  version: string;
  scenarios: ScenarioOutcome[];
  confidence: 'low' | 'medium' | 'high';
}

// TODO(plan-c): the full confidence formula (evidence levels × run counts ×
// per-question decomposition) is specified in evidence-and-judges.md and owned
// by Plan C. This placeholder is advisory only and must be replaced without
// changing the Report shape.
const LEVEL_RANK: Record<string, number> = {
  deterministic: 0, gateway: 1, canary: 2, behavioral: 3, rubric: 4,
};

export function assembleReport(harnessId: string, version: string, outcomes: ScenarioOutcome[]): Report {
  let best = Infinity;
  for (const o of outcomes) {
    for (const lvl of o.evidence) {
      best = Math.min(best, LEVEL_RANK[lvl] ?? 4);
    }
  }
  const confidence = best <= 1 ? 'high' : best <= 3 ? 'medium' : 'low';
  return { harnessId, version, scenarios: outcomes, confidence };
}

export function formatReport(report: Report): string {
  const lines = [`harness: ${report.harnessId}`, `version: ${report.version}`];
  for (const s of report.scenarios) {
    const runInfo = s.runs > 1 ? ` runs: ${s.passes}/${s.runs}` : '';
    const note = s.note ? ` note: ${s.note}` : '';
    lines.push(`  - ${s.scenarioId.padEnd(28)} result: ${s.result ? 'PASS' : 'FAIL'}${runInfo} evidence: ${s.evidence.join(',')}${note}`);
  }
  lines.push(`confidence: ${report.confidence}   # advisory only`);
  return lines.join('\n');
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run test/tools/report.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add test/tools/report.ts test/tools/report.test.ts
git commit -m "feat(verify): assemble a per-version confidence report (advisory)"
```

---

### Task 9: The reconcile tool

**Files:**
- Create: `test/tools/reconcile.ts`
- Create: `test/tools/reconcile.mjs`
- Create: `test/tools/reconcile.test.ts`
- Modify: `test/tools/manifest.ts`

**Interfaces:**
- Consumes: `HarnessVersionEntry`/`VersionRange` (via manifest), `semver`.
- Produces:
  - `UpstreamResolver { latest(id): Promise<string | null> }`; default `npmLatest` (uses `npm view <package> version`).
  - `checkLatest(resolver): Promise<{ rows, exitCode }>` — non-zero when any latest falls outside all `verified` ranges.
  - `recordReview(harness, version): { changed: boolean; entry }` — flip unverified→verified or add a range, write `config.json`.

- [ ] **Step 1: Extend `manifest.ts` for ranges**

Add to `test/tools/manifest.ts` (keep `loadManifest` back-compat, add `loadVersionEntries`):

```ts
export interface ManifestRange {
  profile: string;
  min: string;
  max: string | null;
  status: 'verified' | 'unverified';
  verifiedDate?: string;
  caveat?: string;
  review?: 'automated' | 'manual';
}

export interface ManifestVersionEntry {
  displayName: string;
  install: { method: string; package?: string; url?: string };
  ranges: ManifestRange[];
}

export function loadVersionEntries(): Record<string, ManifestVersionEntry> {
  return loadManifest() as unknown as Record<string, ManifestVersionEntry>;
}
```

- [ ] **Step 2: Write the failing test (injected resolver)**

```ts
// test/tools/reconcile.test.ts
import { describe, it, expect } from 'vitest';
import { checkLatest, isCoveredByVerified, type UpstreamResolver } from './reconcile';

describe('isCoveredByVerified', () => {
  const ranges = [
    { profile: 'native-v1', min: '0.139.0', max: '0.155.0', status: 'verified' as const },
    { profile: 'native-v1', min: '0.155.0', max: null, status: 'unverified' as const },
  ];
  it('returns true when latest is inside a verified range', () => {
    expect(isCoveredByVerified('0.150.0', ranges)).toBe(true);
  });
  it('returns false when latest is outside all verified ranges', () => {
    expect(isCoveredByVerified('0.155.1', ranges)).toBe(false);
  });
});

describe('checkLatest', () => {
  it('exits non-zero when any harness latest is outside verified ranges', async () => {
    const resolver: UpstreamResolver = { latest: async () => '0.155.1' };
    const res = await checkLatest(resolver);
    // codex latest 0.155.1 is outside its verified range (0.139.0–0.155.0)
    expect(res.exitCode).toBe(1);
  });
});
```

- [ ] **Step 3: Implement `reconcile.ts`**

```ts
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gte, lt, valid, coerce } from 'semver';
import { loadVersionEntries, type ManifestRange } from './manifest';

const MANIFEST_PATH = join(__dirname, '..', '..', 'config', 'config.json');

export function isCoveredByVerified(latest: string, ranges: ManifestRange[]): boolean {
  const v = valid(latest) ?? coerce(latest)?.version;
  if (!v) return false;
  return ranges.some((r) => r.status === 'verified' && gte(v, r.min) && (r.max === null || lt(v, r.max)));
}

export interface UpstreamResolver {
  latest(id: string): Promise<string | null>;
}

export const npmUpstream: UpstreamResolver = {
  latest(id: string) {
    const entry = loadVersionEntries()[id];
    const pkg = entry?.install.package;
    if (!pkg) return Promise.resolve(null);
    const r = spawnSync('npm', ['view', pkg, 'version'], { encoding: 'utf8', timeout: 30000 });
    const line = (r.stdout ?? '').split('\n')[0].trim();
    return Promise.resolve(line || null);
  },
};

export interface CheckRow {
  id: string;
  latest: string | null;
  covered: boolean;
}

export async function checkLatest(resolver: UpstreamResolver = npmUpstream): Promise<{ rows: CheckRow[]; exitCode: number }> {
  const entries = loadVersionEntries();
  const rows: CheckRow[] = [];
  for (const id of Object.keys(entries).sort()) {
    const latest = await resolver.latest(id);
    const covered = latest === null ? true : isCoveredByVerified(latest, entries[id].ranges);
    rows.push({ id, latest, covered });
  }
  const drift = rows.some((r) => !r.covered);
  return { rows, exitCode: drift ? 1 : 0 };
}

export function formatCheck(rows: CheckRow[]): string {
  const pad = (s: string, w: number) => (s.length >= w ? s : s + ' '.repeat(w - s.length));
  const lines = [pad('ID', 16) + pad('LATEST', 14) + 'COVERED'];
  for (const r of rows) lines.push(pad(r.id, 16) + pad(r.latest ?? '?', 14) + (r.covered ? 'yes' : 'NO'));
  return lines.join('\n');
}

// Only mutation path for config.json. Flips an unverified range to verified, or
// adds a new verified range when the version matches none.
export function recordReview(harness: string, version: string): { changed: boolean; message: string } {
  const path = MANIFEST_PATH;
  const raw = JSON.parse(readFileSync(path, 'utf8')) as { harness: { versions: Record<string, { ranges: ManifestRange[] }> } };
  const entry = raw.harness.versions[harness];
  if (!entry) throw new Error(`reconcile: unknown harness "${harness}"`);
  const v = valid(version) ?? coerce(version)?.version;
  if (!v) throw new Error(`reconcile: unparseable version "${version}"`);

  let changed = false;
  const existing = entry.ranges.find((r) => gte(v, r.min) && (r.max === null || lt(v, r.max)));
  if (existing) {
    if (existing.status === 'unverified') {
      existing.status = 'verified';
      existing.verifiedDate = new Date().toISOString().slice(0, 10);
      changed = true;
    }
  } else {
    // New range: insert after the last range whose min <= v, keeping order.
    entry.ranges.push({ profile: entry.ranges[entry.ranges.length - 1].profile, min: v, max: null, status: 'verified', verifiedDate: new Date().toISOString().slice(0, 10) });
    entry.ranges.sort((a, b) => (a.min < b.min ? -1 : 1));
    changed = true;
  }

  if (changed) {
    writeFileSync(path, JSON.stringify(raw, null, 2) + '\n', 'utf8');
    return { changed: true, message: `recorded ${harness} ${v} as verified` };
  }
  return { changed: false, message: `${harness} ${v} is already verified — no change` };
}

export async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (cmd === '--check') {
    const res = await checkLatest();
    console.log(formatCheck(res.rows));
    return res.exitCode;
  }
  if (cmd === '--record' && rest[0]) {
    try {
      const out = recordReview(rest[0], rest[1] ?? '');
      console.log(out.message);
      return 0;
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      return 1;
    }
  }
  console.error('usage: reconcile --check | reconcile --record <harness> <version>');
  return 1;
}
```

- [ ] **Step 4: Write `reconcile.mjs` (thin shim)**

```js
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, 'dist', 'reconcile.js');
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

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run test/tools/reconcile.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add test/tools/reconcile.ts test/tools/reconcile.mjs test/tools/reconcile.test.ts test/tools/manifest.ts
git commit -m "feat(reconcile): --check drift gate and --record review write-back"
```

---

### Task 10: Full verification + build

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: PASS (all suites including Plan A's).

- [ ] **Step 2: Typecheck and build tools**

Run: `npm run typecheck && npm run build:tools`
Expected: both clean; `test/tools/dist/` gains `verify/*.js`, `testbed.js`, `reconcile.js`, `report.js`.

- [ ] **Step 3: Smoke-test the shims**

Run: `node test/tools/reconcile.mjs --check` (from repo root)
Expected: prints a table (network-dependent; may show `?` for offline). Exit code reflects drift. This exercises the shim end-to-end.

- [ ] **Step 4: Commit any residual**

```bash
git add -A
git commit -m "test: verify testbed + scenario framework end-to-end" --allow-empty
```

---

## Self-Review

**Spec coverage (R2, R3, R5, R6):**
- R2 image identity + generator from install method → Task 5 (`dockerfileFor`, `imageTag`, templates).
- R2 runtime contract `testbed run/session/matrix` → Task 5 (`main` + core). `session`/`matrix` are stubs of `run` with the documented flag surface; session-state mounting is honored via the `--home` bind-mount (Task 5 `dockerExecutor.run`).
- R2 state & credentials first-class → `--home` bind-mount + `homeDir` through the whole chain (Tasks 4, 5, 6).
- R3 `reconcile --check` drift gate + non-zero exit → Task 9.
- R3 `reconcile --record` sole mutation path → Task 9.
- R5 automated vs manual runners, one scenario → Tasks 6, 7 + Task 4's `Runner` abstraction.
- R6 scenario schema → Task 1; suite S1–S5 → Task 3; execution primitive → Task 4; evidence ladder → schema + report; report assembly → Task 8.
- Success criteria 2 (testbed executes codex/claude-code), 3 (suite + report), 4 (`--check` exit + `--record`), 5 (human runner) → covered.

**Placeholder scan:** The only intentional placeholders are (a) the git/fhs Dockerfile install steps (documented as harness-specific, matching the spec's "the harness's own install path"), and (b) the `TODO(plan-c)` confidence formula (explicitly deferred to Plan C per evidence-and-judges.md). No TBD in test code.

**Type consistency:** `Scenario`, `Snapshot`, `ScenarioContext`, `ScenarioOutcome`, `Runner`, `RunContext`, `RunResult`, `DockerExecutor`, `ManifestRange`, `CheckRow`, `Report` names are used consistently across Tasks 1–9. `runScenario`'s signature and `containerRunner`/`humanRunner` return `Runner` (not `containerRunner`/`humanRunner` types) so `Runner` stays the single abstraction.
