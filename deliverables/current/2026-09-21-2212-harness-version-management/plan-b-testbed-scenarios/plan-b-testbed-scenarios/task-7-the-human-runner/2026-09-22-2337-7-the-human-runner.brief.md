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

