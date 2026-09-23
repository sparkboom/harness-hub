// src/cli.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from './cli';

describe('cli main()', () => {
  let repoRoot: string;
  let originalCwd: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-cli-'));
    mkdirSync(join(repoRoot, '.git'));
    writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
    originalCwd = process.cwd();
    process.chdir(repoRoot);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(repoRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // TODO(plan-e): commented out — times out (>5s) because runDoctorCommand
  // shells out to detectInstalledVersions() probing host PATH binaries. See
  // deliverables/current/2026-09-21-2212-harness-version-management/plan-e-doctor-test-isolation/plan-e-doctor-test-isolation.ticket.md
  // Restore after threading an injectable installedVersions through runDoctorCommand.
  // it('doctor exits 0 for a minimal valid repo', async () => {
  //   expect(await main(['doctor'])).toBe(0);
  // });

  it('enable writes harness-hub.yaml for a native harness', async () => {
    expect(await main(['enable', 'cursor'])).toBe(0);
    expect(existsSync(join(repoRoot, 'harness-hub.yaml'))).toBe(true);
  });

  it('enable then disable claude-code round-trips cleanly', async () => {
    expect(await main(['enable', 'claude-code'])).toBe(0);
    expect(existsSync(join(repoRoot, 'CLAUDE.md'))).toBe(true);
    expect(await main(['disable', 'claude-code'])).toBe(0);
    expect(existsSync(join(repoRoot, 'CLAUDE.md'))).toBe(false);
  });

  it('rejects an unrecognized harness id', async () => {
    expect(await main(['enable', 'not-a-harness'])).toBe(1);
  });

  it('migrate reports nothing to migrate for a clean claude-code repo', async () => {
    expect(await main(['migrate', 'claude-code'])).toBe(0);
  });

  it('fails clearly outside a git repo', async () => {
    const nonRepo = mkdtempSync(join(tmpdir(), 'hh-nonrepo-'));
    process.chdir(nonRepo);
    expect(await main(['doctor'])).toBe(1);
    rmSync(nonRepo, { recursive: true, force: true });
  });
});
