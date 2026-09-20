# Task 15 Brief: Trust-gate doctor rule (Hermes)

**Plan:** /Users/matt/Repos/ai/harness-hub/docs/current/2026-09-20-0021-harness-hub-mvp/harness-hub-mvp.plan.md (Task 15, plan lines 2323–2509)

**Repo:** /Users/matt/Repos/ai/harness-hub (branch `initial-harness-hub`) — work in the repo root directly; the current HEAD (327b379) already contains Tasks 1–14.

**Files:**
- Create: `src/doctor/rules/trustGate.ts`
- Test: `src/doctor/rules/trustGate.test.ts`

**Interfaces:**
- Consumes: `ALL_HARNESS_IDS` (Task 3, `src/harnesses.ts`), `getHarnessEntry` (Task 4, `src/registry`), `yaml` package (already a dependency).
- Produces: `trustGateRule: DoctorRule`. Emits `hermes-trust` findings: `error` when the trust file parses but the repo is absent from it; `warning` when the file is missing/unparseable ("can't verify").

Scoped to exactly the currently-released mechanism (spec §6): `skills.trusted_project_dirs` in `~/.hermes/config.yaml`. Hermes's unreleased trust-sidecar migration is intentionally unsupported (spec §11) — a future harness-hub release adds it by extending the registry's `TrustGateConvention`, per `harness-doctor-architecture.insight.md`.

Context you can rely on (already merged from Tasks 3, 4, 9):
- `src/harnesses.ts` exports `ALL_HARNESS_IDS: readonly HarnessId[]` and type `HarnessId`.
- `src/registry/index.ts` exports `getHarnessEntry(id: HarnessId)`. Registry entries have `skills.trustGate?: TrustGateConvention` with `{ configPathFromHome: string; trustedDirsKeyPath: string[]; trustCommand: string }` (only hermes has one in the data; see `src/registry/data.ts`).
- `src/doctor/types.ts` exports `DoctorContext` (`{ repoRoot, homeDir, config, configuredHarnesses, pendingHarnesses }`), `DoctorRule` (`{ id, applies(ctx): boolean, check(ctx): Finding[] }`), `Finding` (`{ ruleId, severity: 'error'|'warning', message, remediation, harnessId: HarnessId | null, forceable: boolean }`).

## Step 1: Write the failing tests

```typescript
// src/doctor/rules/trustGate.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { trustGateRule } from './trustGate';
import type { DoctorContext } from '../types';

function makeCtx(homeDir: string, repoRoot: string, pendingHarnesses: DoctorContext['pendingHarnesses'] = ['hermes']): DoctorContext {
  return { repoRoot, homeDir, config: { status: 'absent' }, configuredHarnesses: [], pendingHarnesses };
}

describe('trustGateRule', () => {
  let homeDir: string;
  let repoRoot: string;

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), 'hh-home-'));
    repoRoot = mkdtempSync(join(tmpdir(), 'hh-repo-'));
  });

  afterEach(() => {
    rmSync(homeDir, { recursive: true, force: true });
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('does not apply when hermes is irrelevant', () => {
    expect(trustGateRule.applies(makeCtx(homeDir, repoRoot, []))).toBe(false);
  });

  it('warns (does not error) when ~/.hermes/config.yaml is missing', () => {
    const findings = trustGateRule.check(makeCtx(homeDir, repoRoot));
    expect(findings).toEqual([expect.objectContaining({ ruleId: 'hermes-trust', severity: 'warning', harnessId: 'hermes' })]);
  });

  it('warns when the config file fails to parse', () => {
    mkdirSync(join(homeDir, '.hermes'), { recursive: true });
    writeFileSync(join(homeDir, '.hermes', 'config.yaml'), 'skills: [\n');
    expect(trustGateRule.check(makeCtx(homeDir, repoRoot))[0].severity).toBe('warning');
  });

  it('errors when the repo is not in trusted_project_dirs', () => {
    mkdirSync(join(homeDir, '.hermes'), { recursive: true });
    writeFileSync(join(homeDir, '.hermes', 'config.yaml'), 'skills:\n  trusted_project_dirs:\n    - /some/other/repo\n');
    const findings = trustGateRule.check(makeCtx(homeDir, repoRoot));
    expect(findings).toEqual([
      expect.objectContaining({ ruleId: 'hermes-trust', severity: 'error', harnessId: 'hermes', forceable: false }),
    ]);
  });

  it('passes when the repo is listed', () => {
    mkdirSync(join(homeDir, '.hermes'), { recursive: true });
    writeFileSync(join(homeDir, '.hermes', 'config.yaml'), `skills:\n  trusted_project_dirs:\n    - ${repoRoot}\n`);
    expect(trustGateRule.check(makeCtx(homeDir, repoRoot))).toEqual([]);
  });

  it('normalizes a trailing slash on the trusted path', () => {
    mkdirSync(join(homeDir, '.hermes'), { recursive: true });
    writeFileSync(join(homeDir, '.hermes', 'config.yaml'), `skills:\n  trusted_project_dirs:\n    - ${repoRoot}/\n`);
    expect(trustGateRule.check(makeCtx(homeDir, repoRoot))).toEqual([]);
  });
});
```

## Step 2: Run tests to verify they fail

Run: `npx vitest run src/doctor/rules/trustGate.test.ts`
Expected: FAIL — module not found.

## Step 3: Implement

```typescript
// src/doctor/rules/trustGate.ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ALL_HARNESS_IDS, type HarnessId } from '../../harnesses';
import { getHarnessEntry } from '../../registry';
import type { DoctorContext, DoctorRule, Finding } from '../types';

function getAtKeyPath(obj: unknown, keyPath: string[]): unknown {
  let current = obj;
  for (const key of keyPath) {
    if (typeof current !== 'object' || current === null || !(key in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function trustGatedHarnessIds(): HarnessId[] {
  return ALL_HARNESS_IDS.filter((id) => getHarnessEntry(id).skills.trustGate !== undefined);
}

function isRelevant(ctx: DoctorContext, id: HarnessId): boolean {
  return ctx.configuredHarnesses.includes(id) || ctx.pendingHarnesses.includes(id);
}

export const trustGateRule: DoctorRule = {
  id: 'trust-gate',
  applies: (ctx) => trustGatedHarnessIds().some((id) => isRelevant(ctx, id)),
  check: (ctx) => {
    const findings: Finding[] = [];
    for (const id of trustGatedHarnessIds()) {
      if (!isRelevant(ctx, id)) continue;
      const entry = getHarnessEntry(id);
      const trustGate = entry.skills.trustGate;
      if (!trustGate) continue;

      const configPath = join(ctx.homeDir, trustGate.configPathFromHome);
      const cantVerify = (reason: string) => {
        findings.push({
          ruleId: 'hermes-trust',
          severity: 'warning',
          message: `Can't verify ${entry.displayName} trust: ${reason}`,
          remediation: `Run \`${trustGate.trustCommand}\` inside the repo, or check ${configPath} manually.`,
          harnessId: id,
          forceable: false,
        });
      };

      if (!existsSync(configPath)) {
        cantVerify(`${configPath} does not exist.`);
        continue;
      }

      let parsed: unknown;
      try {
        parsed = parseYaml(readFileSync(configPath, 'utf8'));
      } catch (err) {
        cantVerify(`${configPath} failed to parse (${err instanceof Error ? err.message : String(err)}).`);
        continue;
      }

      const trustedDirs = getAtKeyPath(parsed, trustGate.trustedDirsKeyPath);
      if (!Array.isArray(trustedDirs)) {
        cantVerify(`${configPath} has no readable "${trustGate.trustedDirsKeyPath.join('.')}" list.`);
        continue;
      }

      const isTrusted = trustedDirs.some(
        (dir) => typeof dir === 'string' && dir.replace(/\/$/, '') === ctx.repoRoot.replace(/\/$/, '')
      );
      if (!isTrusted) {
        findings.push({
          ruleId: 'hermes-trust',
          severity: 'error',
          message: `${ctx.repoRoot} is not listed in ${configPath}'s "${trustGate.trustedDirsKeyPath.join('.')}".`,
          remediation: `Run \`${trustGate.trustCommand}\` inside the repo, then re-run enable.`,
          harnessId: id,
          forceable: false,
        });
      }
    }
    return findings;
  },
};
```

## Step 4: Run tests to verify they pass

Run: `npx vitest run src/doctor/rules/trustGate.test.ts`
Expected: PASS (6 tests).

Also run the full suite and typecheck before committing:
- `npx vitest run` (all green)
- `npm run typecheck` (clean)

## Step 5: Commit

```bash
git add src/doctor/rules/trustGate.ts src/doctor/rules/trustGate.test.ts
git commit -m "feat: trust-gate doctor rule (Hermes skills.trusted_project_dirs)"
```

## TDD discipline

Follow RED → GREEN exactly as in previous tasks: write the test file first, run it to see the failure (module not found), then implement, then run to green. Include the RED and GREEN command outputs in your report.

## Report

When done, write your implementation report to:
/Users/matt/Repos/ai/harness-hub/docs/current/2026-09-20-0021-harness-hub-mvp/tasks/15-trust-gate-doctor-rule/2026-09-20-1526-15-trust-gate-doctor-rule.report.md

The report must include: commits made (hashes), test evidence (RED + GREEN + full suite + typecheck), any deviations from the brief with rationale, and anything you noticed but did not change (deferred notes for the reviewer).
