### Task 7: R7 observation ownership (probe text) + references sweep + full verification

**Files:**
- Modify: `test/tools/probe.ts` (`warnIfUnpinned` banner text)

**Interfaces:**
- Consumes: nothing.
- Produces: an updated probe banner referencing the relocated shell entrypoint (`env shell`).

- [ ] **Step 1: Update the probe R9/R7 banner**

Edit `test/tools/probe.ts` — replace the `warnIfUnpinned` message string:

```ts
    stderr(
      'probe: WARNING — not running inside `nix develop`. Observing the unpinned host environment (R9). Run `env shell` (or an env\'s `npm run shell`) for pinned harnesses.'
    );
```

(`warnIfUnpinned()` stays warn-and-continue — no refusal, matching the prior deliverable's final ruling. `tools/probe.test.ts` does not assert the banner text, so it is unaffected.)

- [ ] **Step 2: Sweep for stale references**

Run and confirm only expected matches remain (no path-literal fixes needed beyond what Tasks 1–3 already changed):

```bash
rg -n "tools/generate|tools/detect|tools/probe|harness-versions\.json|flake\.nix" --glob '!node_modules/**' --glob '!deliverables/**'
```

Expected: no matches in committed source (the `deliverables/**` historical docs are intentionally excluded; `AGENTS.md`, `README.md`, and `.cursor/rules/` contain no `flake.nix`-at-root or `tools/` prose to fix). If a match appears in a tracked non-deliverable file, fix it in this step.

- [ ] **Step 3: Full verification (success criteria 1–7)**

Run:

```bash
npx vitest run
npm run typecheck
npm run build:tools
node test/tools/env.mjs create playground
node test/tools/env.mjs ls
node test/tools/env.mjs generate playground baseline
node test/tools/detect.mjs
node test/tools/probe.mjs claude-code
node test/tools/env.mjs rm playground --yes
nix-instantiate --parse test/flake.nix
git status
```

Expected, mapped to the spec's success criteria:
1. `test/` contains `flake.nix`, `flake.lock`, `tools/`, `template/`, `env/` (env is created then removed; the dir may be absent when empty — that is fine, it is constructed on demand).
2. `build:tools` emits `test/tools/dist/` and the `.mjs` shims resolve it (smoke commands above exit 0).
3. `env create playground` produces `test/env/playground/` with nested `.git`, `package.json`/`AGENTS.md`, linked `harness-hub`, R9 gate respected; `git status` shows **no** `test/env/` entries.
4. `env create foo && env generate <scenario>` + `detect` + `probe` work from outside `test/tools` (cwd-independent).
5. `nix-instantiate --parse test/flake.nix` parses; `env shell` / `nix develop --flake ./test` resolves `../config/config.json` (verified at eval; full shell entry remains pending on HASH FILL — note this in the report).
6. `npx vitest run`, `npm run typecheck`, `npm run build:tools` are all green.
7. `git status` is clean (the old `playground/` is already deleted in Task 4).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: probe R7 banner references env shell; final restructure verification"
```