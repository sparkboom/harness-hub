import { describe, it, expect } from 'vitest';
import { runDoctor, hasBlockingErrors, findingsForHarness } from './run';
import type { DoctorContext, DoctorRule, Finding } from './types';

function makeCtx(overrides: Partial<DoctorContext> = {}): DoctorContext {
  return {
    repoRoot: '/repo',
    homeDir: '/home/user',
    config: { status: 'absent' },
    configuredHarnesses: [],
    pendingHarnesses: [],
    installedVersions: {} as DoctorContext['installedVersions'],
    ...overrides,
  };
}

describe('runDoctor', () => {
  it('only runs rules whose applies() returns true', () => {
    const ranRuleIds: string[] = [];
    const rules: DoctorRule[] = [
      {
        id: 'always',
        applies: () => true,
        check: () => {
          ranRuleIds.push('always');
          return [];
        },
      },
      {
        id: 'never',
        applies: () => false,
        check: () => {
          ranRuleIds.push('never');
          return [];
        },
      },
    ];
    runDoctor(makeCtx(), rules);
    expect(ranRuleIds).toEqual(['always']);
  });

  it('aggregates findings from every applicable rule', () => {
    const finding: Finding = { ruleId: 'a', severity: 'error', message: 'm', remediation: 'r', forceable: false };
    const rules: DoctorRule[] = [
      { id: 'a', applies: () => true, check: () => [finding] },
      { id: 'b', applies: () => true, check: () => [] },
    ];
    expect(runDoctor(makeCtx(), rules)).toEqual([finding]);
  });
});

describe('hasBlockingErrors', () => {
  it('is true when any finding is an error', () => {
    expect(
      hasBlockingErrors([{ ruleId: 'a', severity: 'error', message: '', remediation: '', forceable: false }])
    ).toBe(true);
  });

  it('is false when all findings are warnings', () => {
    expect(
      hasBlockingErrors([{ ruleId: 'a', severity: 'warning', message: '', remediation: '', forceable: false }])
    ).toBe(false);
  });

  it('is false for an empty list', () => {
    expect(hasBlockingErrors([])).toBe(false);
  });
});

describe('findingsForHarness', () => {
  const canonWide: Finding = { ruleId: 'canon', severity: 'error', message: '', remediation: '', forceable: false };
  const claudeOnly: Finding = {
    ruleId: 'claude',
    severity: 'error',
    message: '',
    remediation: '',
    forceable: false,
    harnessId: 'claude-code',
  };
  const hermesOnly: Finding = {
    ruleId: 'hermes',
    severity: 'error',
    message: '',
    remediation: '',
    forceable: false,
    harnessId: 'hermes',
  };

  it('includes canon-wide findings for every harness', () => {
    expect(findingsForHarness([canonWide, claudeOnly, hermesOnly], 'cursor')).toEqual([canonWide]);
  });

  it('includes a harness-scoped finding only for its own harness', () => {
    expect(findingsForHarness([canonWide, claudeOnly, hermesOnly], 'claude-code')).toEqual([canonWide, claudeOnly]);
  });
});
