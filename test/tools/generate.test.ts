import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SCENARIOS } from './scenarios';
import { generateScenario } from './generate';

describe('scenario generator', () => {
  let target: string;
  beforeEach(() => { target = mkdtempSync(join(tmpdir(), 'hh-gen-')); });
  afterEach(() => { rmSync(target, { recursive: true, force: true }); });

  it('every scenario is named and has a description', () => {
    for (const s of Object.values(SCENARIOS)) {
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
    }
  });

  it('baseline renders AGENTS.md and one valid skill', () => {
    generateScenario(target, 'baseline');
    expect(existsSync(join(target, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(target, '.agents', 'skills', 'writing-tests', 'SKILL.md'))).toBe(true);
  });

  it('claude-md-clobber renders a hand-written CLAUDE.md', () => {
    generateScenario(target, 'claude-md-clobber');
    expect(readFileSync(join(target, 'CLAUDE.md'), 'utf8')).toContain('hand-written');
  });

  it('missing-agents-md renders no AGENTS.md', () => {
    generateScenario(target, 'missing-agents-md');
    expect(existsSync(join(target, 'AGENTS.md'))).toBe(false);
  });

  it('rejects an unknown scenario naming the available ones', () => {
    expect(() => generateScenario(target, 'nope')).toThrow(/Unknown scenario/);
  });
});
