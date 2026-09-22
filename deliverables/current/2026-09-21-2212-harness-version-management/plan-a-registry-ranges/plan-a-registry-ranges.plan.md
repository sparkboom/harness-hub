# Plan A — Registry Version Ranges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-point `version`/`verifiedDate` in `config.json` with ordered semver **ranges** bound to named convention **profiles**, and wire a `verified`/`unverified`/`unrecognized` status signal through `list`, `info`, and `doctor`.

**Architecture:** Convention profiles (agentsDoc mode + skills mode + optional trust gate) become named, typed code (`profiles.ts`). Version ranges become data (`config.json`). A pure resolver (`resolve.ts`) maps `(harnessId, installedVersion) → { profile, status }`. The existing `HARNESS_REGISTRY` keeps producing its current `HarnessEntry` shape so `list`/`info` output does not regress — `verifiedVersion` is derived from the newest `verified` range.

**Tech Stack:** TypeScript (Node ≥22), `semver` (new dependency), vitest. No new runtime deps beyond `semver`.

**Spec:** `deliverables/current/2026-09-21-2212-harness-version-management/harness-version-management.spec.md` (R1, R4). Supporting: none (this plan owns R1/R4 only).

## Global Constraints

- Harness id set **grows from 7 to 8**: add `cursor-cli` (the headless `agent` CLI). `cursor` stays the IDE. (`src/harnesses.ts`.)
- `min` inclusive, `max` exclusive (semver); `max: null` = open-ended. Ranges are **ordered lowest-first**; resolution returns the **first** range whose bounds contain the version.
- Statuses: `verified`, `unverified`, `unrecognized` (a resolution outcome, never stored). `unrecognized` = installed version is `null`, unparseable, or matches no range.
- `HARNESS_REGISTRY` must keep emitting `HarnessEntry` with `displayName`, `verifiedVersion`, `verifiedDate`, `agentsDoc`, `skills` — unchanged field names/types. `verifiedVersion` = newest `verified` range's `max` (or `min` when `max` is `null`).
- The `npm` `files` array already ships `config/config.json`; no change needed there, but `config.json` must keep a `harness.versions` top-level object.
- Builds/tests: `npm test` (vitest), `npm run typecheck`, `npm run build` must stay green. This plan touches `src/` only — **not** `test/tools/`.
- `semver` (runtime dep) + `@types/semver` (dev dep) are added to the **root** `package.json`; both `src/` and (later, in Plan B) `test/tools/` resolve them from the root `node_modules`.

### Cross-boundary note (resolver sharing)

`src/registry/resolve.ts` is the single source of truth for range matching. Plan B (`test/tools/`) needs the same matching but compiles under a separate tsconfig (`test/tools/tsconfig.json`, `rootDir: "."`) that cannot `import ../../src`. The resolver is pure and its behavior is fixed by this plan's tests; Plan B will import it in **test files** (vitest resolves source directly, no `rootDir` constraint) for an equivalence check, and will re-express the small range check in `test/tools` production code using the same `semver` calls. Do not try to make `test/tools` import `src` in production code.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/harnesses.ts` | Add `cursor-cli` to `ALL_HARNESS_IDS`. |
| `src/registry/types.ts` | Keep convention types; (unchanged) `HarnessEntry` shape. |
| `src/registry/versions.ts` | `HarnessVersionEntry` → `ranges`; parse + validate; cache. |
| `src/registry/profiles.ts` | **new** — `ConventionProfile` + `CONVENTION_PROFILES`. |
| `src/registry/resolve.ts` | **new** — pure `resolveVersion` / `resolveHarnessStatus`. |
| `src/registry/data.ts` | Build `HARNESS_REGISTRY` from profiles + ranges. |
| `src/registry/index.ts` | Export `getVersionEntry`, `resolveHarnessStatus`. |
| `src/harnessDetect.ts` | **new** — installed-version detection (product surface). |
| `src/commands/list.ts` | Add STATUS column; accept installed map. |
| `src/commands/info.ts` | Add status line; accept installed version. |
| `src/commands/doctor.ts` | Pass installed versions to context. |
| `src/doctor/context.ts` | Add `installedVersions` to `DoctorContext`. |
| `src/doctor/rules/versionStatus.ts` | **new** — version-status doctor rule. |
| `src/doctor/rules/index.ts` | Register the new rule. |
| `config/config.json` | Rewrite to ranges + `cursor-cli`. |

---

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

### Task 2: Add the `semver` dependency

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `semver` and `@types/semver` available to `src/`.

- [ ] **Step 1: Install**

Run:

```bash
npm install semver@^7.6.0
npm install -D @types/semver@^7.5.0
```

- [ ] **Step 2: Verify resolution**

Run: `node -e "const s = require('semver'); console.log(s.gte('0.155.1','0.139.0'), s.lt('0.155.1','0.155.0'))"`
Expected: `true false`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add semver dependency for version-range matching"
```

---

### Task 3: Define the range schema + profiles, and rewrite `config.json`

**Files:**
- Create: `src/registry/profiles.ts`
- Modify: `src/registry/versions.ts` (types + loader)
- Modify: `config/config.json`
- Modify: `src/registry/versions.test.ts`

**Interfaces:**
- Consumes: nothing (foundational).
- Produces:
  - `ConventionProfile { name: string; agentsDoc: AgentsDocConvention; skills: SkillsConvention }` and `CONVENTION_PROFILES: Record<string, ConventionProfile>` (profiles `claude-code-symlink-v1`, `hermes-native-v1`, `native-v1`).
  - `HarnessVersionEntry { displayName: string; install: HarnessInstallManifest; ranges: VersionRange[] }`.
  - `VersionRange { profile: string; min: string; max: string | null; status: 'verified' | 'unverified'; verifiedDate?: string; caveat?: string; review?: 'automated' | 'manual' }`.

- [ ] **Step 1: Write `profiles.ts`**

```ts
// src/registry/profiles.ts
import type { AgentsDocConvention, SkillsConvention, TrustGateConvention } from './types';

export interface ConventionProfile {
  name: string;
  agentsDoc: AgentsDocConvention;
  skills: SkillsConvention;
}

const hermesTrustGate: TrustGateConvention = {
  configPathFromHome: '.hermes/config.yaml',
  trustedDirsKeyPath: ['skills', 'trusted_project_dirs'],
  trustCommand: 'hermes skills trust',
};

export const CONVENTION_PROFILES: Record<string, ConventionProfile> = {
  'claude-code-symlink-v1': {
    name: 'claude-code-symlink-v1',
    agentsDoc: { mode: 'symlink', symlinkPath: 'CLAUDE.md' },
    skills: { mode: 'migrate-symlink', symlinkPath: '.claude/skills' },
  },
  'hermes-native-v1': {
    name: 'hermes-native-v1',
    agentsDoc: { mode: 'native' },
    skills: { mode: 'native', trustGate: hermesTrustGate },
  },
  'native-v1': {
    name: 'native-v1',
    agentsDoc: { mode: 'native' },
    skills: { mode: 'native' },
  },
};

export function getProfile(name: string): ConventionProfile | undefined {
  return CONVENTION_PROFILES[name];
}
```

- [ ] **Step 2: Write the failing test for the profile registry**

```ts
// src/registry/profiles.test.ts (new)
import { describe, it, expect } from 'vitest';
import { CONVENTION_PROFILES, getProfile } from './profiles';

describe('convention profiles', () => {
  it('defines exactly the three expected profiles', () => {
    expect(Object.keys(CONVENTION_PROFILES).sort()).toEqual(
      ['claude-code-symlink-v1', 'hermes-native-v1', 'native-v1'].sort()
    );
  });

  it('keeps claude-code the only symlink/migrate-symlink profile', () => {
    expect(CONVENTION_PROFILES['claude-code-symlink-v1'].agentsDoc.mode).toBe('symlink');
    expect(CONVENTION_PROFILES['claude-code-symlink-v1'].skills.mode).toBe('migrate-symlink');
    expect(CONVENTION_PROFILES['native-v1'].agentsDoc.mode).toBe('native');
    expect(CONVENTION_PROFILES['native-v1'].skills.trustGate).toBeUndefined();
  });

  it('keeps the hermes trust gate on hermes-native-v1 only', () => {
    expect(CONVENTION_PROFILES['hermes-native-v1'].skills.trustGate?.trustCommand).toBe('hermes skills trust');
    expect(getProfile('does-not-exist')).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run src/registry/profiles.test.ts`
Expected: PASS (this is a new file, no prior failure).

- [ ] **Step 4: Rewrite the version-entry types in `versions.ts`**

`HarnessInstallManifest` already exists in the file — leave it unchanged. Replace `HarnessVersionEntry` and add `VersionRange`:

```ts
export interface VersionRange {
  profile: string;
  min: string;
  max: string | null;
  status: 'verified' | 'unverified';
  verifiedDate?: string;
  caveat?: string;
  review?: 'automated' | 'manual';
}

export interface HarnessVersionEntry {
  displayName: string;
  install: HarnessInstallManifest;
  ranges: VersionRange[];
}
```

Also change the loader to **cache** (so `data.ts`, `resolve.ts`, and `list`/`info` don't re-read the file per call) and **validate** that every referenced profile exists:

```ts
import { getProfile } from './profiles';

let cached: Record<HarnessId, HarnessVersionEntry> | undefined;

export function loadVersionsManifest(): Record<HarnessId, HarnessVersionEntry> {
  if (cached) return cached;
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ManifestShape;
  const versions = raw.harness.versions;
  for (const id of ALL_HARNESS_IDS) {
    if (!(id in versions)) throw new Error(`config/config.json is missing an entry for "${id}"`);
  }
  for (const id of ALL_HARNESS_IDS) {
    const entry = versions[id];
    if (!Array.isArray(entry.ranges) || entry.ranges.length === 0) {
      throw new Error(`config/config.json "${id}" has no ranges`);
    }
    for (const r of entry.ranges) {
      if (!getProfile(r.profile)) {
        throw new Error(`config/config.json "${id}" references unknown profile "${r.profile}"`);
      }
    }
  }
  cached = versions as Record<HarnessId, HarnessVersionEntry>;
  return cached;
}
```

(The existing `ManifestShape` and `MANIFEST_PATH` stay as-is.)

- [ ] **Step 5: Rewrite `config/config.json` to the ranges schema**

```json
{
  "harness": {
    "versions": {
      "claude-code": {
        "displayName": "Claude Code",
        "install": { "method": "npm", "package": "@anthropic-ai/claude-code" },
        "ranges": [
          { "profile": "claude-code-symlink-v1", "min": "2.0.0", "max": null,
            "status": "verified", "verifiedDate": "2026-09-15", "review": "automated" }
        ]
      },
      "cursor": {
        "displayName": "Cursor",
        "install": { "method": "fhs-wrapper", "url": "https://cursor.com/install" },
        "ranges": [
          { "profile": "native-v1", "min": "3.0.0", "max": null,
            "status": "verified", "verifiedDate": "2026-09-10", "review": "manual",
            "caveat": "IDE surface; CLI ≡ IDE assumption unverified — manual review only." }
        ]
      },
      "cursor-cli": {
        "displayName": "Cursor CLI",
        "install": { "method": "fhs-wrapper", "url": "https://cursor.com/install" },
        "ranges": [
          { "profile": "native-v1", "min": "3.0.0", "max": null,
            "status": "unverified", "review": "automated",
            "caveat": "AGENTS.md auto-load on the headless `agent` CLI is disputed — must be re-verified." }
        ]
      },
      "opencode": {
        "displayName": "OpenCode",
        "install": { "method": "npm", "package": "opencode-ai" },
        "ranges": [
          { "profile": "native-v1", "min": "1.0.0", "max": null,
            "status": "verified", "verifiedDate": "2026-09-14", "review": "automated" }
        ]
      },
      "codex": {
        "displayName": "Codex",
        "install": { "method": "npm", "package": "@openai/codex" },
        "ranges": [
          { "profile": "native-v1", "min": "0.139.0", "max": "0.155.0",
            "status": "verified", "verifiedDate": "2026-09-03", "review": "automated" },
          { "profile": "native-v1", "min": "0.155.0", "max": null,
            "status": "unverified", "review": "automated" }
        ]
      },
      "hermes": {
        "displayName": "Hermes",
        "install": { "method": "npm", "package": "hermes-agent" },
        "ranges": [
          { "profile": "hermes-native-v1", "min": "0.0.0", "max": null,
            "status": "verified", "verifiedDate": "2026-09-11", "review": "automated" }
        ]
      },
      "pi": {
        "displayName": "Pi",
        "install": { "method": "npm", "package": "@mariozechner/pi-coding-agent" },
        "ranges": [
          { "profile": "native-v1", "min": "0.0.0", "max": null,
            "status": "verified", "verifiedDate": "2026-09-04", "review": "automated" }
        ]
      },
      "deepseek": {
        "displayName": "DeepSeek Harness",
        "install": { "method": "npm", "package": "@deepseek-ai/dsh" },
        "ranges": [
          { "profile": "native-v1", "min": "0.0.0", "max": null,
            "status": "verified", "verifiedDate": "2026-09-10", "review": "automated" }
        ]
      }
    }
  }
}
```

> Naming note: the spec's illustrative `codex-native-v1` profile is realized as the shared `native-v1` (identical conventions for codex/opencode/pi/deepseek/cursor/cursor-cli). A harness-specific name is unnecessary duplication; the `profile` field points at `native-v1`.

- [ ] **Step 6: Update `versions.test.ts` for the new schema**

Rewrite the tests that referenced `.version`/`.verifiedDate`/`.install.method` to assert ranges instead:

```ts
// src/registry/versions.test.ts (rewrite)
import { describe, it, expect } from 'vitest';
import { ALL_HARNESS_IDS } from '../harnesses';
import { loadVersionsManifest } from './versions';
import { CONVENTION_PROFILES } from './profiles';

describe('harness versions manifest', () => {
  it('has an entry for every recognized harness id', () => {
    expect(Object.keys(loadVersionsManifest()).sort()).toEqual([...ALL_HARNESS_IDS].sort());
  });

  it('gives every harness at least one range with a known profile', () => {
    const m = loadVersionsManifest();
    for (const id of ALL_HARNESS_IDS) {
      expect(m[id].ranges.length).toBeGreaterThan(0);
      for (const r of m[id].ranges) {
        expect(CONVENTION_PROFILES[r.profile]).toBeDefined();
        expect(r.status).toMatch(/^(verified|unverified)$/);
      }
    }
  });

  it('keeps cursor and cursor-cli as fhs-wrapper, every npm harness as npm', () => {
    const m = loadVersionsManifest();
    expect(m.cursor.install.method).toBe('fhs-wrapper');
    expect(m['cursor-cli'].install.method).toBe('fhs-wrapper');
    expect(m['claude-code'].install.method).toBe('npm');
    expect(m.codex.install.method).toBe('npm');
  });

  it('marks cursor manual-review and cursor-cli automated-review', () => {
    const m = loadVersionsManifest();
    expect(m.cursor.ranges[0].review).toBe('manual');
    expect(m['cursor-cli'].ranges[0].review).toBe('automated');
  });
});
```

- [ ] **Step 7: Run the registry tests**

Run: `npx vitest run src/registry/versions.test.ts src/registry/profiles.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/registry/profiles.ts src/registry/profiles.test.ts src/registry/versions.ts src/registry/versions.test.ts config/config.json
git commit -m "feat(registry): add convention profiles and rewrite config.json to version ranges"
```

---

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

### Task 5: The resolver

**Files:**
- Create: `src/registry/resolve.ts`
- Create: `src/registry/resolve.test.ts`
- Modify: `src/registry/index.ts`

**Interfaces:**
- Consumes: `HarnessVersionEntry`, `VersionRange` (Task 3); `HarnessId`.
- Produces:
  - `ResolvedStatus = 'verified' | 'unverified' | 'unrecognized'`
  - `Resolution { harnessId, installedVersion, status, profile: string | null, range: VersionRange | null }`
  - `resolveVersion(id, entry, installedVersion): Resolution`
  - `resolveHarnessStatus(id, installedVersion): Resolution` (loads the manifest itself).

- [ ] **Step 1: Write the failing test**

```ts
// src/registry/resolve.test.ts
import { describe, it, expect } from 'vitest';
import { resolveVersion } from './resolve';
import type { HarnessVersionEntry } from './versions';

const codex: HarnessVersionEntry = {
  displayName: 'Codex',
  install: { method: 'npm', package: '@openai/codex' },
  ranges: [
    { profile: 'native-v1', min: '0.139.0', max: '0.155.0', status: 'verified', verifiedDate: '2026-09-03' },
    { profile: 'native-v1', min: '0.155.0', max: null, status: 'unverified' },
  ],
};

describe('resolveVersion', () => {
  it('resolves an in-range verified version', () => {
    const r = resolveVersion('codex', codex, '0.150.0');
    expect(r.status).toBe('verified');
    expect(r.profile).toBe('native-v1');
  });

  it('resolves an in-range unverified version (upstream moved)', () => {
    const r = resolveVersion('codex', codex, '0.155.1');
    expect(r.status).toBe('unverified');
  });

  it('treats max as exclusive', () => {
    expect(resolveVersion('codex', codex, '0.155.0').status).toBe('unverified');
    expect(resolveVersion('codex', codex, '0.154.999').status).toBe('verified');
  });

  it('returns unrecognized for null, unparseable, or out-of-range versions', () => {
    expect(resolveVersion('codex', codex, null).status).toBe('unrecognized');
    expect(resolveVersion('codex', codex, '3.x').status).toBe('unrecognized');
    expect(resolveVersion('codex', codex, '0.100.0').status).toBe('unrecognized');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/registry/resolve.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `resolve.ts`**

```ts
import { gte, lt, coerce, valid } from 'semver';
import type { HarnessId } from '../harnesses';
import { loadVersionsManifest, type HarnessVersionEntry, type VersionRange } from './versions';

export type ResolvedStatus = 'verified' | 'unverified' | 'unrecognized';

export interface Resolution {
  harnessId: HarnessId;
  installedVersion: string | null;
  status: ResolvedStatus;
  profile: string | null;
  range: VersionRange | null;
}

function parseVersion(raw: string): string | null {
  const cleaned = raw.trim();
  return valid(cleaned) ?? coerce(cleaned)?.version ?? null;
}

function inRange(v: string, min: string, max: string | null): boolean {
  return gte(v, min) && (max === null || lt(v, max));
}

export function resolveVersion(
  harnessId: HarnessId,
  entry: HarnessVersionEntry,
  installedVersion: string | null
): Resolution {
  if (installedVersion === null) {
    return { harnessId, installedVersion, status: 'unrecognized', profile: null, range: null };
  }
  const parsed = parseVersion(installedVersion);
  if (parsed === null) {
    return { harnessId, installedVersion, status: 'unrecognized', profile: null, range: null };
  }
  const range = entry.ranges.find((r) => inRange(parsed, r.min, r.max));
  if (!range) {
    return { harnessId, installedVersion, status: 'unrecognized', profile: null, range: null };
  }
  return { harnessId, installedVersion, status: range.status, profile: range.profile, range };
}

export function resolveHarnessStatus(harnessId: HarnessId, installedVersion: string | null): Resolution {
  return resolveVersion(harnessId, loadVersionsManifest()[harnessId], installedVersion);
}
```

- [ ] **Step 4: Export from `index.ts`**

```ts
// src/registry/index.ts (add)
export { getVersionEntry } from './versions';
export { resolveHarnessStatus, resolveVersion, type ResolvedStatus, type Resolution } from './resolve';
```

And add `getVersionEntry` to `versions.ts`:

```ts
export function getVersionEntry(id: HarnessId): HarnessVersionEntry {
  return loadVersionsManifest()[id];
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/registry/resolve.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/registry/resolve.ts src/registry/resolve.test.ts src/registry/index.ts src/registry/versions.ts
git commit -m "feat(registry): add version-range resolver (verified/unverified/unrecognized)"
```

---

### Task 6: Installed-version detection in the product surface

**Files:**
- Create: `src/harnessDetect.ts`
- Create: `src/harnessDetect.test.ts`

**Interfaces:**
- Produces:
  - `resolveBinary(id: HarnessId): string | null`
  - `runVersion(id: HarnessId): string | null` (runs `<binary> --version`, first trimmed line)
  - `detectInstalledVersions(): Record<HarnessId, string | null>`

- [ ] **Step 1: Write the failing test (inject the runner)**

```ts
// src/harnessDetect.test.ts
import { describe, it, expect } from 'vitest';
import { detectWith } from './harnessDetect';

describe('harnessDetect', () => {
  it('maps each id through the runner and normalizes output', () => {
    const rows = detectWith((id) => (id === 'codex' ? '0.155.1\n' : null));
    expect(rows.codex).toBe('0.155.1');
    expect(rows['claude-code']).toBeNull();
    expect(rows['cursor-cli']).toBeNull();
  });

  it('covers all eight ids', () => {
    const keys = Object.keys(detectWith(() => null)).sort();
    expect(keys).toEqual([
      'claude-code', 'codex', 'cursor', 'cursor-cli', 'deepseek', 'hermes', 'opencode', 'pi',
    ]);
  });
});
```

- [ ] **Step 2: Implement `harnessDetect.ts`**

```ts
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ALL_HARNESS_IDS, type HarnessId } from './harnesses';

const BINARY_CANDIDATES: Record<HarnessId, string[]> = {
  'claude-code': ['claude'],
  cursor: [], // IDE surface — no reliable headless version probe
  'cursor-cli': ['agent', join(homedir(), '.cursor', 'bin', 'agent'), join(homedir(), '.local', 'bin', 'agent')],
  opencode: ['opencode'],
  codex: ['codex'],
  hermes: ['hermes'],
  pi: ['pi'],
  deepseek: ['dsh'],
};

function which(bin: string): string | null {
  const r = spawnSync('sh', ['-c', `command -v "${bin}"`], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null;
}

export function resolveBinary(id: HarnessId): string | null {
  for (const cand of BINARY_CANDIDATES[id] ?? []) {
    if (cand.includes(homedir())) {
      if (existsSync(cand)) return cand;
    } else {
      const found = which(cand);
      if (found) return found;
    }
  }
  return null;
}

export type VersionRunner = (id: HarnessId) => string | null;

export function runVersion(id: HarnessId): string | null {
  const bin = resolveBinary(id);
  if (!bin) return null;
  const r = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 15000 });
  if (r.error || r.status !== 0) return null;
  const first = (r.stdout ?? '').split('\n')[0].trim();
  return first || null;
}

export function detectWith(runner: VersionRunner): Record<HarnessId, string | null> {
  return Object.fromEntries(ALL_HARNESS_IDS.map((id) => [id, runner(id)])) as Record<HarnessId, string | null>;
}

export function detectInstalledVersions(): Record<HarnessId, string | null> {
  return detectWith(runVersion);
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run src/harnessDetect.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/harnessDetect.ts src/harnessDetect.test.ts
git commit -m "feat: add installed-version detection to the product surface"
```

---

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

### Task 8: The doctor version-status rule

**Files:**
- Create: `src/doctor/rules/versionStatus.ts`
- Create: `src/doctor/rules/versionStatus.test.ts`
- Modify: `src/doctor/rules/index.ts`
- Modify: `src/doctor/context.ts`
- Modify: `src/commands/doctor.ts`

**Interfaces:**
- Consumes: `resolveHarnessStatus` (Task 5), `detectInstalledVersions` (Task 6), `DoctorContext`.
- Produces: a `version-status` rule that warns for each **configured/pending** harness whose installed version is `unverified` or `unrecognized`; non-zero only on `error` severity (this rule emits warnings only — status never blocks).

- [ ] **Step 1: Extend `DoctorContext` with installed versions**

```ts
// src/doctor/context.ts
export interface DoctorContext {
  // ...existing fields...
  installedVersions: Record<HarnessId, string | null>;
}

const EMPTY_VERSIONS = {} as Record<HarnessId, string | null>;

export function buildDoctorContext(
  repoRoot: string,
  pendingHarnesses: HarnessId[] = [],
  homeDir: string = homedir(),
  installedVersions: Record<HarnessId, string | null> = EMPTY_VERSIONS
): DoctorContext {
  const config = loadConfig(repoRoot);
  const configuredHarnesses = config.status === 'ok' ? config.harnesses : [];
  return { repoRoot, homeDir, config, configuredHarnesses, pendingHarnesses, installedVersions };
}
```

(Default is an empty map so the pure `doctor` unit tests stay fast; real detection is wired in `commands/doctor.ts` below.)

- [ ] **Step 2: Write the failing test**

```ts
// src/doctor/rules/versionStatus.test.ts
import { describe, it, expect } from 'vitest';
import type { HarnessId } from '../../harnesses';
import type { DoctorContext } from '../types';
import { versionStatusRule } from './versionStatus';

function ctx(configured: HarnessId[], installed: Record<HarnessId, string | null>): DoctorContext {
  return {
    repoRoot: '/tmp/repo',
    homeDir: '/tmp/home',
    config: { status: 'ok', format: 'yaml', path: 'x', harnesses: configured, unknownIds: [] },
    configuredHarnesses: configured,
    pendingHarnesses: [],
    installedVersions: installed,
  };
}

describe('version-status rule', () => {
  it('warns when an installed version falls in an unverified range', () => {
    const installed = { codex: '0.155.1' } as Record<HarnessId, string | null>;
    const findings = versionStatusRule.check(ctx(['codex'], installed));
    expect(findings.some((f) => f.ruleId === 'version-unverified' && f.harnessId === 'codex')).toBe(true);
  });

  it('warns when an installed version matches no range', () => {
    const installed = { codex: '9.9.9' } as Record<HarnessId, string | null>;
    const findings = versionStatusRule.check(ctx(['codex'], installed));
    expect(findings.some((f) => f.ruleId === 'version-unrecognized')).toBe(true);
  });

  it('is silent for a verified version', () => {
    const installed = { codex: '0.150.0' } as Record<HarnessId, string | null>;
    expect(versionStatusRule.check(ctx(['codex'], installed))).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Implement `versionStatus.ts`**

```ts
import { ALL_HARNESS_IDS, type HarnessId } from '../../harnesses';
import { resolveHarnessStatus } from '../../registry';
import type { DoctorContext, DoctorRule, Finding } from '../types';

function isRelevant(ctx: DoctorContext, id: HarnessId): boolean {
  return ctx.configuredHarnesses.includes(id) || ctx.pendingHarnesses.includes(id);
}

export const versionStatusRule: DoctorRule = {
  id: 'version-status',
  applies: (ctx) => ALL_HARNESS_IDS.some((id) => isRelevant(ctx, id)),
  check: (ctx) => {
    const findings: Finding[] = [];
    for (const id of ALL_HARNESS_IDS) {
      if (!isRelevant(ctx, id)) continue;
      const installed = ctx.installedVersions[id];
      const status = resolveHarnessStatus(id, installed).status;
      if (status === 'unrecognized') {
        findings.push({
          ruleId: 'version-unrecognized',
          severity: 'warning',
          message: `${id}: installed version ${installed ?? 'unknown'} matches no verified range.`,
          remediation: 'Run `reconcile --check`, then review the version (see scenarios.md).',
          harnessId: id,
          forceable: false,
        });
      } else if (status === 'unverified') {
        findings.push({
          ruleId: 'version-unverified',
          severity: 'warning',
          message: `${id}: installed version ${installed} is in an unverified range (upstream moved).`,
          remediation: 'Run `reconcile --check`, then review the version (see scenarios.md).',
          harnessId: id,
          forceable: false,
        });
      }
    }
    return findings;
  },
};
```

- [ ] **Step 4: Register the rule**

```ts
// src/doctor/rules/index.ts — add import + append to ALL_DOCTOR_RULES
import { versionStatusRule } from './versionStatus';
export const ALL_DOCTOR_RULES: DoctorRule[] = [
  // ...existing...
  generatedFileDriftRule,
  versionStatusRule,
];
```

- [ ] **Step 5: Wire real detection into the doctor command**

```ts
// src/commands/doctor.ts — pass installed versions explicitly
import { detectInstalledVersions } from '../harnessDetect';

export function runDoctorCommand(repoRoot: string, homeDir?: string): DoctorCommandResult {
  const ctx = buildDoctorContext(repoRoot, [], homeDir, detectInstalledVersions());
  const findings = runDoctor(ctx, ALL_DOCTOR_RULES);
  const exitCode = findings.some((f) => f.severity === 'error') ? 1 : 0;
  return { findings, output: formatFindings(findings), exitCode };
}
```

(The `runDoctorCommand` change is the only `commands/doctor.ts` edit; `buildDoctorContext`'s 4th arg is otherwise optional and defaults to empty for tests.)

- [ ] **Step 5: Run the rule tests and the doctor command tests**

Run: `npx vitest run src/doctor/rules/versionStatus.test.ts src/commands/doctor.test.ts`
Expected: PASS. (`doctor.test.ts`'s "minimal valid repo" still passes because no harnesses are configured, so the rule produces nothing.)

- [ ] **Step 6: Commit**

```bash
git add src/doctor/rules/versionStatus.ts src/doctor/rules/versionStatus.test.ts src/doctor/rules/index.ts src/doctor/context.ts src/commands/doctor.ts
git commit -m "feat(doctor): warn on unverified/unrecognized installed versions"
```

---

### Task 9: Full verification

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: PASS (all suites, including the registry/commands/doctor updates).

- [ ] **Step 2: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both clean.

- [ ] **Step 3: Smoke-test the CLI**

Run: `node dist/bin.js list` and `node dist/bin.js info codex`
Expected: `list` shows a STATUS column (unrecognized/verified/unverified per host); `info codex` shows a `status:` line. No crash.

- [ ] **Step 4: Commit any residual**

```bash
git add -A
git commit -m "test: verify registry-ranges deliverable end-to-end" --allow-empty
```

---

## Self-Review

**Spec coverage (R1, R4):**
- R1 profiles-in-code → Task 3 (`profiles.ts`).
- R1 ranges-in-data → Task 3 (`config.json` + `versions.ts`).
- R1 ordered ranges, min-inclusive/max-exclusive, first-match → Task 5.
- R1 resolution contract (`verified` / `unverified` / `unrecognized`) → Task 5.
- R1 compatibility (`verifiedVersion` = newest verified range's max/min) → Task 4.
- R1 `caveat` / `review` fields → Task 3 (schema + config).
- R4 list/info status → Task 7.
- R4 doctor rule → Task 8.
- Background `cursor`/`cursor-cli` split → Task 1.
- Success criterion 1 (ranges + resolver + no list/info regression) → Tasks 3–9.

**Placeholder scan:** no TBD/TODO; every code step has concrete code; tests are actual vitest code.

**Type consistency:** `VersionRange`, `HarnessVersionEntry`, `Resolution`, `ResolvedStatus`, `ConventionProfile` names are used consistently across Tasks 3–8; `resolveHarnessStatus`/`resolveVersion`/`detectInstalledVersions`/`detectWith` signatures are stable. `formatList` signature changes from `()` to `(installed)` and all callers/tests are updated in the same task.
