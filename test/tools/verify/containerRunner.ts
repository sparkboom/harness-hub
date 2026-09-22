// test/tools/verify/containerRunner.ts
//
// The `container` Runner: builds the harness image via the testbed (Task 5)
// and runs the harness's headless command inside a container. An injected
// DockerExecutor (optional) keeps tests off real docker.
//
// Task 4 ruling: Runner.run implementations must never throw — unexpected
// failures (e.g. mkdtempSync, manifest load) are converted into a failed
// RunResult so runScenario's snapshot/predicate pipeline still completes.
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
      // Empty prompt = deterministic scenario (e.g. skill-wiring): there is
      // nothing for the harness to do, and dispatching `claude -p ""` produces
      // garbage runs. Skip build/run entirely.
      if (ctx.prompt === '') {
        return { status: 'ok', output: 'no prompt — deterministic scenario, container dispatch skipped' };
      }
      try {
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
      } catch (e) {
        // Task 4 ruling: never throw out of run(); surface as a failed RunResult.
        return { status: 'failed', output: '', error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}