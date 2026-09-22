### Task 6: `env` CLI, shim, and R7 gate (R3)

**Files:**
- Create: `test/tools/env.mjs`
- Modify: `test/tools/env.ts` (add `parseArgs`, `runShell`, `confirmRemove`, `extractRoot`, `main`, `USAGE`)
- Modify: `test/tools/env.test.ts` (add `parseArgs` tests)

**Interfaces:**
- Consumes: the Task 5 core exports.
- Produces: the runnable `env` CLI: `env create [name]` (alias `init`), `env rm <name> [--yes]`, `env ls`, `env shell [name]`, `env generate <name> <scenario> [--target <dir>]`, with a global `--root <dir>` override. `main(argv, defaultRoot?)` returns a `Promise<number>`.

- [ ] **Step 1: Write the failing parseArgs tests**

Append to `test/tools/env.test.ts` (import `parseArgs` and add to the `env manager` describe block):

```ts
  it('parses create with default and explicit names', () => {
    expect(parseArgs(['create'])).toEqual({ kind: 'create', name: 'playground' });
    expect(parseArgs(['create', 'foo'])).toEqual({ kind: 'create', name: 'foo' });
  });

  it('parses rm with --yes', () => {
    expect(parseArgs(['rm', 'foo', '--yes'])).toEqual({ kind: 'rm', name: 'foo', yes: true });
    expect(parseArgs(['rm', 'foo'])).toEqual({ kind: 'rm', name: 'foo', yes: false });
  });

  it('parses ls', () => {
    expect(parseArgs(['ls'])).toEqual({ kind: 'ls' });
  });

  it('parses shell with optional name', () => {
    expect(parseArgs(['shell'])).toEqual({ kind: 'shell' });
    expect(parseArgs(['shell', 'foo'])).toEqual({ kind: 'shell', name: 'foo' });
  });

  it('parses generate with optional target', () => {
    expect(parseArgs(['generate', 'foo', 'baseline'])).toEqual({ kind: 'generate', name: 'foo', scenario: 'baseline' });
    expect(parseArgs(['generate', 'foo', 'baseline', '--target', '/tmp/x']))
      .toEqual({ kind: 'generate', name: 'foo', scenario: 'baseline', target: '/tmp/x' });
  });

  it('rejects an unknown command', () => {
    expect(() => parseArgs(['frobnicate'])).toThrow(/Unknown command/);
  });
```

- [ ] **Step 2: Run to confirm they fail**

Run: `npx vitest run test/tools/env.test.ts`
Expected: FAIL — `parseArgs` is not exported.

- [ ] **Step 3: Add the CLI surface to `env.ts`**

Add these imports to the top of `test/tools/env.ts` (extend the `node:fs` import with `readSync`):

```ts
import { readSync } from 'node:fs';
```

Then append the CLI section:

```ts
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
```

- [ ] **Step 4: Create the `.mjs` shim**

Create `test/tools/env.mjs` (mirror of `generate.mjs`/`detect.mjs`/`probe.mjs`, loading `dist/env.js`):

```js
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, 'dist', 'env.js');
if (!existsSync(entry)) {
  console.error('tools not built — run: npm run build:tools');
  process.exit(1);
}
const require = createRequire(import.meta.url);
const { main } = require(entry);
main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

- [ ] **Step 5: Verify unit tests + build + smoke from outside `test/tools`**

Run:

```bash
npx vitest run test/tools/env.test.ts
npm run build:tools
node test/tools/env.mjs ls
node test/tools/env.mjs create smoke
node test/tools/env.mjs ls
node test/tools/env.mjs rm smoke --yes
```

Expected: unit tests pass; `build:tools` emits `test/tools/dist/env.js`; `env ls` prints nothing (no envs yet); `env create smoke` prints a warning banner (R7, since not in `nix develop`) then creates `test/env/smoke/` with a nested `.git`, `package.json` (name `harness-hub-env-smoke`), and `AGENTS.md`; `env ls` prints `smoke`; `env rm smoke --yes` removes it. Because `env.mjs` resolves its location via `import.meta.url` (and `env.ts` via `__dirname`), these commands work from any CWD — run them from the repo root to prove cwd-independence.

Confirm `git status` shows **no** `test/env/` entries (git-ignored via `test/env/**`).

- [ ] **Step 6: Commit**

```bash
git add test/tools/env.ts test/tools/env.test.ts test/tools/env.mjs
git commit -m "feat: env CLI (create/rm/ls/shell/generate) with R7 gate and .mjs shim"
```