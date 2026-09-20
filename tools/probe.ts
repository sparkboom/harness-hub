import { spawnSync } from 'node:child_process';
import { resolveBinary } from './detect';

export interface ProbeSpec {
  cmd: string;
  args: string[];
}

// First-cut headless invocations. The four well-documented harnesses use their
// scripted modes; hermes/pi/deepseek use their most likely `run`/`-p` forms
// and are confirmed by running this tool itself (spec R4 — probe is the
// verification aid).
export const PROBE_COMMANDS: Record<string, (repoRoot: string) => ProbeSpec> = {
  'claude-code': () => ({ cmd: 'claude', args: ['-p', 'List the skills available in this repo and summarize AGENTS.md.'] }),
  cursor: (root) => ({ cmd: 'agent', args: ['-p', 'List your skills and summarize AGENTS.md.', '--mode', 'ask', '--trust', '--workspace', root] }),
  opencode: () => ({ cmd: 'opencode', args: ['run', 'List the skills available in this repo and summarize AGENTS.md.'] }),
  codex: () => ({ cmd: 'codex', args: ['exec', 'List the skills available in this repo and summarize AGENTS.md.'] }),
  hermes: () => ({ cmd: 'hermes', args: ['run', 'List the skills available in this repo and summarize AGENTS.md.'] }),
  pi: () => ({ cmd: 'pi', args: ['-p', 'List the skills available in this repo and summarize AGENTS.md.'] }),
  deepseek: () => ({ cmd: 'dsh', args: ['run', 'List the skills available in this repo and summarize AGENTS.md.'] }),
};

export type ProbeRunner = (spec: ProbeSpec) => string;

function defaultRunner(spec: ProbeSpec): string {
  const r = spawnSync(spec.cmd, spec.args, { encoding: 'utf8', stdio: 'inherit', timeout: 120000 });
  return r.error ? r.error.message : '';
}

export function probeHarness(
  id: string,
  repoRoot: string,
  run: ProbeRunner = defaultRunner
): { exitCode: number; output: string } {
  const make = PROBE_COMMANDS[id];
  if (!make) {
    return { exitCode: 1, output: `probe: unrecognized harness id "${id}".` };
  }
  const binary = resolveBinary(id);
  if (!binary) {
    return { exitCode: 1, output: `probe: ${id} is not installed (run detect to see the roster).` };
  }
  const spec = make(repoRoot);
  const err = run(spec);
  if (err) {
    return { exitCode: 1, output: `probe: ${id} failed: ${err}` };
  }
  return { exitCode: 0, output: `probe: ${id} ran (${spec.cmd} ${spec.args.join(' ')}).` };
}

export async function main(argv: string[]): Promise<number> {
  if (argv.length !== 1) {
    console.error('Usage: probe <harness-id>');
    return 1;
  }
  const result = probeHarness(argv[0], process.cwd());
  if (result.output) console.log(result.output);
  return result.exitCode;
}
