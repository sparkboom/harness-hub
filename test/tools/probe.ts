import { spawnSync } from 'node:child_process';
import { resolveBinary } from './detect';

export interface ProbeSpec {
  cmd: string;
  args: string[];
}

// First-cut headless invocations. The four well-documented harnesses use their
// scripted modes; hermes/pi/deepseek use their most likely `run`/`-p` forms
// and are confirmed by running this tool itself (spec R4 — probe is the
// verification aid). Builders receive the binary located by `resolveBinary`
// so the spawn uses the same executable detection found (e.g. cursor's
// standalone agent CLI at ~/.local/bin/agent is usually off-PATH).
export const PROBE_COMMANDS: Record<string, (repoRoot: string, binary: string) => ProbeSpec> = {
  'claude-code': (_root, binary) => ({ cmd: binary, args: ['-p', 'List the skills available in this repo and summarize AGENTS.md.'] }),
  cursor: (root, binary) => ({ cmd: binary, args: ['-p', 'List your skills and summarize AGENTS.md.', '--mode', 'ask', '--trust', '--workspace', root] }),
  opencode: (_root, binary) => ({ cmd: binary, args: ['run', 'List the skills available in this repo and summarize AGENTS.md.'] }),
  codex: (_root, binary) => ({ cmd: binary, args: ['exec', 'List the skills available in this repo and summarize AGENTS.md.'] }),
  hermes: (_root, binary) => ({ cmd: binary, args: ['run', 'List the skills available in this repo and summarize AGENTS.md.'] }),
  pi: (_root, binary) => ({ cmd: binary, args: ['-p', 'List the skills available in this repo and summarize AGENTS.md.'] }),
  deepseek: (_root, binary) => ({ cmd: binary, args: ['run', 'List the skills available in this repo and summarize AGENTS.md.'] }),
};

export type ProbeRunner = (spec: ProbeSpec) => string;

function defaultRunner(spec: ProbeSpec): string {
  const r = spawnSync(spec.cmd, spec.args, { encoding: 'utf8', stdio: 'inherit', timeout: 120000 });
  if (r.error) return r.error.message;
  if (r.status !== 0) return `exited with status ${r.status}`;
  return '';
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
  const spec = make(repoRoot, binary);
  const err = run(spec);
  if (err) {
    return { exitCode: 1, output: `probe: ${id} failed: ${err}` };
  }
  return { exitCode: 0, output: `probe: ${id} ran (${spec.cmd} ${spec.args.join(' ')}).` };
}

// R9 (controller ruling): probing from outside `nix develop` observes the
// unpinned host environment. That is allowed but must never happen SILENTLY —
// warn and continue; do not refuse.
export function warnIfUnpinned(stderr: (msg: string) => void = console.error): void {
  if (!process.env.IN_NIX_SHELL) {
    stderr(
      'probe: WARNING — not running inside `nix develop`. Observing the unpinned host environment (R9). Run `npm run shell` for pinned harnesses.'
    );
  }
}

export async function main(argv: string[]): Promise<number> {
  if (argv.length !== 1) {
    console.error('Usage: probe <harness-id>');
    return 1;
  }
  warnIfUnpinned();
  const result = probeHarness(argv[0], process.cwd());
  if (result.output) console.log(result.output);
  return result.exitCode;
}
