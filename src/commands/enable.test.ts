// src/commands/enable.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, lstatSync, readlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { enableHarnesses } from './enable';

function repoWithAgentsMd(): string {
  const repoRoot = mkdtempSync(join(tmpdir(), 'hh-enable-'));
  writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
  return repoRoot;
}

function readConfiguredHarnesses(repoRoot: string): string[] {
  const raw = readFileSync(join(repoRoot, 'harness-hub.yaml'), 'utf8');
  return (parseYaml(raw) as { harnesses: string[] }).harnesses;
}

describe('enableHarnesses', () => {
  let repoRoot: string;
  let homeDir: string;

  beforeEach(() => {
    repoRoot = repoWithAgentsMd();
    homeDir = mkdtempSync(join(tmpdir(), 'hh-home-'));
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
    rmSync(homeDir, { recursive: true, force: true });
  });

  it('enables a native harness and writes the config', () => {
    const result = enableHarnesses(repoRoot, ['cursor']);
    expect(result.exitCode).toBe(0);
    expect(result.results).toEqual([{ harnessId: 'cursor', status: 'enabled', blockingFindings: [] }]);
    expect(readConfiguredHarnesses(repoRoot)).toEqual(['cursor']);
  });

  it('reports already-enabled without duplicating work', () => {
    enableHarnesses(repoRoot, ['cursor']);
    const result = enableHarnesses(repoRoot, ['cursor']);
    expect(result.results).toEqual([{ harnessId: 'cursor', status: 'already-enabled', blockingFindings: [] }]);
  });

  it('wires claude-code from a clean repo', () => {
    const result = enableHarnesses(repoRoot, ['claude-code']);
    expect(result.exitCode).toBe(0);
    expect(lstatSync(join(repoRoot, 'CLAUDE.md')).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(repoRoot, 'CLAUDE.md'))).toBe('AGENTS.md');
    expect(lstatSync(join(repoRoot, '.claude', 'skills')).isSymbolicLink()).toBe(true);
    expect(readConfiguredHarnesses(repoRoot)).toEqual(['claude-code']);
  });

  it('blocks claude-code when .claude/skills has an unmigrated entry', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'body');
    const result = enableHarnesses(repoRoot, ['claude-code']);
    expect(result.exitCode).toBe(1);
    expect(result.results[0].status).toBe('blocked');
    expect(result.results[0].blockingFindings[0].ruleId).toBe('unmigrated-skills');
    expect(existsSync(join(repoRoot, 'harness-hub.yaml'))).toBe(false);
  });

  it('blocks claude-code on a skill-migration collision', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), 'one');
    // Canon side carries valid frontmatter so the canon-wide skill-frontmatter
    // doctor rule doesn't fire; the body still differs ('one' vs 'two'), so the
    // migration classification is a collision.
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), '---\nname: a\ndescription: x\n---\ntwo');
    const result = enableHarnesses(repoRoot, ['claude-code']);
    expect(result.results[0].blockingFindings[0].ruleId).toBe('skill-migration-collision');
  });

  it('wires claude-code once every .claude/skills entry is already migrated (identical)', () => {
    mkdirSync(join(repoRoot, '.claude', 'skills', 'a'), { recursive: true });
    mkdirSync(join(repoRoot, '.agents', 'skills', 'a'), { recursive: true });
    // Both sides carry identical valid frontmatter so the canon-wide
    // skill-frontmatter doctor rule doesn't fire and the trees are
    // byte-identical (migration already done).
    writeFileSync(join(repoRoot, '.claude', 'skills', 'a', 'SKILL.md'), '---\nname: a\ndescription: x\n---\nsame');
    writeFileSync(join(repoRoot, '.agents', 'skills', 'a', 'SKILL.md'), '---\nname: a\ndescription: x\n---\nsame');
    const result = enableHarnesses(repoRoot, ['claude-code']);
    expect(result.exitCode).toBe(0);
    expect(lstatSync(join(repoRoot, '.claude', 'skills')).isSymbolicLink()).toBe(true);
  });

  it('blocks on a hand-written CLAUDE.md without --force', () => {
    writeFileSync(join(repoRoot, 'CLAUDE.md'), '# hand-written\n');
    const result = enableHarnesses(repoRoot, ['claude-code']);
    expect(result.results[0].status).toBe('blocked');
    expect(result.results[0].blockingFindings[0].ruleId).toBe('clobber-risk');
  });

  it('overwrites a hand-written CLAUDE.md with --force', () => {
    writeFileSync(join(repoRoot, 'CLAUDE.md'), '# hand-written\n');
    const result = enableHarnesses(repoRoot, ['claude-code'], { force: true });
    expect(result.exitCode).toBe(0);
    expect(lstatSync(join(repoRoot, 'CLAUDE.md')).isSymbolicLink()).toBe(true);
  });

  it('blocks every requested harness on a global error (missing AGENTS.md)', () => {
    rmSync(join(repoRoot, 'AGENTS.md'));
    const result = enableHarnesses(repoRoot, ['cursor', 'claude-code']);
    expect(result.exitCode).toBe(1);
    expect(result.results.every((r) => r.status === 'blocked')).toBe(true);
    expect(existsSync(join(repoRoot, 'harness-hub.yaml'))).toBe(false);
  });

  it('blocks hermes when the repo is not trusted', () => {
    // A missing ~/.hermes/config.yaml only warns ("can't verify"); a config
    // that lists a different repo is a definitive hermes-trust error.
    mkdirSync(join(homeDir, '.hermes'), { recursive: true });
    writeFileSync(join(homeDir, '.hermes', 'config.yaml'), 'skills:\n  trusted_project_dirs:\n    - /some/other/repo\n');
    const result = enableHarnesses(repoRoot, ['hermes'], { homeDir });
    expect(result.results[0].status).toBe('blocked');
    expect(result.results[0].blockingFindings[0].ruleId).toBe('hermes-trust');
  });

  it('enables hermes once the repo is trusted', () => {
    mkdirSync(join(homeDir, '.hermes'), { recursive: true });
    writeFileSync(join(homeDir, '.hermes', 'config.yaml'), `skills:\n  trusted_project_dirs:\n    - ${repoRoot}\n`);
    const result = enableHarnesses(repoRoot, ['hermes'], { homeDir });
    expect(result.exitCode).toBe(0);
    expect(readConfiguredHarnesses(repoRoot)).toEqual(['hermes']);
  });

  it('processes multiple harnesses independently: one succeeds, one blocks', () => {
    writeFileSync(join(repoRoot, 'CLAUDE.md'), '# hand-written\n');
    const result = enableHarnesses(repoRoot, ['cursor', 'claude-code']);
    expect(result.exitCode).toBe(1);
    expect(result.results.find((r) => r.harnessId === 'cursor')?.status).toBe('enabled');
    expect(result.results.find((r) => r.harnessId === 'claude-code')?.status).toBe('blocked');
    expect(readConfiguredHarnesses(repoRoot)).toEqual(['cursor']);
  });
});
