### Task 2: Relocate the Nix flake to `test/` (R2)

**Files:**
- Move: `flake.nix` → `test/flake.nix`, `flake.lock` → `test/flake.lock`
- Modify: `test/flake.nix` (`readFile` path + description/prose; still flat manifest until Task 3)

**Interfaces:**
- Consumes: repo-root `harness-versions.json` (flat) — for this task only.
- Produces: `test/flake.nix` with `versions` bound from a `readFile` that resolves relative to `test/`. Later tasks switch it to `../config/config.json` + `cfg.harness.versions`.

- [ ] **Step 1: Move the flake and its lock**

```bash
git mv flake.nix test/flake.nix
git mv flake.lock test/flake.lock
```

- [ ] **Step 2: Repoint the manifest read and prose**

Edit `test/flake.nix`. Change the `description`, the manifest comment/read, and the `shellHook` echo. Specifically:

```nix
  description = "harness-hub test environment shell";
```

and in the `let` block:

```nix
      # harness-versions.json (repo root) is the single source of truth for
      # pinned harness versions — see spec R10.
      versions = builtins.fromJSON (builtins.readFile ../harness-versions.json);
```

and in `shellHook`:

```nix
          echo "harness-hub test shell — run \`detect\` to see the pinned harnesses."
```

Leave everything else — `mkNpmHarness`, `cursorFhs`, the six `mkNpmHarness` calls, and the trailing `# HASH FILL` comment — unchanged.

- [ ] **Step 3: Verify the flake parses and resolves its manifest read**

Run (best-effort; nix must be available):

```bash
nix-instantiate --parse test/flake.nix
nix eval --impure --raw --expr 'let f = builtins.fromJSON (builtins.readFile ./harness-versions.json); in builtins.isAttrs f' 
```

Expected: `nix-instantiate --parse` prints no error (parses OK). The second command confirms the manifest still parses as an object (it is unchanged at this point). A full `nix develop --flake ./test` will not enter until hashes are filled (known-pending) — do **not** attempt the hash-fill loop; note the parse-only verification in the report.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move flake.nix and flake.lock to test/"
```