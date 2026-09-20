import { writeAssets, resetTarget } from './fs';
import { SCENARIOS } from './scenarios';

export function generateScenario(target: string, name: string): void {
  const scenario = SCENARIOS[name];
  if (!scenario) {
    throw new Error(`Unknown scenario "${name}". Available: ${Object.keys(SCENARIOS).join(', ')}`);
  }
  resetTarget(target);
  writeAssets(target, scenario.assets(target));
  scenario.actions?.(target);
}

export function parseArgs(argv: string[]): { target: string; scenario: string } {
  let target = process.cwd();
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--target') { target = argv[++i]; }
    else if (argv[i].startsWith('--target=')) { target = argv[i].slice('--target='.length); }
    else { positional.push(argv[i]); }
  }
  if (positional.length !== 1) {
    throw new Error('Usage: generate <scenario> [--target <dir>]');
  }
  return { scenario: positional[0], target };
}

export async function main(argv: string[]): Promise<number> {
  try {
    const { target, scenario } = parseArgs(argv);
    generateScenario(target, scenario);
    console.log(`generated "${scenario}" into ${target}`);
    return 0;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
