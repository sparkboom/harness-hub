import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, saveConfig, YAML_CONFIG_FILENAME, JSON_CONFIG_FILENAME } from './config';

describe('config', () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-config-'));
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('reports absent when neither config file exists', () => {
    expect(loadConfig(repoRoot)).toEqual({ status: 'absent' });
  });

  it('reports ambiguous when both files exist', () => {
    writeFileSync(join(repoRoot, YAML_CONFIG_FILENAME), 'harnesses: []\n');
    writeFileSync(join(repoRoot, JSON_CONFIG_FILENAME), '{"harnesses": []}');
    expect(loadConfig(repoRoot).status).toBe('ambiguous');
  });

  it('loads a valid yaml config', () => {
    writeFileSync(join(repoRoot, YAML_CONFIG_FILENAME), 'harnesses:\n  - claude-code\n  - cursor\n');
    expect(loadConfig(repoRoot)).toEqual({
      status: 'ok',
      format: 'yaml',
      path: join(repoRoot, YAML_CONFIG_FILENAME),
      harnesses: ['claude-code', 'cursor'],
      unknownIds: [],
    });
  });

  it('loads a valid json config', () => {
    writeFileSync(join(repoRoot, JSON_CONFIG_FILENAME), JSON.stringify({ harnesses: ['hermes'] }));
    expect(loadConfig(repoRoot)).toEqual({
      status: 'ok',
      format: 'json',
      path: join(repoRoot, JSON_CONFIG_FILENAME),
      harnesses: ['hermes'],
      unknownIds: [],
    });
  });

  it('reports parse-error on malformed yaml', () => {
    writeFileSync(join(repoRoot, YAML_CONFIG_FILENAME), 'harnesses: [\n');
    expect(loadConfig(repoRoot).status).toBe('parse-error');
  });

  it('reports invalid-shape when harnesses is not an array', () => {
    writeFileSync(join(repoRoot, YAML_CONFIG_FILENAME), 'harnesses: "claude-code"\n');
    expect(loadConfig(repoRoot).status).toBe('invalid-shape');
  });

  it('collects unrecognized harness ids separately from valid ones', () => {
    writeFileSync(join(repoRoot, YAML_CONFIG_FILENAME), 'harnesses:\n  - claude-code\n  - not-a-real-harness\n');
    expect(loadConfig(repoRoot)).toMatchObject({
      status: 'ok',
      harnesses: ['claude-code'],
      unknownIds: ['not-a-real-harness'],
    });
  });

  it('saveConfig creates harness-hub.yaml by default', () => {
    saveConfig(repoRoot, ['cursor']);
    expect(existsSync(join(repoRoot, YAML_CONFIG_FILENAME))).toBe(true);
    expect(existsSync(join(repoRoot, JSON_CONFIG_FILENAME))).toBe(false);
  });

  it('saveConfig writes json when only a json config already existed', () => {
    writeFileSync(join(repoRoot, JSON_CONFIG_FILENAME), JSON.stringify({ harnesses: [] }));
    saveConfig(repoRoot, ['codex']);
    const written = JSON.parse(readFileSync(join(repoRoot, JSON_CONFIG_FILENAME), 'utf8'));
    expect(written).toEqual({ harnesses: ['codex'] });
    expect(existsSync(join(repoRoot, YAML_CONFIG_FILENAME))).toBe(false);
  });
});
