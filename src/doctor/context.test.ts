import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDoctorContext } from './context';

describe('buildDoctorContext', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-ctx-'));
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('defaults to an empty configuredHarnesses/pendingHarnesses when no config exists', () => {
    const ctx = buildDoctorContext(repoRoot);
    expect(ctx.configuredHarnesses).toEqual([]);
    expect(ctx.pendingHarnesses).toEqual([]);
    expect(ctx.homeDir).toBeTruthy();
  });

  it('reads configuredHarnesses from an existing config and accepts explicit pendingHarnesses/homeDir', () => {
    writeFileSync(join(repoRoot, 'harness-hub.yaml'), 'harnesses:\n  - cursor\n');
    const ctx = buildDoctorContext(repoRoot, ['hermes'], '/fake/home');
    expect(ctx.configuredHarnesses).toEqual(['cursor']);
    expect(ctx.pendingHarnesses).toEqual(['hermes']);
    expect(ctx.homeDir).toBe('/fake/home');
  });
});
