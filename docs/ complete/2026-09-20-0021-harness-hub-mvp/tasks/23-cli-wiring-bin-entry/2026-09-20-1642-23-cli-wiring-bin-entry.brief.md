# Task 23 Brief: CLI wiring + bin entry

**Plan:** /Users/matt/Repos/ai/harness-hub/docs/current/2026-09-20-0021-harness-hub-mvp/harness-hub-mvp.plan.md (Task 23, plan lines 3522–3737)

**Repo:** /Users/matt/Repos/ai/harness-hub (branch `initial-harness-hub`) — work in the repo root directly; the current HEAD (a499de1) already contains Tasks 1–22.

**Files:**
- Create: `src/cli.ts`
- Create: `src/bin.ts`
- Test: `src/cli.test.ts`

**Interfaces:**
- Consumes: `findRepoRoot` (Task 2, `src/repo.ts`), `isHarnessId`/`HarnessId` (Task 3, `src/harnesses.ts`), `enableHarnesses` (Task 20), `disableHarnesses` (Task 22), `migrateHarness` (Task 21), `runDoctorCommand` (Task 18), `getPackageVersion` (Task 1, `src/version.ts`), `commander` (already a dependency).
- Produces: `main(argv: string[]): Promise<number>` — the only export `bin.ts` calls.

This is the final integration point: it exercises every module built in Tasks 1–22 together, through the same entry point real users hit.

## Step 1: Write the failing tests

```typescript
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

  it('doctor exits 0 for a minimal valid repo', async () => {
    expect(await main(['doctor'])).toBe(0);
  });

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
```

## Step 2: Run tests to verify they fail

Run: `npx vitest run src/cli.test.ts`
Expected: FAIL — module not found.

## Step 3: Implement `cli.ts`

```typescript
// src/cli.ts
import { Command } from 'commander';
import { findRepoRoot } from './repo';
import { isHarnessId, type HarnessId } from './harnesses';
import { enableHarnesses } from './commands/enable';
import { disableHarnesses } from './commands/disable';
import { migrateHarness } from './commands/migrate';
import { runDoctorCommand } from './commands/doctor';
import { getPackageVersion } from './version';

function parseHarnessIds(values: string[]): HarnessId[] {
  const invalid = values.filter((v) => !isHarnessId(v));
  if (invalid.length > 0) {
    throw new Error(`Unrecognized harness id(s): ${invalid.join(', ')}`);
  }
  return values as HarnessId[];
}

export async function main(argv: string[]): Promise<number> {
  let exitCode = 0;
  const program = new Command();
  program.name('harness-hub').version(getPackageVersion()).exitOverride();

  program
    .command('enable <harnesses...>')
    .option('--force', 'overwrite clobber-risk findings (CLAUDE.md, .claude/skills symlink target)')
    .action((harnesses: string[], opts: { force?: boolean }) => {
      const repoRoot = findRepoRoot(process.cwd());
      const harnessIds = parseHarnessIds(harnesses);
      const result = enableHarnesses(repoRoot, harnessIds, { force: opts.force });
      for (const r of result.results) {
        if (r.status === 'blocked') {
          console.error(`harness-hub enable ${r.harnessId}: blocked`);
          for (const f of r.blockingFindings) {
            console.error(`  [${f.severity.toUpperCase()}] ${f.message}\n  \u2192 ${f.remediation}`);
          }
        } else {
          console.log(`harness-hub enable ${r.harnessId}: ${r.status}`);
        }
      }
      exitCode = result.exitCode;
    });

  program.command('disable <harnesses...>').action((harnesses: string[]) => {
    const repoRoot = findRepoRoot(process.cwd());
    const harnessIds = parseHarnessIds(harnesses);
    const result = disableHarnesses(repoRoot, harnessIds);
    console.log(result.output);
    exitCode = result.exitCode;
  });

  program.command('migrate <harness>').action((harness: string) => {
    const repoRoot = findRepoRoot(process.cwd());
    const [harnessId] = parseHarnessIds([harness]);
    const result = migrateHarness(repoRoot, harnessId);
    console.log(result.output);
    exitCode = result.exitCode;
  });

  program.command('doctor').action(() => {
    const repoRoot = findRepoRoot(process.cwd());
    const result = runDoctorCommand(repoRoot);
    console.log(result.output);
    exitCode = result.exitCode;
  });

  try {
    await program.parseAsync(argv, { from: 'user' });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code;
      if (code === 'commander.helpDisplayed' || code === 'commander.version') {
        return 0;
      }
    }
    if (err instanceof Error) console.error(err.message);
    return exitCode || 1;
  }

  return exitCode;
}
```

## Step 4: Implement `bin.ts`

```typescript
#!/usr/bin/env node
// src/bin.ts
import { main } from './cli';

main(process.argv.slice(2)).then(
  (exitCode) => process.exit(exitCode),
  (err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
);
```

## Step 5: Run tests to verify they pass

Run: `npx vitest run src/cli.test.ts`
Expected: PASS (6 tests).

## Step 6: Run the full test suite

Run: `npm test`
Expected: PASS — every test file from Tasks 1–23 green.

Also: `npm run typecheck` (clean).

## Step 7: Build and manually smoke-test the compiled CLI

```bash
npm run build
cd "$(mktemp -d)"
git init -q
echo '# Agents' > AGENTS.md
node <ABSOLUTE_PATH_TO>/dist/bin.js doctor
echo "exit code: $?"
node <ABSOLUTE_PATH_TO>/dist/bin.js enable cursor
cat harness-hub.yaml
```

Replace `<ABSOLUTE_PATH_TO>` with the real absolute path to the repo's `dist/bin.js` (i.e. `/Users/matt/Repos/ai/harness-hub/dist/bin.js`).

Expected: `doctor` prints "no issues found" and exits 0; `enable cursor` prints `harness-hub enable cursor: enabled` and `harness-hub.yaml` contains `harnesses:` with `- cursor`. Paste the actual smoke-test output in your report. Clean up the temp dir afterwards (`rm -rf` it).

## Step 8: Commit

```bash
git add src/cli.ts src/bin.ts src/cli.test.ts
git commit -m "feat: CLI wiring (enable/disable/migrate/doctor) + bin entry"
```

## TDD discipline

Follow RED → GREEN exactly as in previous tasks: write the test file first, run it to see the failure (module not found), then implement, then run to green. Include the RED and GREEN command outputs in your report.

## Deviation policy

If the verbatim implementation fails a verbatim test, DO NOT silently rework either side: make the MINIMAL change, keep behavior identical, and flag it prominently under "Deviations" with the failing output pasted. Known toolchain notes from earlier tasks: TypeScript 7 required `types: ["node"]` in tsconfig (already handled in Task 1); `bin.ts` is intentionally untested (thin shebang wrapper, verified by the Step 7 smoke test).

## Report

When done, write your implementation report to:
/Users/matt/Repos/ai/harness-hub/docs/current/2026-09-20-0021-harness-hub-mvp/tasks/23-cli-wiring-bin-entry/2026-09-20-1645-23-cli-wiring-bin-entry.report.md

The report must include: commits made (hashes), test evidence (RED + GREEN + full suite + typecheck), smoke-test output (Step 7), any deviations from the brief with rationale, and anything you noticed but did not change (deferred notes for the reviewer).
