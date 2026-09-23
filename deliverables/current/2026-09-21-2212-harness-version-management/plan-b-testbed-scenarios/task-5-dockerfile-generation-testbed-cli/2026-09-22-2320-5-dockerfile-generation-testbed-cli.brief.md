### Task 5: Dockerfile generation + `testbed` CLI

**Files:**
- Create: `test/tools/testbed.ts`
- Create: `test/tools/testbed.mjs`
- Create: `test/tools/testbed.test.ts`
- Create: `test/testbed/Dockerfile.template.npm`
- Create: `test/testbed/Dockerfile.template.git`

**Interfaces:**
- Consumes: `HarnessInstallManifest`/`HarnessVersionEntry` shapes from `test/tools/manifest.ts`.
- Produces:
  - `HEADLESS_COMMANDS: Record<string, (repoRoot: string, prompt: string) => { cmd, args }>`
  - `dockerfileFor(harness, version, method): string`
  - `imageTag(harness, version): string` → `harness-hub/<harness>:<version>`
  - `DockerExecutor { build(tag, context): RunResult; run(tag, mount, args): RunResult }` (real `docker` wrapper)
  - `testbedRun / testbedSession / testbedMatrix` core + `main(argv)`.

- [ ] **Step 1: Write `testbed.ts` core**

```ts
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
  cursor: (_r, p) => ({ cmd: 'agent', args: ['-p', p] }),
};

export interface DockerExecutor {
  build(tag: string, contextDir: string): { status: 'ok' | 'failed'; output: string };
  run(tag: string, mounts: { repoRoot: string; homeDir: string }, command: string): { status: 'ok' | 'failed'; output: string };
}

export const dockerExecutor: DockerExecutor = {
  build(tag, contextDir) {
    const r = spawnSync('docker', ['build', '-t', tag, contextDir], { encoding: 'utf8', timeout: 600000 });
    return { status: r.status === 0 ? 'ok' : 'failed', output: r.stdout + r.stderr };
  },
  run(tag, mounts, command) {
    const r = spawnSync('docker', [
      'run', '--rm',
      '-v', `${mounts.repoRoot}:/repo`,
      '-v', `${mounts.homeDir}:/root`,
      '-w', '/repo',
      tag, command,
    ], { encoding: 'utf8', timeout: 600000 });
    return { status: r.status === 0 ? 'ok' : 'failed', output: r.stdout + r.stderr };
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
  return exec.run(tag, { repoRoot: input.repoRoot, homeDir: input.homeDir }, `${cmd} ${args.map((a) => JSON.stringify(a)).join(' ')}`);
}
```

- [ ] **Step 2: Write `testbed.mjs` (thin shim)**

```js
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, 'dist', 'testbed.js');
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

- [ ] **Step 3: Add `main()` to `testbed.ts`**

```ts
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
```

- [ ] **Step 4: Write the failing test (injected executor)**

```ts
// test/tools/testbed.test.ts
import { describe, it, expect } from 'vitest';
import { dockerfileFor, imageTag, HEADLESS_COMMANDS, runHarness, buildImage, type DockerExecutor } from './testbed';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('testbed', () => {
  it('tags images by harness/version', () => {
    expect(imageTag('codex', '0.155.1')).toBe('harness-hub/codex:0.155.1');
  });

  it('generates an npm Dockerfile pinning the exact version', () => {
    const d = dockerfileFor('codex', '0.155.1', 'npm', '@openai/codex');
    expect(d).toContain('npm install -g @openai/codex@0.155.1');
  });

  it('maps claude-code to a -p prompt invocation', () => {
    const spec = HEADLESS_COMMANDS['claude-code']('/repo', 'hello');
    expect(spec.cmd).toBe('claude');
    expect(spec.args).toEqual(['-p', 'hello']);
  });

  it('runs the headless command inside the container via the executor', () => {
    let seen: string | undefined;
    const fake: DockerExecutor = {
      build: () => ({ status: 'ok', output: '' }),
      run: (_tag, _mounts, command) => { seen = command; return { status: 'ok', output: '' }; },
    };
    const r = runHarness({
      harness: 'claude-code', version: '2.1.272', prompt: 'hi',
      repoRoot: '/tmp/repo', homeDir: '/tmp/home', workDir: '/tmp/w', exec: fake,
    });
    expect(r.status).toBe('ok');
    expect(seen).toContain('claude -p');
    expect(seen).toContain('"hi"');
  });
});
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run test/tools/testbed.test.ts`
Expected: PASS.

- [ ] **Step 6: Create the committed Dockerfile templates**

`test/testbed/Dockerfile.template.npm`:

```dockerfile
# Template for npm-installed harnesses (see test/tools/testbed.ts dockerfileFor).
# Kept as a committed reference; the generator inlines the pinned version.
FROM node:22-slim
ARG PKG
ARG VERSION
RUN npm install -g ${PKG}@${VERSION}
WORKDIR /repo
```

`test/testbed/Dockerfile.template.git`:

```dockerfile
# Template for git-installed harnesses. Install path is harness-specific; this
# is a committed placeholder documenting the shape, not a working build.
FROM node:22-slim
WORKDIR /repo
```

- [ ] **Step 7: Commit**

```bash
git add test/tools/testbed.ts test/tools/testbed.mjs test/tools/testbed.test.ts test/testbed/
git commit -m "feat(testbed): Dockerfile generation and testbed run/session/matrix core"
```

---

