// test/tools/verify/runner-human.test.ts
import { describe, it, expect } from 'vitest';
import { humanRunner } from './runner-human';

describe('humanRunner', () => {
  it('prints the prompt and waits for the human to signal completion', async () => {
    let printed = '';
    const asked: string[] = [];
    const runner = humanRunner({
      print: (msg) => { printed += msg + '\n'; },
      ask: async (q) => { asked.push(q); return 'done'; },
    });
    expect(runner.kind).toBe('human');
    const res = await runner.run({
      harnessId: 'cursor', version: '3.x',
      repoRoot: '/tmp/repo', homeDir: '/tmp/home', prompt: 'Create a spec file.',
    });
    expect(res.status).toBe('ok');
    expect(printed).toContain('=== human runner');
    expect(printed).toContain('Create a spec file.');
    expect(asked.length).toBe(1);
    expect(asked[0]).toContain('done');
  });
});