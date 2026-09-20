// src/commands/doctor.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDoctorCommand } from './doctor';

describe('runDoctorCommand', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-doctorcmd-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('exits non-zero when AGENTS.md is missing', () => {
    const result = runDoctorCommand(repoRoot);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('AGENTS.md');
  });

  it('exits zero for a minimal valid repo', () => {
    writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
    const result = runDoctorCommand(repoRoot);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('no issues found');
  });
});
