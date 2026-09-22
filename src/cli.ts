// src/cli.ts
import { Command } from 'commander';
import { findRepoRoot } from './repo';
import { isHarnessId, type HarnessId } from './harnesses';
import { enableHarnesses } from './commands/enable';
import { disableHarnesses } from './commands/disable';
import { migrateHarness } from './commands/migrate';
import { runDoctorCommand } from './commands/doctor';
import { formatList } from './commands/list';
import { infoHarness } from './commands/info';
import { detectInstalledVersions } from './harnessDetect';
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
    .option('--force', 'overwrite clobber findings (CLAUDE.md, .claude/skills symlink target)')
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

  program.command('list').action(() => {
    console.log(formatList(detectInstalledVersions()));
  });

  program.command('info <harness>').action((harness: string) => {
    const installed = detectInstalledVersions()[harness as HarnessId] ?? null;
    const result = infoHarness(harness, installed);
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
