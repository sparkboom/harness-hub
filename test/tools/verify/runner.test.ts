// test/tools/verify/runner.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runScenario, type Runner, type RunContext } from './runner';
import { SCENARIO_SUITE } from './scenarios';
import type { Scenario } from './schema';

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

  it('captures a symlink setup file end-to-end: writeSetup, snapshot, predicate', async () => {
    // Inline fake scenario (not SCENARIO_SUITE) closing the Task-4 deferred
    // minor: the symlink branch of writeSetup was never exercised end-to-end.
    // Link-dir-relative target (the documented skill-wiring pattern) plus a
    // native file, no-op runner, predicate asserting both.
    const scenario: Scenario = {
      id: 'symlink-setup-roundtrip',
      conventionUnderTest: 'skills',
      harnessCompat: ['codex'],
      setup: {
        files: [
          {
            path: '.agents/skills/writing-tests/SKILL.md',
            content: '---\nname: writing-tests\ndescription: Write failing tests first.\n---\n',
          },
          {
            path: '.claude/skills/writing-tests',
            kind: 'symlink',
            symlinkTarget: '../../.agents/skills/writing-tests',
          },
        ],
      },
      prompt: '',
      predicate: (ctx) => {
        const native = ctx.repo.files['.agents/skills/writing-tests/SKILL.md'];
        const link = ctx.repo.files['.claude/skills/writing-tests'];
        if (!native || native.type !== 'file') {
          return { pass: false, reason: 'native .agents/skills/skills file missing' };
        }
        if (!link || link.type !== 'symlink') {
          return { pass: false, reason: '.claude/skills symlink not captured in snapshot' };
        }
        if (link.target !== '../../.agents/skills/writing-tests') {
          return { pass: false, reason: `symlink target not stored as given: ${String(link.target)}` };
        }
        return { pass: true, reason: 'native file present and symlink entry captured with target' };
      },
      evidenceLevels: ['deterministic'],
    };
    const runner: Runner = { kind: 'container', run: async () => ({ status: 'ok', output: '' }) };
    const outcome = await runScenario(scenario, runner, {
      harnessId: 'codex', version: '0.155.1', repoRoot, homeDir,
      prompt: scenario.prompt,
    });
    expect(outcome.result).toBe(true);
    expect(outcome.reason).toBe('native file present and symlink entry captured with target');
  });

  it('rejects a symlink setup file without symlinkTarget with a clear error', async () => {
    const scenario: Scenario = {
      id: 'symlink-missing-target',
      conventionUnderTest: 'skills',
      harnessCompat: ['codex'],
      setup: { files: [{ path: '.claude/skills/writing-tests', kind: 'symlink' }] },
      prompt: '',
      predicate: () => ({ pass: true, reason: 'unreachable — setup must fail first' }),
      evidenceLevels: ['deterministic'],
    };
    const runner: Runner = { kind: 'container', run: async () => ({ status: 'ok', output: '' }) };
    await expect(runScenario(scenario, runner, {
      harnessId: 'codex', version: '0.155.1', repoRoot, homeDir, prompt: '',
    })).rejects.toThrow('setup: symlink at ".claude/skills/writing-tests" requires symlinkTarget');
  });
});