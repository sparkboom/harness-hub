### Task 9: playground folder + scripts + setup (R6, R9)

**Files:**
- Create: `playground/package.json`, `playground/setup.sh`
- Modify: `.gitignore` (verify `playground/` is present — it already is)

**Interfaces:**
- Consumes: `tools/generate.mjs`, `tools/detect.mjs`, `tools/probe.mjs` (Tasks 5–7), `flake.nix` (Task 8).
- Produces: a working playground with npm scripts and a nested-git setup.

- [ ] **Step 1: Write the playground `package.json`**

Create `playground/package.json`:

```json
{
  "name": "harness-hub-playground",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "setup": "sh setup.sh",
    "generate": "node ../tools/generate.mjs",
    "scenario": "node ../tools/generate.mjs",
    "detect": "node ../tools/detect.mjs",
    "probe": "node ../tools/probe.mjs",
    "reset": "git clean -fdX .",
    "shell": "nix develop"
  }
}
```

- [ ] **Step 2: Write the setup script (nested git + CLI link, R9 shell check)**

Create `playground/setup.sh`:

```bash
#!/bin/sh
set -eu

# 1. Nested git — the playground must be its own consumer repo (spec: findRepoRoot).
if [ ! -d .git ]; then
  git init >/dev/null
  echo "playground: initialized nested git repo"
fi

# 2. Link the harness-hub CLI.
if ! command -v harness-hub >/dev/null 2>&1; then
  (cd .. && npm link) >/dev/null
fi
echo "playground: harness-hub CLI available at: $(command -v harness-hub)"

# 3. R9 — refuse harness observation outside the pinned shell.
if [ -z "${IN_NIX_SHELL:-}" ]; then
  echo "playground: WARNING — not in \`nix develop\`. Harness-observing commands"
  echo "  (probe, enable, doctor) may see unpinned harnesses. Run: npm run shell"
fi

echo "playground: ready. Try \`npm run generate -- baseline\`, then \`harness-hub doctor\`."
```

Make it executable: `chmod +x playground/setup.sh`.

- [ ] **Step 3: Build tools and smoke-test the full loop manually**

Run:

```bash
npm run build:tools
cd playground
npm run setup
npm run generate -- baseline
harness-hub doctor
npm run detect
```

Expected: `generate` writes `AGENTS.md` + `.agents/skills/writing-tests/SKILL.md`; `harness-hub doctor` resolves the playground as its own repo and reports no issues for `baseline`; `detect` prints the 7-harness table. (If run outside `nix develop`, `detect` reflects host installs — that's the documented R9 warning, not a failure.)

- [ ] **Step 4: Verify nothing in `playground/` is tracked**

Run: `cd .. && git status --short`
Expected: no `playground/` paths appear (only the tracked `playground/package.json`? — no: `playground/` is git-ignored entirely, so `playground/package.json` and `setup.sh` are **not** committed by the outer repo; they are documentation of the playground's own internal state). Confirm `git status` shows no `playground/` entries.

- [ ] **Step 5: Commit the tracked changes**

Because `playground/` is git-ignored, the only tracked artifacts from this task are none under `playground/`. If the plan wants the playground skeleton reproducible, its `package.json`/`setup.sh` live as *content the spec documents* rather than committed files. No commit needed here beyond verifying Tasks 1–8 are committed.

```bash
git status --short
# expect: only earlier tasks' files, nothing under playground/
```

---

## Self-Review

**Spec coverage:**
- R1 manifest + registry derivation → Task 1.
- R2/R2a/R2b generator, primitives, naming → Tasks 4–5.
- R3 detection → Task 6. R4 probe → Task 7.
- R5 flake → Task 8. R6 playground + scripts → Task 9.
- R7 nothing committed → Task 9 Step 4 + `.gitignore`.
- R8 `list`/`info` → Task 3.
- R9 nix-shell prerequisite (playground/tests only) → Task 9 `setup.sh` warning.
- R10 renames → Task 2.

**Placeholder scan:** No TBD/TODO. The two "first cut + loop" spots (flake hashes, hermes/pi/deepseek probe invocations) are concrete implementations with an explicit verification step, matching the spec's provisional framing for those items.

**Type consistency:** `Asset` is defined once (Task 4) and consumed by scenarios/generator (Task 5). `Scenario.assets(target): Asset[]` matches `writeAssets(target, Asset[])`. `loadManifest` (tools) and `loadVersionsManifest` (runtime) are deliberately separate but same-shape; `detect`/`probe` consume `loadManifest`/`resolveBinary` from `tools/manifest.ts` and `tools/detect.ts`. `ProbeSpec`/`ProbeRunner` signatures match between `probe.ts` and `probe.test.ts`.
