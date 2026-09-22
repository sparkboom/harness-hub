// test/tools/verify/runner.ts
//
// Runner interface + runScenario orchestration: write setup files, snapshot
// repo/home before and after the run, evaluate the scenario predicate over
// the post-run snapshots.
//
// `HarnessId` is imported from `./schema` (not `src/harnesses`) per the
// Task 1 ruling: test/tools production code must not import from src/,
// even for types (TS6059 under the tools tsconfig rootDir).
import { mkdirSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { writeAssets } from '../fs';
import { snapshot, diffFiles } from './snapshot';
import type { HarnessId, Scenario, ScenarioContext, ScenarioOutcome, SetupFile } from './schema';

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

  // A throwing runner (spawn ENOENT, container timeout) must not abort the
  // pipeline: record the failure and continue to snapshots/predicate so the
  // outcome still records the failed run. Non-throwing behavior unchanged.
  let result: RunResult;
  try {
    result = await runner.run(ctx);
  } catch (e) {
    result = { status: 'failed', output: '', error: e instanceof Error ? e.message : String(e) };
  }

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