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

  it('skips dispatch for an empty prompt and never calls the executor', async () => {
    let calls = 0;
    const runner = containerRunner({
      build: () => { calls += 1; return { status: 'ok', output: '' }; },
      run: () => { calls += 1; return { status: 'ok', output: 'done' }; },
    });
    const res = await runner.run({
      harnessId: 'codex', version: '0.155.1',
      repoRoot: '/tmp/repo', homeDir: '/tmp/home', prompt: '',
    });
    expect(res).toEqual({
      status: 'ok',
      output: 'no prompt — deterministic scenario, container dispatch skipped',
    });
    expect(calls).toBe(0);
  });
});