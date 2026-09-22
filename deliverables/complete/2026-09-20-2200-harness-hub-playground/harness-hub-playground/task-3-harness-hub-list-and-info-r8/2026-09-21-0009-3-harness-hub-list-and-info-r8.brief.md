### Task 3: `harness-hub list` and `harness-hub info` (R8)

**Files:**
- Create: `src/commands/list.ts`, `src/commands/info.ts`
- Modify: `src/cli.ts`
- Test: `src/commands/list.test.ts`, `src/commands/info.test.ts`

**Interfaces:**
- Consumes: `getHarnessEntry` (from `../registry`), `ALL_HARNESS_IDS` (from `../harnesses`), `isHarnessId`.
- Produces: `formatList(): string`, `formatInfo(id: HarnessId): string`, `infoHarness(id: string): { output: string; exitCode: number }`.

- [ ] **Step 1: Write the failing tests**

Create `src/commands/list.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ALL_HARNESS_IDS } from '../harnesses';
import { formatList } from './list';

describe('formatList', () => {
  it('names every harness id', () => {
    const out = formatList();
    for (const id of ALL_HARNESS_IDS) expect(out).toContain(id);
  });

  it('shows each harness version', () => {
    const out = formatList();
    expect(out).toContain('2.1.272'); // claude-code
    expect(out).toContain('1.18.31'); // opencode
  });

  it('is sorted by harness id', () => {
    const ids = ALL_HARNESS_IDS.map((id) => formatList().indexOf(id));
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
  });
});
```

Create `src/commands/info.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatInfo, infoHarness } from './info';

describe('infoHarness', () => {
  it('returns detail for a known harness', () => {
    const out = formatInfo('claude-code');
    expect(out).toContain('claude-code');
    expect(out).toContain('CLAUDE.md');
    expect(out).toContain('.claude/skills');
  });

  it('returns exit 1 for an unknown id, naming the valid ids', () => {
    const result = infoHarness('bogus');
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('bogus');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/commands/list.test.ts src/commands/info.test.ts`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement `formatList`**

Create `src/commands/list.ts`:

```ts
import { ALL_HARNESS_IDS } from '../harnesses';
import { getHarnessEntry } from '../registry';

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

export function formatList(): string {
  const rows = [...ALL_HARNESS_IDS].map((id) => {
    const e = getHarnessEntry(id);
    const skills = e.skills.mode === 'migrate-symlink' ? 'migrate-symlink' : e.skills.mode;
    return [
      pad(e.id, 12),
      pad(e.displayName, 18),
      pad(e.verifiedVersion, 12),
      pad(e.agentsDoc.mode, 12),
      skills,
    ].join(' ');
  });
  return [
    `${pad('ID', 12)}${pad('NAME', 18)}${pad('VERSION', 12)}${pad('AGENT DOC', 12)}SKILLS`,
    ...rows,
  ].join('\n');
}
```

- [ ] **Step 4: Implement `formatInfo` / `infoHarness`**

Create `src/commands/info.ts`:

```ts
import { isHarnessId, type HarnessId } from '../harnesses';
import { getHarnessEntry } from '../registry';

export function formatInfo(id: HarnessId): string {
  const e = getHarnessEntry(id);
  const lines = [`${e.displayName} (${e.id})`, `  version: ${e.verifiedVersion} (verified ${e.verifiedDate})`];
  if (e.agentsDoc.mode === 'symlink' && e.agentsDoc.symlinkPath) {
    lines.push(`  agent doc: symlink -> ${e.agentsDoc.symlinkPath}`);
  } else {
    lines.push(`  agent doc: native (reads AGENTS.md)`);
  }
  if (e.skills.mode === 'migrate-symlink' && e.skills.symlinkPath) {
    lines.push(`  skills: migrate-symlink -> ${e.skills.symlinkPath}`);
  } else {
    lines.push(`  skills: native (reads .agents/skills/)`);
  }
  if (e.skills.trustGate) {
    lines.push(`  trust gate: ${e.skills.trustGate.trustCommand}`);
    lines.push(`  trust ledger: ~/${e.skills.trustGate.configPathFromHome}`);
  }
  return lines.join('\n');
}

export function infoHarness(id: string): { output: string; exitCode: number } {
  if (!isHarnessId(id)) {
    return {
      output: `harness-hub info: unrecognized harness id "${id}" (valid: claude-code, cursor, opencode, codex, hermes, pi, deepseek)`,
      exitCode: 1,
    };
  }
  return { output: formatInfo(id), exitCode: 0 };
}
```

- [ ] **Step 5: Wire into the CLI**

In `src/cli.ts`, add two `program.command(...)` entries after `doctor`:

```ts
program.command('list').action(() => {
  console.log(formatList());
});

program.command('info <harness>').action((harness: string) => {
  const result = infoHarness(harness);
  console.log(result.output);
  exitCode = result.exitCode;
});
```

and add the imports for `formatList` and `infoHarness`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/commands/list.test.ts src/commands/info.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/commands/list.ts src/commands/info.ts src/commands/list.test.ts src/commands/info.test.ts src/cli.ts
git commit -m "feat: add harness-hub list and info commands"
```

---

