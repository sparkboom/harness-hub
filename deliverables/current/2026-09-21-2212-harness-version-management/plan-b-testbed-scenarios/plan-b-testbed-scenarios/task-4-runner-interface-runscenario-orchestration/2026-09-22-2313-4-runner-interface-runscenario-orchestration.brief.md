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

