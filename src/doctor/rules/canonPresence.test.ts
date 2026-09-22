import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonPresenceRule } from './canonPresence';
import type { DoctorContext } from '../types';

function makeCtx(repoRoot: string): DoctorContext {
  return { repoRoot, homeDir: '/home/user', config: { status: 'absent' }, configuredHarnesses: [], pendingHarnesses: [], installedVersions: {} as DoctorContext['installedVersions'] };
}

describe('canonPresenceRule', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-canonpresence-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('reports an error when AGENTS.md is missing', () => {
    const findings = canonPresenceRule.check(makeCtx(repoRoot));
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('error');
  });

  it('reports nothing when AGENTS.md exists', () => {
    writeFileSync(join(repoRoot, 'AGENTS.md'), '# Agents\n');
    expect(canonPresenceRule.check(makeCtx(repoRoot))).toEqual([]);
  });
});
