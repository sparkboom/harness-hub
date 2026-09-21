### Task 4: Committed scaffold `test/template/` + ignore boundaries (R1, R4)

**Files:**
- Create: `test/template/package.json`
- Create: `test/template/AGENTS.md`
- Create: `test/tools/template.test.ts`
- Modify: `.gitignore` (remove `playground/`, add `test/env/**`)

**Interfaces:**
- Consumes: the relocated tools (Task 1) — the template's npm scripts point at `../../tools/*.mjs`; the flake (Task 2) — the `shell` script points at `../../`.
- Produces: `test/template/` (committed static scaffold, no setup script). `env.ts` (Task 5) copies + templating these files.

- [ ] **Step 1: Write the scaffold `package.json`**

Create `test/template/package.json` (corrected paths, one level deeper than the old `playground/`, and **no** `setup` script):

```json
{
  "name": "harness-hub-env-playground",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "generate": "node ../../tools/generate.mjs",
    "scenario": "node ../../tools/generate.mjs",
    "detect": "node ../../tools/detect.mjs",
    "probe": "node ../../tools/probe.mjs",
    "env": "node ../../tools/env.mjs",
    "reset": "git clean -fdX .",
    "shell": "nix develop --flake ../../"
  }
}
```

- [ ] **Step 2: Write the scaffold `AGENTS.md`**

Create `test/template/AGENTS.md` (identical content to the old `playground/AGENTS.md`):

```markdown
# Agents

Minimal consumer-repo agent doc for harness-hub testing.
```

- [ ] **Step 3: Lock the corrected paths with a test**

Create `test/tools/template.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('test/template scaffold', () => {
  it('uses corrected ../../ tool paths and drops the setup script', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'template', 'package.json'), 'utf8')) as {
      name: string;
      scripts: Record<string, string>;
    };
    expect(pkg.name).toBe('harness-hub-env-playground');
    expect(pkg.scripts.generate).toBe('node ../../tools/generate.mjs');
    expect(pkg.scripts.detect).toBe('node ../../tools/detect.mjs');
    expect(pkg.scripts.probe).toBe('node ../../tools/probe.mjs');
    expect(pkg.scripts.env).toBe('node ../../tools/env.mjs');
    expect(pkg.scripts.shell).toBe('nix develop --flake ../../');
    expect(pkg.scripts.setup).toBeUndefined();
  });

  it('ships a minimal AGENTS.md', () => {
    const md = readFileSync(join(__dirname, '..', 'template', 'AGENTS.md'), 'utf8');
    expect(md).toContain('# Agents');
  });
});
```

- [ ] **Step 4: Update `.gitignore` and remove the stale playground**

Edit `.gitignore`: remove the `playground/` line, add `test/env/**`. Result:

```
.cursor
dist/
node_modules/
test/env/**
test/tools/dist/
```

Then delete the stale, git-ignored `playground/` directory (it holds only the scrapped scaffold + a nested `.git`, all outside version control):

```bash
rm -rf playground
```

- [ ] **Step 5: Verify**

Run:

```bash
npx vitest run
git status
```

Expected: the new `template.test.ts` passes; `git status` shows `test/template/` tracked and **no** `test/env/` or `playground/` entries (confirm `playground/` is gone from disk and `.gitignore`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: committed test/template scaffold and tightened gitignore boundaries"
```