### Task 1: Relocate `tools/` → `test/tools/` (R6)

**Files:**
- Move: `tools/**` → `test/tools/**` (whole directory, via `git mv`)
- Modify: `package.json` (`build:tools` script)
- Modify: `test/tools/manifest.ts` (candidate list +1 level; still flat root `harness-versions.json` until Task 3)
- Modify: `.gitignore` (`tools/dist/` → `test/tools/dist/`)

**Interfaces:**
- Consumes: nothing (mechanical move).
- Produces: `test/tools/{generate,detect,probe,fs,manifest,primitives}.ts` + `.mjs` shims + `scenarios/`, compiled to `test/tools/dist/`. `loadManifest()` still returns the flat `Record<string, HarnessManifestEntry>` (Task 3 changes its internals).

- [ ] **Step 1: Move the directory and update the build script**

Run:

```bash
git mv tools test/tools
# The move leaves behind untracked git-ignored build output (tools/dist/). Remove it.
rm -rf tools
```

Edit `package.json` — change the single script:

```json
"build:tools": "tsc -p test/tools/tsconfig.json"
```

- [ ] **Step 2: Extend the manifest candidate list for the deeper location**

Edit `test/tools/manifest.ts` — replace the `MANIFEST_CANDIDATES` array (source layout `test/tools` now needs `../..`, compiled `test/tools/dist` needs `../../..`):

```ts
const MANIFEST_CANDIDATES = [
  join(__dirname, 'harness-versions.json'),
  join(__dirname, '..', 'harness-versions.json'),
  join(__dirname, '..', '..', 'harness-versions.json'),
  join(__dirname, '..', '..', '..', 'harness-versions.json'),
];
```

(The rest of `manifest.ts` — `loadManifest()` reading the flat map — is unchanged until Task 3.)

- [ ] **Step 3: Update `.gitignore` for the new dist location**

Edit `.gitignore`: remove the `tools/dist/` line, add `test/tools/dist/`. Result:

```
.cursor
dist/
node_modules/
playground/
test/tools/dist/
```

(`playground/` stays ignored until Task 4.)

- [ ] **Step 4: Verify the move is green**

Run:

```bash
npx vitest run
npm run build:tools
node test/tools/detect.mjs
node test/tools/generate.mjs baseline --target /tmp/hh-smoke-1
git status
```

Expected: full suite passes (tools tests discover `.ts` over `.mjs` via `vitest.config.mjs`'s `resolve.extensions` — unchanged; the `generate.mjs`/`generate.ts` comment remains valid with no path literal to fix). `build:tools` emits `test/tools/dist/*.js`; `detect.mjs` prints the 7-harness table (host-installed pins are the documented R9 host-truth case, not a failure); `generate.mjs` writes `AGENTS.md` + `writing-tests` skill into `/tmp/hh-smoke-1`; `git status` shows only the expected renames.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move tools/ to test/tools/ and repoint build + manifest candidates"
```