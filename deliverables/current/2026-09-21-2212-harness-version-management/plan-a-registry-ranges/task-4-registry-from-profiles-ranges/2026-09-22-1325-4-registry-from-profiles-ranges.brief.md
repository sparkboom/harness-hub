### Task 4: Build `HARNESS_REGISTRY` from profiles + ranges

**Files:**
- Modify: `src/registry/data.ts`
- Modify: `src/registry/index.test.ts`

**Interfaces:**
- Consumes: `CONVENTION_PROFILES`/`getProfile` (Task 3), `loadVersionsManifest` (Task 3).
- Produces: `HARNESS_REGISTRY: Record<HarnessId, HarnessEntry>` — unchanged `HarnessEntry` shape, with `verifiedVersion`/`verifiedDate` derived from ranges and `agentsDoc`/`skills` from the effective profile.

- [ ] **Step 1: Rewrite `data.ts`**

```ts
import type { HarnessId } from '../harnesses';
import { ALL_HARNESS_IDS } from '../harnesses';
import type { HarnessEntry } from './types';
import { loadVersionsManifest, type HarnessVersionEntry, type VersionRange } from './versions';
import { getProfile } from './profiles';

const versions = loadVersionsManifest();

function newestVerified(ranges: VersionRange[]): VersionRange | undefined {
  return ranges.filter((r) => r.status === 'verified').at(-1);
}

// The profile the runtime should apply for wiring: the newest verified range's
// profile; if nothing is verified yet, the newest range (highest bounds).
function effectiveProfile(entry: HarnessVersionEntry) {
  const v = newestVerified(entry.ranges) ?? entry.ranges[entry.ranges.length - 1];
  const profile = getProfile(v.profile);
  if (!profile) throw new Error(`config/config.json "${entry.displayName}" references unknown profile "${v.profile}"`);
  return profile;
}

function build(id: HarnessId): HarnessEntry {
  const entry = versions[id];
  const verified = newestVerified(entry.ranges);
  const fallback = entry.ranges[entry.ranges.length - 1];
  const profile = effectiveProfile(entry);
  return {
    id,
    displayName: entry.displayName,
    verifiedVersion: verified ? (verified.max ?? verified.min) : (fallback.max ?? fallback.min),
    verifiedDate: verified?.verifiedDate ?? fallback.verifiedDate ?? '2026-01-01',
    agentsDoc: profile.agentsDoc,
    skills: profile.skills,
  };
}

export const HARNESS_REGISTRY = Object.fromEntries(
  ALL_HARNESS_IDS.map((id) => [id, build(id)])
) as Record<HarnessId, HarnessEntry>;
```

- [ ] **Step 2: Run the existing registry tests**

Run: `npx vitest run src/registry/index.test.ts`
Expected: PASS unchanged (it asserts claude-code symlink paths, hermes trust gate, per-id population — all still hold because profiles encode the same conventions).

- [ ] **Step 3: Add a derivation test**

```ts
// src/registry/index.test.ts (add)
it('derives verifiedVersion as the newest verified range max (or min when open-ended)', () => {
  expect(getHarnessEntry('codex').verifiedVersion).toBe('0.155.0'); // max of the verified range
  expect(getHarnessEntry('claude-code').verifiedVersion).toBe('2.0.0'); // open-ended → min
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/registry/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/registry/data.ts src/registry/index.test.ts
git commit -m "feat(registry): build HARNESS_REGISTRY from profiles + ranges"
```

---

