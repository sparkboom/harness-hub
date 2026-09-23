// test/tools/verify/runner-human.ts
//
// The `human` Runner: for harnesses that are human-only (e.g. cursor, per
// spec R5), this runner prints the scenario prompt and waits for the human
// operator to signal they have acted in the GUI/IDE before snapshots are
// taken and the predicate is evaluated.
//
// `io` is injectable so tests never touch real stdin; the default io()
// prompts on the process's stdio.
//
// Task 4 ruling: Runner.run implementations must never throw — unexpected
// failures are converted into a failed RunResult so runScenario's
// snapshot/predicate pipeline still completes.

import { createInterface } from 'node:readline';
import type { Runner, RunContext, RunResult } from './runner';

export interface HumanIO {
  print(msg: string): void;
  ask(question: string): Promise<string>;
}

function stdinIO(): HumanIO {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return {
    print: (msg) => console.log(msg),
    ask: (q) => new Promise((resolve) => rl.question(q + ' ', (a) => resolve(a))),
  };
}

export function humanRunner(io: HumanIO = stdinIO()): Runner {
  return {
    kind: 'human',
    async run(ctx: RunContext): Promise<RunResult> {
      try {
        io.print(`\n=== human runner — ${ctx.harnessId} ${ctx.version} ===`);
        io.print('Repo: ' + ctx.repoRoot);
        io.print('\nPaste this prompt into the harness UI/IDE:');
        io.print('----');
        io.print(ctx.prompt);
        io.print('----');
        await io.ask('Once the harness has acted, type "done" and press Enter:');
        return { status: 'ok', output: 'human signaled completion' };
      } catch (e) {
        // Task 4 ruling: never throw out of run(); surface as a failed RunResult.
        return { status: 'failed', output: '', error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}