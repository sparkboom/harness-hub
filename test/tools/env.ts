import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, readSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { generateScenario } from './generate';

export const DEFAULT_ENV_NAME = 'playground';

// Walk up from a tool path (test/tools or test/tools/dist) to the `test/`
// folder, identified by the presence of flake.nix + tools/ + template/.
export function resolveTestDir(fromDir: string): string {
  let dir = fromDir;
  for (let i = 0; i < 4; i++) {
    if (
      existsSync(join(dir, 'flake.nix')) &&
      existsSync(join(dir, 'tools')) &&
      existsSync(join(dir, 'template'))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('test/ folder not found (expected flake.nix + tools/ + template/)');
}

export function envDir(root: string): string {
  return join(root, 'env');
}

export function templateDir(root: string): string {
  return join(root, 'template');
}

// A single non-dot, non-`..` path segment (defense against escaping test/env/).
export function isValidName(name: string): boolean {
  return name.length > 0 && name !== '.' && name !== '..' && !name.includes('/') && !name.includes('\\');
}

export function resolveEnvPath(root: string, name: string): string {
  if (!isValidName(name)) {
    throw new Error(`Invalid env name "${name}": must be a single path segment (no '/', not '.' or '..').`);
  }
  return join(root, 'env', name);
}

export interface TemplateRender {
  packageJson: string;
  agentsMd: string;
}

export function renderTemplate(root: string, name: string): TemplateRender {
  const pkg = JSON.parse(readFileSync(join(templateDir(root), 'package.json'), 'utf8')) as { name: string };
  pkg.name = `harness-hub-env-${name}`;
  return {
    packageJson: JSON.stringify(pkg, null, 2) + '\n',
    agentsMd: readFileSync(join(templateDir(root), 'AGENTS.md'), 'utf8'),
  };
}

export interface CreateOptions {
  link?: boolean;
  gitInit?: boolean;
}

export function createEnv(root: string, name: string, opts: CreateOptions = {}): string {
  const { link = true, gitInit = true } = opts;
  const envPath = resolveEnvPath(root, name);
  mkdirSync(envPath, { recursive: true });

  if (gitInit && !existsSync(join(envPath, '.git'))) {
    try {
      const r = spawnSync('git', ['init'], { cwd: envPath, encoding: 'utf8' });
      if (r.error || r.status !== 0) {
        // Log warning but don't fail - this might be due to sandbox restrictions
        console.warn(`git init failed in ${envPath}: ${r.error?.message ?? r.stderr}`);
      }
    } catch (e) {
      // Log warning but don't fail - this might be due to sandbox restrictions
      console.warn(`git init failed in ${envPath}: ${e}`);
    }
  }

  const { packageJson, agentsMd } = renderTemplate(root, name);
  writeFileSync(join(envPath, 'package.json'), packageJson, 'utf8');
  writeFileSync(join(envPath, 'AGENTS.md'), agentsMd, 'utf8');

  if (link) {
    linkHarnessHub(root);
  }
  return envPath;
}

export function linkHarnessHub(root: string): void {
  const repoRoot = dirname(root); // test/ lives at the repo root
  const probe = spawnSync('sh', ['-c', 'command -v harness-hub'], { encoding: 'utf8' });
  if (probe.status === 0 && probe.stdout.trim()) {
    return; // already linked — skip
  }
  const r = spawnSync('npm', ['link'], { cwd: repoRoot, encoding: 'utf8', stdio: 'inherit' });
  if (r.error || r.status !== 0) {
    throw new Error(`npm link failed: ${r.error?.message ?? r.stderr}`);
  }
}

export function listEnvs(root: string): string[] {
  const dir = envDir(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

export function rmEnv(root: string, name: string): void {
  const envPath = resolveEnvPath(root, name);
  if (!existsSync(envPath)) {
    throw new Error(`Unknown env "${name}" (nothing at ${envPath}).`);
  }
  rmSync(envPath, { recursive: true, force: true });
}

export function generateIntoEnv(root: string, name: string, scenario: string): void {
  generateScenario(resolveEnvPath(root, name), scenario);
}

// R9/R7 gate: unpinned observation must never be silent. env commands warn
// (they construct/use, not observe) — they do not refuse.
export function warnIfUnpinned(stderr: (msg: string) => void = console.error): void {
  if (!process.env.IN_NIX_SHELL) {
    stderr('env: WARNING — not running inside `nix develop`. Run `env shell` for pinned harnesses.');
  }
}

// ---- CLI ----
const USAGE = `usage: env <command> [args] [--root <test-dir>]
  env create [name]                 construct an env (default "playground"; alias: init)
  env rm <name> [--yes]             remove an env
  env ls                            list envs
  env shell [name]                  enter nix develop against test/flake.nix
  env generate <name> <scenario> [--target <dir>]
                                    generate a scenario into an env
`;

export type EnvCommand =
  | { kind: 'create'; name: string }
  | { kind: 'rm'; name: string; yes: boolean }
  | { kind: 'ls' }
  | { kind: 'shell'; name?: string }
  | { kind: 'generate'; name: string; scenario: string; target?: string };

export function parseArgs(argv: string[]): EnvCommand {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'create':
    case 'init':
      return { kind: 'create', name: rest[0] ?? DEFAULT_ENV_NAME };
    case 'rm': {
      if (!rest[0]) throw new Error('Usage: env rm <name> [--yes]');
      return { kind: 'rm', name: rest[0], yes: rest.includes('--yes') };
    }
    case 'ls':
      return { kind: 'ls' };
    case 'shell':
      return { kind: 'shell', name: rest[0] };
    case 'generate': {
      const [name, scenario, ...opts] = rest;
      if (!name || !scenario) throw new Error('Usage: env generate <name> <scenario> [--target <dir>]');
      let target: string | undefined;
      for (let i = 0; i < opts.length; i++) {
        if (opts[i] === '--target') target = opts[++i];
        else if (opts[i].startsWith('--target=')) target = opts[i].slice('--target='.length);
      }
      return target ? { kind: 'generate', name, scenario, target } : { kind: 'generate', name, scenario };
    }
    default:
      throw new Error(`Unknown command "${cmd}". ${USAGE}`);
  }
}

function extractRoot(argv: string[]): { root?: string; rest: string[] } {
  const rest: string[] = [];
  let root: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') { root = argv[++i]; }
    else if (argv[i].startsWith('--root=')) { root = argv[i].slice('--root='.length); }
    else { rest.push(argv[i]); }
  }
  return { root, rest };
}

export function runShell(root: string, name?: string): number {
  let cwd = dirname(root); // repo root
  if (name) {
    const envPath = resolveEnvPath(root, name);
    if (!existsSync(envPath)) {
      throw new Error(`Unknown env "${name}" — run \`env create ${name}\` first.`);
    }
    cwd = envPath;
  }
  const r = spawnSync('nix', ['develop', '--flake', root], { cwd, stdio: 'inherit' });
  return r.status ?? 1;
}

function confirmRemove(name: string): boolean {
  process.stdout.write(`Remove env "${name}" (test/env/${name}/) permanently? [y/N] `);
  const buf = Buffer.alloc(16);
  let n = 0;
  try {
    n = readSync(0, buf, 0, 16, null);
  } catch {
    return false;
  }
  const answer = buf.toString('utf8', 0, n).trim().toLowerCase();
  return answer === 'y' || answer === 'yes';
}

export async function main(argv: string[], defaultRoot?: string): Promise<number> {
  const { root: rootOverride, rest } = extractRoot(argv);
  const root = defaultRoot ?? rootOverride ?? resolveTestDir(__dirname);
  try {
    const cmd = parseArgs(rest);
    switch (cmd.kind) {
      case 'create': {
        warnIfUnpinned();
        const envPath = createEnv(root, cmd.name);
        console.log(`env: created ${cmd.name} at ${envPath}`);
        return 0;
      }
      case 'rm': {
        if (!cmd.yes && !confirmRemove(cmd.name)) return 1;
        rmEnv(root, cmd.name);
        console.log(`env: removed ${cmd.name}`);
        return 0;
      }
      case 'ls': {
        for (const name of listEnvs(root)) console.log(name);
        return 0;
      }
      case 'shell':
        return runShell(root, cmd.name);
      case 'generate': {
        warnIfUnpinned();
        const dest = cmd.target ?? resolveEnvPath(root, cmd.name);
        generateScenario(dest, cmd.scenario);
        console.log(`env: generated "${cmd.scenario}" into ${dest}`);
        return 0;
      }
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}