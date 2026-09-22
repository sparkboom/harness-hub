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

  it('survives a throwing runner: still snapshots, evaluates the predicate, and carries the error as note', async () => {
    const runner: Runner = {
      kind: 'container',
      run: async () => {
        throw new Error('spawn ENOENT');
      },
    };
    // skill-wiring has a deterministic-pass predicate over post-run snapshots;
    // the pipeline must continue past the rejected run, so result is true
    // while note records the failed-run diagnostics.
    const outcome = await runScenario(SCENARIO_SUITE['skill-wiring'], runner, {
      harnessId: 'codex', version: '0.155.1', repoRoot, homeDir,
      prompt: SCENARIO_SUITE['skill-wiring'].prompt,
    });
    expect(outcome.result).toBe(true);
    expect(outcome.passes).toBe(1);
    expect(outcome.runs).toBe(1);
    expect(outcome.note).toBe('spawn ENOENT');
  });
});