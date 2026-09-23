// test/tools/verify/schema.test.ts
import { describe, it, expect } from 'vitest';
import { ALL_HARNESS_IDS } from '../../../src/harnesses';
import type { HarnessId, Snapshot } from './schema';

const emptySnapshot: Snapshot = { files: {} };

// Mirrors the union in schema.ts; `satisfies` rejects invalid members at
// typecheck time and the runtime compare below catches src-side drift.
const SCHEMA_HARNESS_IDS = [
  'claude-code',
  'cursor',
  'cursor-cli',
  'opencode',
  'codex',
  'hermes',
  'pi',
  'deepseek',
] as const satisfies readonly HarnessId[];

describe('schema', () => {
  it('is importable and Snapshot is structurally stable', () => {
    const s: Snapshot = { files: {} };
    expect(s.files).toEqual({});
    expect(emptySnapshot.files).toEqual({});
  });

  it('HarnessId union stays in sync with src/harnesses.ts', () => {
    expect([...SCHEMA_HARNESS_IDS].sort()).toEqual([...ALL_HARNESS_IDS].sort());
  });
});
