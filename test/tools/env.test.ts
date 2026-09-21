import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isValidName, resolveEnvPath, resolveTestDir, renderTemplate,
  createEnv, rmEnv, listEnvs, generateIntoEnv,
} from './env';

const TPL_PKG = JSON.stringify({
  name: 'harness-hub-env-playground', version: '0.0.0', private: true,
  scripts: { shell: 'nix develop --flake ../../' },
}, null, 2) + '\n';
const TPL_AGENTS = '# Agents\n\nMinimal consumer-repo agent doc for harness-hub testing.\n';

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'hh-env-root-'));
  mkdirSync(join(root, 'tools'), { recursive: true });
  mkdirSync(join(root, 'template'), { recursive: true });
  writeFileSync(join(root, 'flake.nix'), '{}\n');
  writeFileSync(join(root, 'template', 'package.json'), TPL_PKG);
  writeFileSync(join(root, 'template', 'AGENTS.md'), TPL_AGENTS);
  return root;
}

describe('env manager', () => {
  let root: string;
  beforeEach(() => { root = makeRoot(); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('resolves the test dir from nested tool paths', () => {
    expect(resolveTestDir(join(root, 'tools'))).toBe(root);
    mkdirSync(join(root, 'tools', 'dist'), { recursive: true });
    expect(resolveTestDir(join(root, 'tools', 'dist'))).toBe(root);
  });

  it('rejects invalid env names', () => {
    for (const bad of ['', '.', '..', 'a/b', 'a\\b']) expect(isValidName(bad)).toBe(false);
    for (const good of ['playground', 'foo', 'a-b', 'a_b', 'a1']) expect(isValidName(good)).toBe(true);
  });

  it('templates the package.json name per env', () => {
    const rendered = renderTemplate(root, 'foo');
    expect(JSON.parse(rendered.packageJson).name).toBe('harness-hub-env-foo');
    expect(rendered.agentsMd).toBe(TPL_AGENTS);
  });

  it('createEnv constructs an env with nested git and templated files', () => {
    const envPath = createEnv(root, 'foo', { link: false });
    expect(existsSync(join(envPath, '.git'))).toBe(true);
    expect(JSON.parse(readFileSync(join(envPath, 'package.json'), 'utf8')).name).toBe('harness-hub-env-foo');
    expect(readFileSync(join(envPath, 'AGENTS.md'), 'utf8')).toBe(TPL_AGENTS);
  });

  it('createEnv is idempotent (re-running keeps the nested git)', () => {
    const envPath = createEnv(root, 'foo', { link: false });
    createEnv(root, 'foo', { link: false });
    expect(existsSync(join(envPath, '.git'))).toBe(true);
    expect(JSON.parse(readFileSync(join(envPath, 'package.json'), 'utf8')).name).toBe('harness-hub-env-foo');
  });

  it('lists, then removes, created envs', () => {
    createEnv(root, 'foo', { link: false });
    createEnv(root, 'bar', { link: false });
    expect(listEnvs(root)).toEqual(['bar', 'foo']);
    rmEnv(root, 'foo');
    expect(listEnvs(root)).toEqual(['bar']);
  });

  it('rmEnv refuses an unknown env', () => {
    expect(() => rmEnv(root, 'nope')).toThrow(/Unknown env/);
  });

  it('generateIntoEnv renders a scenario into the env', () => {
    createEnv(root, 'foo', { link: false });
    generateIntoEnv(root, 'foo', 'baseline');
    expect(existsSync(join(root, 'env', 'foo', 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(root, 'env', 'foo', '.agents', 'skills', 'writing-tests', 'SKILL.md'))).toBe(true);
  });
});