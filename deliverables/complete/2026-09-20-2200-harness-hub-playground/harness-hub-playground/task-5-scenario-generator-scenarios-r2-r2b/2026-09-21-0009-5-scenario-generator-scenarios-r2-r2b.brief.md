### Task 5: scenario generator + scenarios (R2, R2b)

**Files:**
- Create: `tools/scenarios/shared.ts`, `tools/scenarios/index.ts`, and one module per scenario under `tools/scenarios/`
- Create: `tools/generate.ts`, `tools/generate.mjs`
- Test: `tools/generate.test.ts`

**Interfaces:**
- Consumes: `Asset`, `agentDoc`, `skill`, `raw` (Task 4); `writeAssets`, `resetTarget` (Task 4).
- Produces: `Scenario = { name: string; description: string; assets(target: string): Asset[]; actions?(target: string): void }`; `SCENARIOS: Record<string, Scenario>`; `generateScenario(target: string, name: string): void`; `main(argv: string[]): Promise<number>`.

- [ ] **Step 1: Write the failing test**

Create `tools/generate.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SCENARIOS } from './scenarios';
import { generateScenario } from './generate';

describe('scenario generator', () => {
  let target: string;
  beforeEach(() => { target = mkdtempSync(join(tmpdir(), 'hh-gen-')); });
  afterEach(() => { rmSync(target, { recursive: true, force: true }); });

  it('every scenario is named and has a description', () => {
    for (const s of Object.values(SCENARIOS)) {
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
    }
  });

  it('baseline renders AGENTS.md and one valid skill', () => {
    generateScenario(target, 'baseline');
    expect(existsSync(join(target, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(target, '.agents', 'skills', 'writing-tests', 'SKILL.md'))).toBe(true);
  });

  it('claude-md-clobber renders a hand-written CLAUDE.md', () => {
    generateScenario(target, 'claude-md-clobber');
    expect(readFileSync(join(target, 'CLAUDE.md'), 'utf8')).toContain('hand-written');
  });

  it('missing-agents-md renders no AGENTS.md', () => {
    generateScenario(target, 'missing-agents-md');
    expect(existsSync(join(target, 'AGENTS.md'))).toBe(false);
  });

  it('rejects an unknown scenario naming the available ones', () => {
    expect(() => generateScenario(target, 'nope')).toThrow(/Unknown scenario/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tools/generate.test.ts`
Expected: FAIL — `tools/scenarios` does not exist.

- [ ] **Step 3: Implement shared canon assets**

Create `tools/scenarios/shared.ts`:

```ts
import { agentDoc, skill, raw, type Asset } from '../primitives';

export function validAgentsDoc(): Asset {
  return agentDoc('AGENTS.md', '# Agents\n\nMinimal consumer-repo agent doc for harness-hub testing.\n');
}

export function validSkill(): Asset {
  return skill({
    name: 'writing-tests',
    location: '.agents/skills',
    frontmatter: { name: 'writing-tests', description: 'Write failing tests before implementation.' },
    body: 'Write the failing test first.\n',
  });
}

export function harnessConfig(harnesses: string[]): Asset {
  return raw('harness-hub.yaml', `harnesses:\n${harnesses.map((h) => `  - ${h}`).join('\n')}\n`);
}
```

- [ ] **Step 4: Implement each scenario module**

Create one module per scenario. Representative implementations (the rest follow the same pattern with the asset lists below):

`tools/scenarios/baseline.ts`:

```ts
import type { Scenario } from './index';
import { validAgentsDoc, validSkill } from './shared';

export const baseline: Scenario = {
  name: 'baseline',
  description: 'Valid canon (AGENTS.md + a valid skill), nothing wired — doctor finds nothing.',
  assets: () => [validAgentsDoc(), validSkill()],
};
```

`tools/scenarios/claude-md-clobber.ts`:

```ts
import { raw } from '../primitives';
import type { Scenario } from './index';
import { validAgentsDoc, validSkill } from './shared';

export const claudeMdClobber: Scenario = {
  name: 'claude-md-clobber',
  description: 'Hand-written CLAUDE.md blocks `enable claude-code` (clobber-risk → claude-md-clobber).',
  assets: () => [validAgentsDoc(), validSkill(), raw('CLAUDE.md', '# hand-written\n')],
};
```

`tools/scenarios/claude-drift.ts`:

```ts
import { mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { Scenario } from './index';
import { validAgentsDoc, validSkill } from './shared';

export const claudeDrift: Scenario = {
  name: 'claude-drift',
  description: 'Wired claude-code whose CLAUDE.md symlink is then removed (generated-file-drift → claude-drift).',
  assets: () => [validAgentsDoc(), validSkill()],
  actions: (target) => {
    symlinkSync('AGENTS.md', join(target, 'CLAUDE.md'));
    mkdirSync(join(target, '.claude'), { recursive: true });
    symlinkSync(join('..', '.agents', 'skills'), join(target, '.claude', 'skills'));
    rmSync(join(target, 'CLAUDE.md')); // introduce drift
  },
};
```

The remaining scenario modules, each exporting a `Scenario` with the listed asset composition (all use `validAgentsDoc`/`validSkill`/`raw`/`harnessConfig` from `shared.ts` and primitives):

- `missing-agents-md` — `assets: () => [validSkill()]` (no `AGENTS.md`).
- `ambiguous-config` — `[validAgentsDoc(), validSkill(), harnessConfig([]), raw('harness-hub.json', '{"harnesses":[]}\n')]`.
- `config-invalid-shape` — `[validAgentsDoc(), raw('harness-hub.yaml', 'foo: bar\n')]`.
- `config-parse-error` — `[validAgentsDoc(), raw('harness-hub.yaml', 'harnesses: [unclosed\n')]`.
- `unknown-harness-id` — `[validAgentsDoc(), harnessConfig(['bogus'])]`.
- `flat-skill-file` — `[validAgentsDoc(), raw('.agents/skills/stray.md', '# stray\n')]`.
- `skill-missing-skill-md` — `[validAgentsDoc(), raw('.agents/skills/empty/notes.txt', 'not a skill\n')]` (a dir with no `SKILL.md`).
- `skill-missing-name` — `[validAgentsDoc(), skill({ name: 'anon', location: '.agents/skills', frontmatter: { description: 'x' } })]`.
- `skill-name-mismatch` — `[validAgentsDoc(), skill({ name: 'writing-tests', location: '.agents/skills', frontmatter: { name: 'other', description: 'x' } })]`.
- `skill-missing-description` — `[validAgentsDoc(), skill({ name: 'writing-tests', location: '.agents/skills', frontmatter: { name: 'writing-tests' } })]`.
- `claude-enable` — `[validAgentsDoc(), validSkill()]`; description notes "run `harness-hub enable claude-code`".
- `claude-skills-clobber` — `[validAgentsDoc(), validSkill()]` plus an `actions` that creates `.claude/skills` as a symlink to `/somewhere/else` (mirrors the clobberRisk test fixture).
- `unmigrated-skills` — `[validAgentsDoc(), validSkill(), raw('.claude/skills/a/SKILL.md', 'body\n')]`.
- `skill-migration-collision` — `[validAgentsDoc(), validSkill(), raw('.claude/skills/writing-tests/SKILL.md', '---\nname: writing-tests\ndescription: x\n---\ndifferent\n')]`.
- `hermes-trust` — `[validAgentsDoc(), validSkill()]`; description notes "run `harness-hub enable hermes` (trust-gate → hermes-trust)".
- `multi` — `[validAgentsDoc(), validSkill()]`; description notes "enable several harnesses".

- [ ] **Step 5: Implement the scenario registry**

Create `tools/scenarios/index.ts`:

```ts
import type { Asset } from '../primitives';

export interface Scenario {
  name: string;
  description: string;
  assets(target: string): Asset[];
  actions?(target: string): void;
}

import { baseline } from './baseline';
import { claudeEnable } from './claude-enable';
import { claudeMdClobber } from './claude-md-clobber';
import { claudeSkillsClobber } from './claude-skills-clobber';
import { claudeDrift } from './claude-drift';
import { missingAgentsMd } from './missing-agents-md';
import { ambiguousConfig } from './ambiguous-config';
import { configInvalidShape } from './config-invalid-shape';
import { configParseError } from './config-parse-error';
import { unknownHarnessId } from './unknown-harness-id';
import { flatSkillFile } from './flat-skill-file';
import { skillMissingSkillMd } from './skill-missing-skill-md';
import { skillMissingName } from './skill-missing-name';
import { skillNameMismatch } from './skill-name-mismatch';
import { skillMissingDescription } from './skill-missing-description';
import { unmigratedSkills } from './unmigrated-skills';
import { skillMigrationCollision } from './skill-migration-collision';
import { hermesTrust } from './hermes-trust';
import { multi } from './multi';

export const SCENARIOS: Record<string, Scenario> = {
  baseline, 'claude-enable': claudeEnable, 'claude-md-clobber': claudeMdClobber,
  'claude-skills-clobber': claudeSkillsClobber, 'claude-drift': claudeDrift,
  'missing-agents-md': missingAgentsMd, 'ambiguous-config': ambiguousConfig,
  'config-invalid-shape': configInvalidShape, 'config-parse-error': configParseError,
  'unknown-harness-id': unknownHarnessId, 'flat-skill-file': flatSkillFile,
  'skill-missing-skill-md': skillMissingSkillMd, 'skill-missing-name': skillMissingName,
  'skill-name-mismatch': skillNameMismatch, 'skill-missing-description': skillMissingDescription,
  'unmigrated-skills': unmigratedSkills, 'skill-migration-collision': skillMigrationCollision,
  'hermes-trust': hermesTrust, multi,
};
```

- [ ] **Step 6: Implement the generator core + CLI**

Create `tools/generate.ts`:

```ts
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
```

Create `tools/generate.mjs` (thin entrypoint):

```js
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, 'dist', 'generate.js');
if (!existsSync(entry)) {
  console.error('tools not built — run: npm run build:tools');
  process.exit(1);
}
const require = createRequire(import.meta.url);
const { main } = require(entry);
main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tools/generate.test.ts tools/primitives.test.ts`
Expected: PASS. (The `.mjs` shim is not unit-tested; verify manually in Task 9 after a `build:tools`.)

- [ ] **Step 8: Commit**

```bash
git add tools/scenarios tools/generate.ts tools/generate.mjs tools/generate.test.ts
git commit -m "feat: add declarative scenario generator"
```

---

