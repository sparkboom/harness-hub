{
  description = "harness-hub playground dev shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      system = "aarch64-darwin";
      pkgs = import nixpkgs { inherit system; };
      # harness-versions.json (repo root) is the single source of truth for
      # pinned harness versions — see spec R10.
      versions = builtins.fromJSON (builtins.readFile ./harness-versions.json);

      # Build an npm-distributed harness at its pinned version.
      # FIRST CUT: hashes are placeholders — filled by the one-run build loop
      # (see HASH FILL below). Some packages may ship prebuilt binaries that
      # buildNpmPackage mis-handles; if so, swap that call for a runCommand
      # that fetches the platform binary into $out/bin.
      mkNpmHarness = pname: version: pkgs.buildNpmPackage {
        inherit pname version;
        src = pkgs.fetchurl {
          url = "https://registry.npmjs.org/${pname}/-/${builtins.baseNameOf pname}-${version}.tgz";
          # lib.fakeHash (sha256-AAAA…) not fakeSha256: Nix >= 2.19 rejects the
          # bare-zeros hash at eval; fakeHash triggers the hash-mismatch error
          # that prints the real hash for the fill loop below.
          sha256 = pkgs.lib.fakeHash; # filled by `nix develop` first run (see Step 2)
        };
        npmDepsHash = pkgs.lib.fakeHash; # filled the same way
        dontNpmBuild = true;
      };

      # Cursor headless `agent` CLI via a Community FHS wrapper (spec R5/R9 —
      # provisional; if this proves unreliable, cursor is detection-only).
      cursorFhs = pkgs.buildFHSUserEnv {
        name = "cursor-agent-fhs";
        targetPkgs = _: with pkgs; [ curl cacert bash ];
        runScript = ''
          curl -fsSL https://cursor.com/install | bash
        '';
      };
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        buildInputs = with pkgs; [
          nodejs_22 git curl cacert
          (mkNpmHarness "@anthropic-ai/claude-code" versions."claude-code".version)
          (mkNpmHarness "opencode-ai" versions.opencode.version)
          (mkNpmHarness "@openai/codex" versions.codex.version)
          (mkNpmHarness "hermes-agent" versions.hermes.version)
          (mkNpmHarness "@mariozechner/pi-coding-agent" versions.pi.version)
          (mkNpmHarness "@deepseek-ai/dsh" versions.deepseek.version)
        ];
        shellHook = ''
          echo "harness-hub playground shell — run \`detect\` to see the pinned harnesses."
          if command -v agent >/dev/null 2>&1; then
            echo "cursor agent: $(command -v agent)"
          else
            echo "cursor agent: NOT INSTALLED (detection-only; see flake.nix cursorFhs)"
          fi
        '';
      };
    };
}

# HASH FILL (one-run procedure, best-effort — pending):
#   1. `nix develop` — nix fails each fetch reporting the expected sha256 /
#      npmDepsHash; paste each into the matching placeholder above.
#   2. Re-run `nix develop` until the shell enters.
#   3. If a package needs a prebuilt-binary treatment, replace its
#      mkNpmHarness call with a runCommand fetch and note it inline.
