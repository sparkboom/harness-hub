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

