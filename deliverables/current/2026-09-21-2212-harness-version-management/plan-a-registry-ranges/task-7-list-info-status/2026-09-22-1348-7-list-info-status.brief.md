### Task 7: Wire status into `list` and `info`

**Files:**
- Modify: `src/commands/list.ts`
- Modify: `src/commands/info.ts`
- Modify: `src/cli.ts`
- Modify: `src/commands/list.test.ts`, `src/commands/info.test.ts`

**Interfaces:**
- Consumes: `resolveHarnessStatus` (Task 5), `detectInstalledVersions` (Task 6).
- Produces: `formatList(installed)` (REQUIRED arg now) and `infoHarness(id, installedVersion?)` emit a status signal.

- [ ] **Step 1: Update `list.ts`**

```ts
import { ALL_HARNESS_IDS, type HarnessId } from '../harnesses';
import { getHarnessEntry } from '../registry';
import { resolveHarnessStatus } from '../registry';

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

export function formatList(installed: Record<HarnessId, string | null>): string {
  const rows = [...ALL_HARNESS_IDS].sort().map((id) => {
    const e = getHarnessEntry(id);
    const skills = e.skills.mode === 'migrate-symlink' ? 'migrate-symlink' : e.skills.mode;
    const trustGate = e.skills.trustGate ? e.skills.trustGate.trustCommand : '-';
    const status = resolveHarnessStatus(id, installed[id]).status;
    return [
      pad(e.id, 12),
      pad(e.displayName, 18),
      pad(e.verifiedVersion, 12),
      pad(e.agentsDoc.mode, 12),
      pad(skills, 12),
      pad(status, 12),
      trustGate,
    ].join(' ');
  });
  return [
    `${pad('ID', 12)}${pad('NAME', 18)}${pad('VERSION', 12)}${pad('AGENT DOC', 12)}${pad('SKILLS', 12)}${pad('STATUS', 12)}TRUST GATE`,
    ...rows,
  ].join('\n');
}
```

- [ ] **Step 2: Update `info.ts`**

```ts
import { isHarnessId, type HarnessId } from '../harnesses';
import { getHarnessEntry, resolveHarnessStatus } from '../registry';

export function formatInfo(id: HarnessId, installedVersion?: string | null): string {
  const e = getHarnessEntry(id);
  const status = resolveHarnessStatus(id, installedVersion ?? null).status;
  const lines = [
    `${e.displayName} (${e.id})`,
    `  version: ${e.verifiedVersion} (verified ${e.verifiedDate})`,
    `  status: ${status}`,
  ];
  // ... rest unchanged (agent doc / skills / trust gate lines)
  return lines.join('\n');
}

export function infoHarness(id: string, installedVersion?: string | null): { output: string; exitCode: number } {
  if (!isHarnessId(id)) {
    return {
      output: `harness-hub info: unrecognized harness id "${id}" (valid: claude-code, cursor, cursor-cli, opencode, codex, hermes, pi, deepseek)`,
      exitCode: 1,
    };
  }
  return { output: formatInfo(id, installedVersion), exitCode: 0 };
}
```

- [ ] **Step 3: Update `cli.ts` to detect and pass versions**

```ts
// in the list action
program.command('list').action(() => {
  console.log(formatList(detectInstalledVersions()));
});

// in the info action
program.command('info <harness>').action((harness: string) => {
  const installed = detectInstalledVersions()[harness as HarnessId] ?? null;
  const result = infoHarness(harness, installed);
  console.log(result.output);
  exitCode = result.exitCode;
});
```

(Import `detectInstalledVersions` from `./harnessDetect`.)

- [ ] **Step 4: Update the tests to pass an installed map**

```ts
// src/commands/list.test.ts — every formatList() call becomes formatList({}) or a fixed map
import { ALL_HARNESS_IDS, type HarnessId } from '../harnesses';

const none = Object.fromEntries(ALL_HARNESS_IDS.map((id) => [id, null])) as Record<HarnessId, string | null>;

// 'shows each harness version' → formatList(none)
// 'is sorted by harness id' → formatList(none)
// add:
it('shows a STATUS column and marks an uninstalled harness unrecognized', () => {
  const out = formatList(none);
  expect(out).toContain('STATUS');
  expect(out).toContain('unrecognized');
});
```

```ts
// src/commands/info.test.ts — add status assertion
it('surfaces a status line', () => {
  const out = formatInfo('codex', '0.150.0');
  expect(out).toContain('status: verified');
});
```

- [ ] **Step 5: Run the command tests**

Run: `npx vitest run src/commands/list.test.ts src/commands/info.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/commands/list.ts src/commands/info.ts src/cli.ts src/commands/list.test.ts src/commands/info.test.ts
git commit -m "feat: surface verified/unverified/unrecognized status in list and info"
```

---

