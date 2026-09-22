### Task 3: Relocate the manifest to `config/config.json` (R9)

**Files:**
- Create: `config/config.json` (nested `harness.versions`; content below)
- Delete: `harness-versions.json`
- Modify: `src/registry/versions.ts` (path + nested read)
- Modify: `test/tools/manifest.ts` (config candidates + nested read)
- Modify: `test/flake.nix` (`../config/config.json` + `cfg.harness.versions`)
- Modify: `package.json` (`files` array)

**Interfaces:**
- Consumes: the flat `harness-versions.json` entries (to nest them verbatim).
- Produces: `config/config.json` with shape `{ harness: { versions: { <id>: HarnessVersionEntry } } }`; `loadVersionsManifest()` and `loadManifest()` both now read `harness.versions`. The flake binds `versions = cfg.harness.versions`.

- [ ] **Step 1: Create the nested manifest and remove the old one**

Create `config/config.json` (verbatim values from the current `harness-versions.json`, nested under `harness.versions`):

```json
{
  "harness": {
    "versions": {
      "claude-code": {
        "displayName": "Claude Code",
        "version": "2.1.272",
        "verifiedDate": "2026-09-15",
        "install": { "method": "npm", "package": "@anthropic-ai/claude-code" }
      },
      "cursor": {
        "displayName": "Cursor",
        "version": "3.x",
        "verifiedDate": "2026-09-10",
        "install": { "method": "fhs-wrapper", "url": "https://cursor.com/install" }
      },
      "opencode": {
        "displayName": "OpenCode",
        "version": "1.18.31",
        "verifiedDate": "2026-09-14",
        "install": { "method": "npm", "package": "opencode-ai" }
      },
      "codex": {
        "displayName": "Codex",
        "version": "0.153.2",
        "verifiedDate": "2026-09-03",
        "install": { "method": "npm", "package": "@openai/codex" }
      },
      "hermes": {
        "displayName": "Hermes",
        "version": "0.21.2",
        "verifiedDate": "2026-09-11",
        "install": { "method": "npm", "package": "hermes-agent" }
      },
      "pi": {
        "displayName": "Pi",
        "version": "0.85.0",
        "verifiedDate": "2026-09-04",
        "install": { "method": "npm", "package": "@mariozechner/pi-coding-agent" }
      },
      "deepseek": {
        "displayName": "DeepSeek Harness",
        "version": "0.1.5-rc.1",
        "verifiedDate": "2026-09-10",
        "install": { "method": "npm", "package": "@deepseek-ai/dsh" }
      }
    }
  }
}
```

Then:

```bash
git rm harness-versions.json
```

- [ ] **Step 2: Update `src/registry/versions.ts`**

Replace the `MANIFEST_PATH` constant and `loadVersionsManifest()` body. The full file becomes:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_HARNESS_IDS, type HarnessId } from '../harnesses';

export interface HarnessInstallManifest {
  method: 'npm' | 'fhs-wrapper';
  package?: string;
  url?: string;
}

export interface HarnessVersionEntry {
  displayName: string;
  version: string;
  verifiedDate: string;
  install: HarnessInstallManifest;
}

// Compiled to dist/registry/versions.js (__dirname = dist/registry) and run
// from src/registry under vitest; both are two levels below the repo root,
// where config/config.json ships (via the "files" array).
const MANIFEST_PATH = join(__dirname, '..', '..', 'config', 'config.json');

interface ManifestShape {
  harness: { versions: Record<string, HarnessVersionEntry> };
}

export function loadVersionsManifest(): Record<HarnessId, HarnessVersionEntry> {
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ManifestShape;
  const versions = raw.harness.versions;
  for (const id of ALL_HARNESS_IDS) {
    if (!(id in versions)) throw new Error(`config/config.json is missing an entry for "${id}"`);
  }
  return versions as Record<HarnessId, HarnessVersionEntry>;
}
```

Note: `src/registry/data.ts`, `src/registry/index.ts`, `src/registry/types.ts` are unchanged — they consume `loadVersionsManifest()`'s return value, whose shape is identical.

- [ ] **Step 3: Update `test/tools/manifest.ts`**

Replace the candidate list and `loadManifest()`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface HarnessManifestEntry {
  displayName: string;
  version: string;
  verifiedDate: string;
  install: { method: string; package?: string; url?: string };
}

// test/tools/ code runs from two layouts: source under vitest (__dirname =
// <repo>/test/tools) and compiled via build:tools (__dirname =
// <repo>/test/tools/dist). The config sits at the repo root
// (<repo>/config/config.json), so probe candidates in order and use the first
// that exists.
const MANIFEST_CANDIDATES = [
  join(__dirname, '..', '..', 'config', 'config.json'),       // source: test/tools → repo root
  join(__dirname, '..', '..', '..', 'config', 'config.json'), // compiled: test/tools/dist → repo root
];

const MANIFEST_PATH =
  MANIFEST_CANDIDATES.find((p) => existsSync(p)) ?? MANIFEST_CANDIDATES[MANIFEST_CANDIDATES.length - 1];

interface ManifestShape {
  harness: { versions: Record<string, HarnessManifestEntry> };
}

export function loadManifest(): Record<string, HarnessManifestEntry> {
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ManifestShape;
  return raw.harness.versions;
}
```

- [ ] **Step 4: Update `test/flake.nix` to the nested config**

Replace the manifest comment + read lines:

```nix
      # config/config.json (repo root) is the single source of truth for
      # pinned harness versions — nested under `harness.versions`.
      cfg = builtins.fromJSON (builtins.readFile ../config/config.json);
      versions = cfg.harness.versions;
```

(The `mkNpmHarness` calls already reference `versions."claude-code".version` etc., which continue to resolve through the new `versions` binding.)

- [ ] **Step 5: Update `package.json` `files` array**

```json
"files": ["dist", "config/config.json"],
```

- [ ] **Step 6: Verify**

Run:

```bash
npx vitest run
npm run typecheck
npm run build:tools
node test/tools/detect.mjs
nix-instantiate --parse test/flake.nix
git status
```

Expected: `src/registry/versions.test.ts` and `src/registry/index.test.ts` pass (they read through `loadVersionsManifest()` — no path literals). `detect.mjs` still prints the 7-harness table from the nested manifest. `nix-instantiate --parse test/flake.nix` parses. `git status` shows `config/config.json` added and `harness-versions.json` deleted.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: relocate manifest to config/config.json (nested harness.versions)"
```