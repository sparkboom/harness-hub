### Task 1: Add `cursor-cli` to the harness id set

**Files:**
- Modify: `src/harnesses.ts`
- Modify: `src/harnesses.test.ts` (if it asserts the id list — verify)

**Interfaces:**
- Produces: `ALL_HARNESS_IDS` now contains `cursor-cli` (8 entries); `HarnessId` includes `'cursor-cli'`.

- [ ] **Step 1: Write the failing test**

```ts
// src/harnesses.test.ts (add)
import { describe, it, expect } from 'vitest';
import { ALL_HARNESS_IDS, isHarnessId } from './harnesses';

describe('harness ids', () => {
  it('recognizes cursor-cli as an eighth id, distinct from cursor', () => {
    expect(ALL_HARNESS_IDS).toContain('cursor-cli');
    expect(ALL_HARNESS_IDS).toContain('cursor');
    expect(ALL_HARNESS_IDS.length).toBe(8);
    expect(isHarnessId('cursor-cli')).toBe(true);
    expect(isHarnessId('cursor')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/harnesses.test.ts`
Expected: FAIL — `ALL_HARNESS_IDS.length` is 7, `isHarnessId('cursor-cli')` is false.

- [ ] **Step 3: Add the id**

```ts
export const ALL_HARNESS_IDS = [
  'claude-code',
  'cursor',
  'cursor-cli',
  'opencode',
  'codex',
  'hermes',
  'pi',
  'deepseek',
] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/harnesses.test.ts`
Expected: PASS.

- [ ] **Step 5: Note the fallout, but do not fix yet**

Several tests (`src/registry/versions.test.ts`, `src/registry/index.test.ts`, `src/commands/list.test.ts`) will now fail because `config.json` lacks `cursor-cli` and `data.ts` has no entry. Those are fixed in Tasks 3–6. Do not try to make the whole suite green until Task 6. Commit this task alone (the suite is expected-red at this point).

- [ ] **Step 6: Commit**

```bash
git add src/harnesses.ts src/harnesses.test.ts
git commit -m "feat(registry): add cursor-cli harness id (IDE vs headless CLI split)"
```

---

