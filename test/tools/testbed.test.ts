// test/tools/testbed.test.ts
//
// Unit tests for the Docker testbed core. The real dockerExecutor is never
// invoked: every build/run test injects a recording fake DockerExecutor, so
// these tests never touch docker.
import { describe, it, expect } from 'vitest';
import { dockerfileFor, imageTag, HEADLESS_COMMANDS, runHarness, buildImage, type DockerExecutor } from './testbed';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadManifest } from './manifest';

function recordingExec() {
  const builds: Array<{ tag: string; contextDir: string }> = [];
  const runs: Array<{ tag: string; command: string }> = [];
  const exec: DockerExecutor = {
    build: (tag, contextDir) => {
      builds.push({ tag, contextDir });
      return { status: 'ok', output: '' };
    },
    run: (tag, _mounts, command) => {
      runs.push({ tag, command });
      return { status: 'ok', output: '' };
    },
  };
  return { exec, builds, runs };
}

describe('testbed', () => {
  it('tags images by harness/version', () => {
    expect(imageTag('codex', '0.155.1')).toBe('harness-hub/codex:0.155.1');
  });

  it('generates an npm Dockerfile pinning the exact version', () => {
    const d = dockerfileFor('codex', '0.155.1', 'npm', '@openai/codex');
    expect(d).toContain('npm install -g @openai/codex@0.155.1');
  });

  it('generates an fhs-wrapper Dockerfile using the harness install URL', () => {
    const d = dockerfileFor('cursor', '3.0.0', 'fhs-wrapper', undefined);
    expect(d).toContain('https://cursor.com/install');
  });

  it('maps claude-code to a -p prompt invocation', () => {
    const spec = HEADLESS_COMMANDS['claude-code']('/repo', 'hello');
    expect(spec.cmd).toBe('claude');
    expect(spec.args).toEqual(['-p', 'hello']);
  });

  it('runs the headless command inside the container via the executor', () => {
    const { exec, runs } = recordingExec();
    const r = runHarness({
      harness: 'claude-code', version: '2.1.272', prompt: 'hi',
      repoRoot: '/tmp/repo', homeDir: '/tmp/home', workDir: '/tmp/w', exec,
    });
    expect(r.status).toBe('ok');
    expect(runs[0]?.command).toContain('claude -p');
    expect(runs[0]?.command).toContain('"hi"');
  });

  it('keeps flags bare and quotes value tokens for the sh -c entrypoint', () => {
    const { exec, runs } = recordingExec();
    runHarness({
      harness: 'cursor-cli', version: '3.0.0', prompt: 'two words',
      repoRoot: '/tmp/repo', homeDir: '/tmp/home', workDir: '/tmp/w', exec,
    });
    const command = runs[0]?.command ?? '';
    expect(command).toContain('agent -p "two words"');
    expect(command).toContain('--workspace "/repo"');
  });

  it('builds an image from the manifest entry via the injected executor', () => {
    const dir = mkdtempSync(join(tmpdir(), 'testbed-'));
    const { exec, builds } = recordingExec();
    try {
      const built = buildImage({ harness: 'codex', version: '0.155.1', workDir: dir, exec });
      expect(built.tag).toBe('harness-hub/codex:0.155.1');
      expect(builds).toEqual([{ tag: 'harness-hub/codex:0.155.1', contextDir: join(dir, 'context') }]);
      const pkg = loadManifest()['codex'].install.package ?? '';
      const dockerfile = readFileSync(join(dir, 'context', 'Dockerfile'), 'utf8');
      expect(dockerfile).toContain(`npm install -g ${pkg}@0.155.1`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('propagates a failed build result', () => {
    const dir = mkdtempSync(join(tmpdir(), 'testbed-'));
    try {
      const failing: DockerExecutor = {
        build: () => ({ status: 'failed', output: 'boom' }),
        run: () => ({ status: 'ok', output: '' }),
      };
      const built = buildImage({ harness: 'codex', version: '0.155.1', workDir: dir, exec: failing });
      expect(built.result).toEqual({ status: 'failed', output: 'boom' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects unknown harnesses with a clear error', () => {
    const dir = mkdtempSync(join(tmpdir(), 'testbed-'));
    const { exec } = recordingExec();
    try {
      expect(() => buildImage({ harness: 'no-such-harness', version: '1.0.0', workDir: dir, exec })).toThrow(
        /unknown harness/
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});