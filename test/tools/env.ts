import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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