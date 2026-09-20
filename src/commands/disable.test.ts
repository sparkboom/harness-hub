// src/commands/disable.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { disableHarnesses } from './disable';
import { saveConfig } from '../config';

describe('disableHarnesses', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-disable-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('removes the claude-code symlinks but keeps canon skills intact', () => {
    writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'body');
    symlinkSync('AGENTS.md', join(repoRoot, 'CLAUDE.md'));
    mkdirSync(join(repoRoot, '.claude'), { recursive: true });
    symlinkSync(join('..', '.agents', 'skills'), join(repoRoot, '.claude', 'skills'));
    saveConfig(repoRoot, ['claude-code']);

    disableHarnesses(repoRoot, ['claude-code']);

    expect(existsSync(join(repoRoot, 'CLAUDE.md'))).toBe(false);
    expect(existsSync(join(repoRoot, '.claude', 'skills'))).toBe(false);
    expect(readFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), 'utf8')).toBe('body');
  });

  it('removes only the requested harness id from the config', () => {
    saveConfig(repoRoot, ['claude-code', 'cursor']);
    disableHarnesses(repoRoot, ['claude-code']);
    const harnesses = (parseYaml(readFileSync(join(repoRoot, 'harness-hub.yaml'), 'utf8')) as { harnesses: string[] })
      .harnesses;
    expect(harnesses).toEqual(['cursor']);
  });

  it('is a no-op for a harness that was never enabled', () => {
    saveConfig(repoRoot, ['cursor']);
    const result = disableHarnesses(repoRoot, ['hermes']);
    expect(result.exitCode).toBe(0);
    const harnesses = (parseYaml(readFileSync(join(repoRoot, 'harness-hub.yaml'), 'utf8')) as { harnesses: string[] })
      .harnesses;
    expect(harnesses).toEqual(['cursor']);
  });
});
