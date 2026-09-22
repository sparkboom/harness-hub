// test/tools/testbed.ts
//
// Docker testbed core: generate per-harness Dockerfiles, build images, and
// run harnesses' headless commands inside containers. Consumes the harness
// version manifest (test/tools/manifest.ts); never imports from src/ (Task 1
// ruling — even type-only src imports break the tools tsconfig build).
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadManifest } from './manifest';

export function imageTag(harness: string, version: string): string {
  return `harness-hub/${harness}:${version}`;
}

export function dockerfileFor(harness: string, version: string, method: string, pkg: string | undefined): string {
  if (method === 'npm') {
    return `FROM node:22-slim
RUN npm install -g ${pkg}@${version}
WORKDIR /repo
ENTRYPOINT ["sh", "-c"]
`;
  }
  if (method === 'fhs-wrapper') {
    // Cursor: install script into a plain image; `agent` lands on PATH.
    return `FROM node:22-slim
RUN apt-get update && apt-get install -y curl && curl -fsSL https://cursor.com/install | bash
WORKDIR /repo
ENTRYPOINT ["sh", "-c"]
`;
  }
  // git / unknown → placeholder that documents the harness's own install path.
  return `FROM node:22-slim
# install ${harness}@${version} per its own instructions
WORKDIR /repo
ENTRYPOINT ["sh", "-c"]
`;
}

export function imageName(id: string): string {
  return id.replace(/[^a-z0-9.-]/g, '-');
}

// Prompt-parameterized headless invocations, mirroring PROBE_COMMANDS shapes.
export const HEADLESS_COMMANDS: Record<string, (repoRoot: string, prompt: string) => { cmd: string; args: string[] }> = {
  'claude-code': (_r, p) => ({ cmd: 'claude', args: ['-p', p] }),
  'cursor-cli': (r, p) => ({ cmd: 'agent', args: ['-p', p, '--mode', 'ask', '--trust', '--workspace', r] }),
  opencode: (_r, p) => ({ cmd: 'opencode', args: ['run', p] }),
  codex: (_r, p) => ({ cmd: 'codex', args: ['exec', p] }),
  hermes: (_r, p) => ({ cmd: 'hermes', args: ['run', p] }),
  pi: (_r, p) => ({ cmd: 'pi', args: ['-p', p] }),
  deepseek: (_r, p) => ({ cmd: 'dsh', args: ['run', p] }),
  // cursor (IDE) is human-only (spec R5) and is never dispatched through the
  // container runner. This entry documents the in-container agent CLI shape
  // for completeness but intentionally departs from PROBE_COMMANDS mirroring:
  // probe's 'cursor' entry (standalone agent CLI with --mode ask --trust
  // --workspace) is mirrored by the 'cursor-cli' entry above, not this one.
  // Consequently this entry is never exercised by `testbed run`.
  cursor: (_r, p) => ({ cmd: 'agent', args: ['-p', p] }),
};

export interface DockerExecutor {
  build(tag: string, contextDir: string): { status: 'ok' | 'failed'; output: string };
  run(tag: string, mounts: { repoRoot: string; homeDir: string }, command: string): { status: 'ok' | 'failed'; output: string };
}

export const dockerExecutor: DockerExecutor = {
  build(tag, contextDir) {
    const r = spawnSync('docker', ['build', '-t', tag, contextDir], { encoding: 'utf8', timeout: 600000 });
    // stdout/stderr are undefined when the spawn itself fails (ENOENT, etc.).
    return { status: r.status === 0 ? 'ok' : 'failed', output: (r.stdout ?? '') + (r.stderr ?? '') };
  },
  run(tag, mounts, command) {
    const r = spawnSync('docker', [
      'run', '--rm',
      '-v', `${mounts.repoRoot}:/repo`,
      '-v', `${mounts.homeDir}:/root`,
      '-w', '/repo',
      tag, command,
    ], { encoding: 'utf8', timeout: 600000 });
    return { status: r.status === 0 ? 'ok' : 'failed', output: (r.stdout ?? '') + (r.stderr ?? '') };
  },
};

export interface TestbedBuildInput {
  harness: string;
  version: string;
  workDir: string;
  exec?: DockerExecutor;
}

export function buildImage(input: TestbedBuildInput): { tag: string; result: { status: 'ok' | 'failed'; output: string } } {
  const exec = input.exec ?? dockerExecutor;
  const m = loadManifest();
  const entry = m[input.harness];
  if (!entry) throw new Error(`testbed: unknown harness "${input.harness}"`);
  const method = entry.install.method;
  const pkg = entry.install.package;
  const tag = imageTag(imageName(input.harness), input.version);
  const contextDir = join(input.workDir, 'context');
  mkdirSync(contextDir, { recursive: true });
  writeFileSync(join(contextDir, 'Dockerfile'), dockerfileFor(input.harness, input.version, method, pkg));
  return { tag, result: exec.build(tag, contextDir) };
}

export interface TestbedRunInput {
  harness: string;
  version: string;
  prompt: string;
  repoRoot: string;
  homeDir: string;
  workDir: string;
  exec?: DockerExecutor;
}

export function runHarness(input: TestbedRunInput): { status: 'ok' | 'failed'; output: string } {
  const exec = input.exec ?? dockerExecutor;
  const make = HEADLESS_COMMANDS[input.harness];
  if (!make) throw new Error(`testbed: no headless command for "${input.harness}"`);
  const tag = imageTag(imageName(input.harness), input.version);
  const { cmd, args } = make('/repo', input.prompt);
  // The image ENTRYPOINT is ["sh", "-c"], so the command string is re-parsed
  // by a shell: flag tokens stay bare, value tokens are JSON-quoted (double
  // quotes) so prompts with spaces survive. Values containing $/backticks
  // would still be shell-expanded — developer-provided prompts only.
  return exec.run(tag, { repoRoot: input.repoRoot, homeDir: input.homeDir }, `${cmd} ${args.map((a) => (a.startsWith('-') ? a : JSON.stringify(a))).join(' ')}`);
}

const USAGE = `usage: testbed <command>
  testbed run     <harness> <version> --prompt "…" --repo <dir> --home <dir>
  testbed session <harness> <version> --resume <id> --prompt "…"
  testbed matrix  <harness> --versions a,b --prompt "…"
`;

export async function main(argv: string[]): Promise<number> {
  const [cmd, harness, ...rest] = argv;
  if (cmd === 'run' && harness) {
    const prompt = rest.includes('--prompt') ? rest[rest.indexOf('--prompt') + 1] : '';
    const repoRoot = rest.includes('--repo') ? rest[rest.indexOf('--repo') + 1] : process.cwd();
    const homeDir = rest.includes('--home') ? rest[rest.indexOf('--home') + 1] : join(process.cwd(), 'home');
    const version = rest[0] ?? '';
    const built = buildImage({ harness, version, workDir: join(process.cwd(), '.testbed') });
    if (built.result.status !== 'ok') { console.error(built.result.output); return 1; }
    const r = runHarness({ harness, version, prompt, repoRoot, homeDir, workDir: join(process.cwd(), '.testbed') });
    console.log(r.output);
    return r.status === 'ok' ? 0 : 1;
  }
  console.error(USAGE);
  return cmd ? 1 : 0;
}