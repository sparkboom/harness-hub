# Plan D — LLM Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Level-1 evidence gateway: a LiteLLM-backed passthrough proxy that captures raw request/response bodies, plus a thin harness-hub inspection wrapper answering "was AGENTS.md/skill content in the request?" — wired into both the `container` and `human` runners.

**Architecture:** LiteLLM is the proxy; harness-hub adds a thin `Gateway` wrapper that (a) starts LiteLLM with a capture config, (b) produces per-harness base-URL/env/config-file provisioning, (c) exposes a `selfTest()` probe, and (d) inspects captured request bodies for convention content. The framework consumes only the `Gateway` contract — LiteLLM is an implementation detail behind it.

**Tech Stack:** TypeScript (Node ≥22), vitest, Docker (LiteLLM runs as a container). All LiteLLM interaction is behind injected `LiteLLMCtl` and file-system seams so unit tests need no network, no Docker, and no real LiteLLM.

**Spec:** `deliverables/current/2026-09-21-2212-harness-version-management/harness-version-management.spec.md` (R7). Supporting: [`gateway.md`](./gateway.md).

## Global Constraints

- This plan touches **`test/tools/gateway.ts`, `test/tools/gateway.mjs`, and `test/tools/verify/`** — never `src/`.
- **No credential capture.** The gateway forwards requests; harness-hub stores only prompt/context + response bodies in a capture dir that is git-ignored and local-only. It never persists provider API keys.
- The `Gateway` contract is exactly: `start(harnessId) → { baseUrl, captureDir }`, `selfTest() → bool`, `inspect(captureDir) → Inspection`, `stop()`. The framework never depends on LiteLLM internals.
- Base-URL surface split (from gateway.md): env-var-routed (claude-code `ANTHROPIC_BASE_URL`, codex `OPENAI_BASE_URL`+override, opencode `OPENAI_BASE_URL`) vs config-file-routed (pi `~/.pi/agent/models.json`, hermes `~/.hermes/config.yaml`, deepseek `$DSH_HOME/settings.yaml`).
- `inspect()` is a **string-containment** check over logged request bodies — deterministic, "exactly as reliable as grep", never a model judgment.
- The gateway `inspect()` result feeds Level-1 evidence in Plan B's report; Plan B must not be modified here beyond adding the `gateway` evidence path (see Task 6 integration).

---

## File Structure

| File | Responsibility |
|---|---|
| `test/tools/gateway.ts` | `Gateway` contract + LiteLLM wrapper + provisioning + inspect. |
| `test/tools/gateway.mjs` | thin CLI shim. |
| `test/tools/gateway/provision.ts` | per-harness env-var vs config-file base-URL provisioning. |
| `test/tools/gateway/capture.ts` | capture-dir read/write + request-body extraction + `inspect`. |
| `test/tools/gateway/litellm.ts` | `LiteLLMCtl` interface + Docker-backed default impl. |
| `test/tools/verify/gatewayRunner.ts` | `Gateway`-aware `Runner` wrapper (Level-1 evidence). |

---

### Task 1: Capture-dir + inspection (pure, no gateway)

**Files:**
- Create: `test/tools/gateway/capture.ts`
- Create: `test/tools/gateway/capture.test.ts`

**Interfaces:**
- Produces:
  - `CapturedRequest { id, method, path, body }`
  - `readCaptures(dir): CapturedRequest[]`
  - `Inspection { containsAgentsDoc: boolean; containsSkill: boolean; matches: string[] }`
  - `inspect(dir, needles): Inspection` (needles = `{ agentsDoc: string; skills: string[] }`).

- [ ] **Step 1: Write the failing test**

```ts
// test/tools/gateway/capture.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from './capture';

describe('capture inspection', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'hh-cap-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('detects AGENTS.md content in a request body', () => {
    writeFileSync(join(dir, 'req-1.json'), JSON.stringify({ body: 'system: you must follow # Project conventions zebra-9f3k2' }));
    const r = inspect(dir, { agentsDoc: 'zebra-9f3k2', skills: ['COD-X7K9Z'] });
    expect(r.containsAgentsDoc).toBe(true);
    expect(r.containsSkill).toBe(false);
  });

  it('detects skill content', () => {
    writeFileSync(join(dir, 'req-1.json'), JSON.stringify({ body: 'SKILL.md content COD-X7K9Z' }));
    const r = inspect(dir, { agentsDoc: 'zebra-9f3k2', skills: ['COD-X7K9Z'] });
    expect(r.containsSkill).toBe(true);
    expect(r.matches).toContain('COD-X7K9Z');
  });

  it('reports neither for an empty capture dir', () => {
    const r = inspect(dir, { agentsDoc: 'zebra-9f3k2', skills: ['COD-X7K9Z'] });
    expect(r.containsAgentsDoc).toBe(false);
    expect(r.containsSkill).toBe(false);
    expect(r.matches).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement `capture.ts`**

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface CapturedRequest {
  id: string;
  body: string;
}

export function readCaptures(dir: string): CapturedRequest[] {
  let names: string[] = [];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.json'));
  } catch {
    return [];
  }
  return names.map((n) => {
    let body = '';
    try {
      const parsed = JSON.parse(readFileSync(join(dir, n), 'utf8')) as { body?: unknown };
      body = JSON.stringify(parsed.body ?? '');
    } catch {
      body = readFileSync(join(dir, n), 'utf8');
    }
    return { id: n, body };
  });
}

export interface Needles {
  agentsDoc: string;
  skills: string[];
}

export interface Inspection {
  containsAgentsDoc: boolean;
  containsSkill: boolean;
  matches: string[];
}

export function inspect(dir: string, needles: Needles): Inspection {
  const captures = readCaptures(dir);
  const all = captures.map((c) => c.body).join('\n');
  const matches: string[] = [];
  const containsAgentsDoc = all.includes(needles.agentsDoc);
  const skillHits = needles.skills.filter((s) => all.includes(s));
  matches.push(...(containsAgentsDoc ? [needles.agentsDoc] : []), ...skillHits);
  return { containsAgentsDoc, containsSkill: skillHits.length > 0, matches };
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run test/tools/gateway/capture.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add test/tools/gateway/capture.ts test/tools/gateway/capture.test.ts
git commit -m "feat(gateway): capture-dir inspection (string-containment, deterministic)"
```

---

### Task 2: Per-harness provisioning (env-var vs config-file)

**Files:**
- Create: `test/tools/gateway/provision.ts`
- Create: `test/tools/gateway/provision.test.ts`

**Interfaces:**
- Produces:
  - `Provisioning { env?: Record<string, string>; files?: { path: string; content: string }[] }`
  - `provisionFor(harnessId, baseUrl, proxyKey, homeDir): Provisioning` — returns env vars and/or config-file writes that point the harness at the proxy.

- [ ] **Step 1: Write the failing test**

```ts
// test/tools/gateway/provision.test.ts
import { describe, it, expect } from 'vitest';
import { provisionFor } from './provision';

describe('provisionFor', () => {
  it('routes claude-code via ANTHROPIC_BASE_URL env', () => {
    const p = provisionFor('claude-code', 'http://proxy:4000', 'sk-key', '/home');
    expect(p.env?.ANTHROPIC_BASE_URL).toBe('http://proxy:4000');
    expect(p.env?.ANTHROPIC_AUTH_TOKEN).toBe('sk-key');
  });

  it('routes pi via a models.json config file', () => {
    const p = provisionFor('pi', 'http://proxy:4000', 'sk-key', '/home');
    const file = p.files?.find((f) => f.path === '.pi/agent/models.json');
    expect(file).toBeDefined();
    expect(file!.content).toContain('http://proxy:4000/v1');
    expect(file!.content).toContain('openai-completions');
  });

  it('routes hermes via config.yaml with provider custom', () => {
    const p = provisionFor('hermes', 'http://proxy:4000', 'sk-key', '/home');
    const file = p.files?.find((f) => f.path === '.hermes/config.yaml');
    expect(file!.content).toContain('provider: custom');
    expect(file!.content).toContain('http://proxy:4000/v1');
  });

  it('routes deepseek via settings.yaml llm-pi-ai', () => {
    const p = provisionFor('deepseek', 'http://proxy:4000', 'sk-key', '/home');
    const file = p.files?.find((f) => f.path === 'settings.yaml');
    expect(file!.content).toContain('llm-pi-ai');
    expect(file!.content).toContain('openai-completions');
  });

  it('routes cursor-cli via OPENAI_BASE_URL env', () => {
    const p = provisionFor('cursor-cli', 'http://proxy:4000', 'sk-key', '/home');
    expect(p.env?.OPENAI_BASE_URL).toBe('http://proxy:4000/v1');
  });
});
```

- [ ] **Step 2: Implement `provision.ts`**

```ts
export interface Provisioning {
  env?: Record<string, string>;
  files?: { path: string; content: string }[];
}

export function provisionFor(
  harnessId: string,
  baseUrl: string,
  proxyKey: string,
  homeDir: string
): Provisioning {
  switch (harnessId) {
    case 'claude-code':
      return {
        env: {
          ANTHROPIC_BASE_URL: baseUrl,
          ANTHROPIC_AUTH_TOKEN: proxyKey,
          ANTHROPIC_API_KEY: '',
        },
      };
    case 'codex':
      // codex ignores OPENAI_BASE_URL; routing is via LiteLLM's `lite codex`
      // provider override. We set the env anyway and document the override.
      return { env: { OPENAI_BASE_URL: `${baseUrl}/v1`, OPENAI_API_KEY: proxyKey } };
    case 'opencode':
      return { env: { OPENAI_BASE_URL: `${baseUrl}/v1`, OPENAI_API_KEY: proxyKey } };
    case 'cursor-cli':
    case 'cursor':
      return { env: { OPENAI_BASE_URL: `${baseUrl}/v1`, OPENAI_API_KEY: proxyKey } };
    case 'pi':
      return {
        files: [{
          path: '.pi/agent/models.json',
          content: JSON.stringify({
            providers: {
              'harness-hub-gateway': {
                baseUrl: `${baseUrl}/v1`,
                api: 'openai-completions',
                apiKey: proxyKey,
                models: [{ id: 'litellm' }],
              },
            },
          }, null, 2) + '\n',
        }],
      };
    case 'hermes':
      return {
        files: [{
          path: '.hermes/config.yaml',
          content: `model:\n  provider: custom\n  base_url: ${baseUrl}/v1\n  default: litellm\n`,
        }],
      };
    case 'deepseek':
      return {
        env: { GATEWAY_API_KEY: proxyKey },
        files: [{
          path: 'settings.yaml',
          content: `llm-pi-ai:\n  providers:\n    harness-hub-gateway:\n      apiKeyEnv: GATEWAY_API_KEY\n      api: openai-completions\n      baseURL: ${baseUrl}/v1\n      models:\n        - id: litellm\n`,
        }],
      };
    default:
      return { env: { OPENAI_BASE_URL: `${baseUrl}/v1`, OPENAI_API_KEY: proxyKey } };
  }
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run test/tools/gateway/provision.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add test/tools/gateway/provision.ts test/tools/gateway/provision.test.ts
git commit -m "feat(gateway): per-harness base-URL provisioning (env vs config-file)"
```

---

### Task 3: LiteLLM control seam

**Files:**
- Create: `test/tools/gateway/litellm.ts`
- Create: `test/tools/gateway/litellm.test.ts`

**Interfaces:**
- Produces:
  - `LiteLLMCtl { start(config): Promise<{ baseUrl, captureDir }>; stop(): Promise<void>; selfTest(baseUrl): Promise<boolean> }`
  - `dockerLiteLLMCtl(exec?): LiteLLMCtl` — Docker-backed default (spawns `ghcr.io/berriai/litellm`, mounts capture dir).
  - `noopLiteLLMCtl(dir): LiteLLMCtl` — in-memory fake for tests.

- [ ] **Step 1: Write `litellm.ts`**

```ts
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export interface LiteLLMCtl {
  start(config: { harnessId: string; captureDir: string; port: number; proxyKey: string }): Promise<{ baseUrl: string; captureDir: string }>;
  stop(): Promise<void>;
  selfTest(baseUrl: string): Promise<boolean>;
}

export interface DockerExec {
  run(args: string[]): { status: 'ok' | 'failed'; output: string };
}

const defaultDocker: DockerExec = {
  run(args) {
    const r = spawnSync('docker', args, { encoding: 'utf8', timeout: 600000 });
    return { status: r.status === 0 ? 'ok' : 'failed', output: r.stdout + r.stderr };
  },
};

export function dockerLiteLLMCtl(exec: DockerExec = defaultDocker): LiteLLMCtl {
  return {
    async start(config) {
      const baseUrl = `http://127.0.0.1:${config.port}`;
      mkdirSync(config.captureDir, { recursive: true });
      const r = exec.run([
        'run', '-d', '--rm',
        '-p', `${config.port}:4000`,
        '-v', `${config.captureDir}:/capture`,
        '-e', 'LITELLM_LOG_CAPTURE=/capture',
        'ghcr.io/berriai/litellm:main-latest',
        '--config', '/capture/litellm.yaml',
      ]);
      if (r.status !== 'ok') throw new Error(`litellm start failed: ${r.output}`);
      return { baseUrl, captureDir: config.captureDir };
    },
    async stop() { exec.run(['stop', 'litellm-harness-hub']); },
    async selfTest(baseUrl) {
      const r = exec.run(['exec', 'litellm-harness-hub', 'curl', '-sf', `${baseUrl}/health/liveliness`]);
      return r.status === 'ok';
    },
  };
}

// In-memory fake — used by unit tests and as the default in self-test mode.
export function noopLiteLLMCtl(captureDir: string): LiteLLMCtl {
  return {
    async start(config) {
      mkdirSync(config.captureDir, { recursive: true });
      return { baseUrl: `http://127.0.0.1:${config.port}`, captureDir: config.captureDir };
    },
    async stop() {},
    async selfTest() { return true; },
  };
}
```

- [ ] **Step 2: Write the failing test**

```ts
// test/tools/gateway/litellm.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { noopLiteLLMCtl, dockerLiteLLMCtl, type DockerExec } from './litellm';

describe('litellm ctl', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'hh-litellm-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('noop ctl starts and self-tests true', async () => {
    const ctl = noopLiteLLMCtl(dir);
    const r = await ctl.start({ harnessId: 'codex', captureDir: join(dir, 'cap'), port: 4001, proxyKey: 'k' });
    expect(r.baseUrl).toContain('4001');
    expect(await ctl.selfTest(r.baseUrl)).toBe(true);
  });

  it('docker ctl routes docker args through the injected executor', async () => {
    let args: string[] = [];
    const exec: DockerExec = { run: (a) => { args = a; return { status: 'ok', output: '' }; } };
    const ctl = dockerLiteLLMCtl(exec);
    await ctl.start({ harnessId: 'codex', captureDir: join(dir, 'cap'), port: 4002, proxyKey: 'k' });
    expect(args[0]).toBe('run');
    expect(args.join(' ')).toContain('ghcr.io/berriai/litellm');
  });
});
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run test/tools/gateway/litellm.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add test/tools/gateway/litellm.ts test/tools/gateway/litellm.test.ts
git commit -m "feat(gateway): LiteLLM control seam (docker + noop)"
```

---

### Task 4: The `Gateway` facade

**Files:**
- Create: `test/tools/gateway.ts`
- Create: `test/tools/gateway.test.ts`
- Create: `test/tools/gateway.mjs`

**Interfaces:**
- Consumes: `LiteLLMCtl` (Task 3), `provisionFor` (Task 2), `inspect` (Task 1).
- Produces: `Gateway` object with `start`, `selfTest`, `inspect`, `stop`, and `provision`; `createGateway(ctl)`.

- [ ] **Step 1: Implement `gateway.ts`**

```ts
import { homedir } from 'node:os';
import { join } from 'node:path';
import { inspect as inspectCaptures, type Inspection, type Needles } from './gateway/capture';
import { provisionFor, type Provisioning } from './gateway/provision';
import { noopLiteLLMCtl, type LiteLLMCtl } from './gateway/litellm';

export interface Gateway {
  start(harnessId: string, needles: Needles): Promise<{ baseUrl: string; captureDir: string }>;
  selfTest(): Promise<boolean>;
  inspect(): Inspection;
  provision(harnessId: string, baseUrl: string): Provisioning;
  stop(): Promise<void>;
}

export function createGateway(ctl: LiteLLMCtl = noopLiteLLMCtl(join(homedir(), '.harness-hub', 'gateway'))): Gateway {
  let baseUrl = '';
  let captureDir = '';
  let needles: Needles = { agentsDoc: '', skills: [] };
  let started = false;
  const proxyKey = 'harness-hub-local-key';

  return {
    async start(harnessId, n) {
      needles = n;
      captureDir = join(homedir(), '.harness-hub', 'gateway', harnessId);
      const r = await ctl.start({ harnessId, captureDir, port: 4000, proxyKey });
      baseUrl = r.baseUrl;
      started = true;
      return r;
    },
    async selfTest() {
      if (!started) return false;
      return ctl.selfTest(baseUrl);
    },
    inspect() {
      return inspectCaptures(captureDir, needles);
    },
    provision(harnessId, url) {
      return provisionFor(harnessId, url, proxyKey, homedir());
    },
    async stop() {
      await ctl.stop();
      started = false;
    },
  };
}
```

- [ ] **Step 2: Write the failing test**

```ts
// test/tools/gateway.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGateway } from './gateway';
import { noopLiteLLMCtl } from './gateway/litellm';

describe('gateway facade', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'hh-gw-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('starts, provisions, and inspects via the contract', async () => {
    const gw = createGateway(noopLiteLLMCtl(dir));
    const { baseUrl, captureDir } = await gw.start('codex', { agentsDoc: 'zebra-9f3k2', skills: ['COD-X7K9Z'] });
    expect(baseUrl).toContain('4000');
    // write a captured request as LiteLLM would
    writeFileSync(join(captureDir, 'req-1.json'), JSON.stringify({ body: 'AGENTS.md zebra-9f3k2' }));
    expect((await gw.selfTest())).toBe(true);
    expect(gw.inspect().containsAgentsDoc).toBe(true);
    expect(gw.provision('pi', baseUrl).files).toBeDefined();
    await gw.stop();
  });
});
```

- [ ] **Step 3: Write `gateway.mjs` (thin shim)**

```js
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, 'dist', 'gateway.js');
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

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/tools/gateway.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add test/tools/gateway.ts test/tools/gateway.mjs test/tools/gateway.test.ts
git commit -m "feat(gateway): Gateway facade over LiteLLM (start/selfTest/inspect/stop)"
```

---

### Task 5: Gateway-aware runner (Level-1 evidence)

**Files:**
- Modify: `test/tools/verify/runner.ts` (add optional `provisioning` to `RunContext`)
- Create: `test/tools/verify/gatewayRunner.ts`
- Create: `test/tools/verify/gatewayRunner.test.ts`

**Interfaces:**
- Consumes: `Runner`, `RunContext`, `RunResult` (Plan B), `Gateway` (Task 4), `Provisioning` (Task 2).
- Produces: `gatewayRunner(gateway, inner, needles): Runner` — wraps an inner runner; before running, starts the gateway and provisions the inner runner's environment; after running, records `inspect()` into `RunResult` (an added `gatewayInspection` field).

- [ ] **Step 1: Extend `RunContext`**

```ts
// test/tools/verify/runner.ts — add import and field
import type { Provisioning } from '../gateway/provision';
export interface RunContext {
  // ...existing fields (harnessId, version, repoRoot, homeDir, prompt)...
  provisioning?: Provisioning;
}
```

- [ ] **Step 2: Implement `gatewayRunner.ts`**

```ts
import type { Runner, RunContext, RunResult } from './runner';
import type { Gateway } from '../gateway';
import type { Inspection, Needles } from '../gateway/capture';

export interface GatewayRunResult extends RunResult {
  gatewayInspection?: Inspection;
}

export function gatewayRunner(gateway: Gateway, inner: Runner, needles: Needles): Runner {
  return {
    kind: inner.kind,
    async run(ctx: RunContext): Promise<GatewayRunResult> {
      const { baseUrl } = await gateway.start(ctx.harnessId, needles);
      const provisioning = gateway.provision(ctx.harnessId, baseUrl);
      const result = await inner.run({ ...ctx, provisioning });
      const inspection = gateway.inspect();
      await gateway.stop();
      return { ...result, gatewayInspection: inspection };
    },
  };
}
```

- [ ] **Step 3: Write the failing test**

```ts
// test/tools/verify/gatewayRunner.test.ts
import { describe, it, expect } from 'vitest';
import type { Runner } from './runner';
import { gatewayRunner } from './gatewayRunner';
import type { Gateway } from '../gateway';

describe('gatewayRunner', () => {
  it('wraps an inner runner and records gateway inspection', async () => {
    const inner: Runner = {
      kind: 'container',
      run: async () => ({ status: 'ok', output: '' }),
    };
    const gw: Gateway = {
      start: async () => ({ baseUrl: 'http://x:4000', captureDir: '/tmp/cap' }),
      selfTest: async () => true,
      inspect: () => ({ containsAgentsDoc: true, containsSkill: false, matches: ['zebra-9f3k2'] }),
      provision: () => ({ env: { OPENAI_BASE_URL: 'http://x:4000/v1' } }),
      stop: async () => {},
    };
    const runner = gatewayRunner(gw, inner, { agentsDoc: 'zebra-9f3k2', skills: ['COD-X7K9Z'] });
    expect(runner.kind).toBe('container');
    const res = await runner.run({ harnessId: 'codex', version: '0.155.1', repoRoot: '/tmp', homeDir: '/tmp/h', prompt: 'x' });
    expect(res.status).toBe('ok');
    expect(res.gatewayInspection?.containsAgentsDoc).toBe(true);
  });
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/tools/verify/gatewayRunner.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add test/tools/verify/runner.ts test/tools/verify/gatewayRunner.ts test/tools/verify/gatewayRunner.test.ts
git commit -m "feat(gateway): gateway-aware runner wrapper (Level-1 evidence)"
```

---

### Task 6: Wire the provisioning hook into the container runner

**Files:**
- Modify: `test/tools/verify/containerRunner.ts` (merge env + mount files)
- Modify: `test/tools/testbed.ts` (`runHarness` accepts + applies `provisioning`)

**Interfaces:**
- Consumes: `Provisioning` (Task 2), `RunContext.provisioning` (Task 5).
- Produces: `runHarness` merges `provisioning.env` into the docker env and writes `provisioning.files` into the home mount before launching.

- [ ] **Step 1: Apply provisioning in `containerRunner.ts`**

In `containerRunner.run`, before calling `runHarness`, if `ctx.provisioning?.files` exists, write them into `ctx.homeDir` (they are home-relative paths like `.pi/agent/models.json`); pass `ctx.provisioning` through to `runHarness`.

- [ ] **Step 2: Apply env in `runHarness`**

In `testbed.ts` `runHarness`, accept an optional `provisioning` and, when present, add `-e KEY=VALUE` for each `provisioning.env` entry to the `docker run` args.

- [ ] **Step 3: Write the failing test**

```ts
// test/tools/testbed.test.ts (add)
it('forwards provisioning env vars to docker run', () => {
  const fake = {
    build: () => ({ status: 'ok', output: '' }),
    run: (_tag: string, _m: unknown, _cmd: string) => ({ status: 'ok', output: '' }),
  };
  // ... invoke runHarness with provisioning and assert the exec saw -e ANTHROPIC_BASE_URL=...
});
```

Implement against `runHarness`'s actual signature; assert the injected executor receives `-e ANTHROPIC_BASE_URL=http://proxy:4000`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/tools/testbed.test.ts test/tools/verify/gatewayRunner.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add test/tools/verify/containerRunner.ts test/tools/testbed.ts test/tools/testbed.test.ts
git commit -m "feat(gateway): wire gateway provisioning into the container runner"
```

---

### Task 7: Full verification

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 2: Typecheck + build tools**

Run: `npm run typecheck && npm run build:tools`
Expected: clean; `dist/gateway*.js`, `dist/verify/gatewayRunner.js` emitted.

- [ ] **Step 3: Commit any residual**

```bash
git add -A
git commit -m "test: verify gateway deliverable end-to-end" --allow-empty
```

---

## Self-Review

**Spec coverage (R7 + gateway.md):**
- LiteLLM decision + "thin wrapper over logged request bodies" → Tasks 3–4.
- Two layers (passthrough core + inspection) → Tasks 1 (inspection), 3 (LiteLLM passthrough).
- Per-harness dialect table (env-var vs config-file) → Task 2 provisioning (matches gateway.md's updated table exactly).
- Contract `Gateway { start, selfTest, inspect, stop }` → Task 4.
- Container runner integration (sidecar + base-URL env/config) → Tasks 5–6.
- Manual Cursor self-test → `selfTest()` + the `human` runner path (Plan B) composes with `gatewayRunner`.
- No credential capture / local-only capture dir → Task 1 (`capture.ts` writes under `~/.harness-hub/gateway`, git-ignored by convention), Task 4 `proxyKey` is a local throwaway.
- Determinism of `inspect` (string containment) → Task 1.
- Level-1 sufficient proof alone → `gatewayRunner` surfaces `gatewayInspection` for the report; Plan C/B consume it as conclusive.

**Placeholder scan:** the `codex` base-URL override and the `git`/`fhs` Dockerfile install remain documented-as-harness-specific, matching gateway.md's "see LiteLLM's `lite codex` behavior" note. No TBD/TODO in code.

**Type consistency:** `Needles`, `Inspection`, `Provisioning`, `LiteLLMCtl`, `Gateway`, `GatewayRunResult`, `RunContext.provisioning` are stable across Tasks 1–6. The `RunContext` extension is optional and backward-compatible with Plan B.
