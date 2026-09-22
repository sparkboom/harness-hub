// src/commands/doctor.ts
import { buildDoctorContext } from '../doctor/context';
import { runDoctor } from '../doctor/run';
import { ALL_DOCTOR_RULES } from '../doctor/rules';
import { detectInstalledVersions } from '../harnessDetect';
import type { Finding } from '../doctor/types';

export interface DoctorCommandResult {
  findings: Finding[];
  output: string;
  exitCode: number;
}

export function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) {
    return 'harness-hub doctor: no issues found.';
  }
  return findings
    .map((f) => `[${f.severity.toUpperCase()}] (${f.ruleId}) ${f.message}\n  \u2192 ${f.remediation}`)
    .join('\n');
}

export function runDoctorCommand(repoRoot: string, homeDir?: string): DoctorCommandResult {
  const ctx = buildDoctorContext(repoRoot, [], homeDir, detectInstalledVersions());
  const findings = runDoctor(ctx, ALL_DOCTOR_RULES);
  const exitCode = findings.some((f) => f.severity === 'error') ? 1 : 0;
  return { findings, output: formatFindings(findings), exitCode };
}
