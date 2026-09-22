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

