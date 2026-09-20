import type { DoctorContext, DoctorRule, Finding } from './types';

export function runDoctor(ctx: DoctorContext, rules: DoctorRule[]): Finding[] {
  const findings: Finding[] = [];
  for (const rule of rules) {
    if (rule.applies(ctx)) {
      findings.push(...rule.check(ctx));
    }
  }
  return findings;
}

export function hasBlockingErrors(findings: Finding[]): boolean {
  return findings.some((f) => f.severity === 'error');
}

/** Findings relevant to a specific harness: harness-scoped findings for it, plus every canon-wide finding. */
export function findingsForHarness(findings: Finding[], harnessId: string): Finding[] {
  return findings.filter((f) => f.harnessId === undefined || f.harnessId === harnessId);
}
