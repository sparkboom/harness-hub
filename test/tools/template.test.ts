import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('test/template scaffold', () => {
  it('uses corrected ../../ tool paths and drops the setup script', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'template', 'package.json'), 'utf8')) as {
      name: string;
      scripts: Record<string, string>;
    };
    expect(pkg.name).toBe('harness-hub-env-playground');
    expect(pkg.scripts.generate).toBe('node ../../tools/generate.mjs');
    expect(pkg.scripts.detect).toBe('node ../../tools/detect.mjs');
    expect(pkg.scripts.probe).toBe('node ../../tools/probe.mjs');
    expect(pkg.scripts.env).toBe('node ../../tools/env.mjs');
    expect(pkg.scripts.shell).toBe('nix develop --flake ../../');
    expect(pkg.scripts.setup).toBeUndefined();
  });

  it('ships a minimal AGENTS.md', () => {
    const md = readFileSync(join(__dirname, '..', 'template', 'AGENTS.md'), 'utf8');
    expect(md).toContain('# Agents');
  });
});