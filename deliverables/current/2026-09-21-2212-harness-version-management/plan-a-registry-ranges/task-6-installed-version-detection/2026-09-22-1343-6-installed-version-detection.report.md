# Task 6 Report: Installed-version detection in the product surface

**Status:** DONE_WITH_CONCERNS
**Commit:** `2f1c8d7` — `feat: add installed-version detection to the product surface`
**Files created:** `src/harnessDetect.ts`, `src/harnessDetect.test.ts` (only these two changed; tree otherwise clean apart from the pre-existing untracked `deliverables/`)

## What was implemented

Per the task-6 brief:

- `BINARY_CANDIDATES` map covering all 8 `HarnessId`s: `claude-code: ['claude']`, `cursor: []` (IDE surface, no headless probe), `cursor-cli: ['agent', ~/.cursor/bin/agent, ~/.local/bin/agent]`, `opencode/codex/hermes/pi` by their own names, `deepseek: ['dsh']`.
- `which(bin)` via `spawnSync('sh', ['-c', 'command -v ...'])`.
- `resolveBinary(id)` — homedir-absolute candidates checked with `existsSync`, bare names via `which`; `null` when nothing found.
- `VersionRunner` type, `runVersion(id)` (runs `<binary> --version`, 15000 ms timeout, returns null on `r.error || r.status !== 0`, first trimmed line), `detectWith(runner)`, `detectInstalledVersions()`.
- `src/harnessDetect.test.ts` — the brief's two tests, both via `detectWith` with an injected runner; no real subprocess in tests.

## TDD evidence

1. **RED:** test written first; `npx vitest run src/harnessDetect.test.ts` failed with
   `Error: Cannot find module './harnessDetect' imported from src/harnessDetect.test.ts` (1 failed suite, no tests).
2. Implementation written.
3. **GREEN:** `npx vitest run src/harnessDetect.test.ts` → 1 file passed, **2/2 tests passed**.

## Verification

- `npx vitest run src/harnesses.test.ts src/registry/resolve.test.ts` → 2 files, **8/8 tests passed** (no regression in neighbors).
- `npm run typecheck` → clean (`tsc -p tsconfig.json --noEmit`, no output).
- Commit contains exactly the two files (76 insertions). Working tree clean afterwards (only pre-existing untracked `deliverables/current/`).

## Deviation from the brief (one-line fix, root-caused)

The brief's Step 1 test and Step 2 implementation are mutually inconsistent as written:

- The test (`detectWith((id) => (id === 'codex' ? '0.155.1\n' : null))`, expects `rows.codex === '0.155.1'`) requires `detectWith` to **normalize** runner output (test name literally says "…and normalizes output").
- The brief's verbatim `detectWith` stores the runner's raw return value (`Object.fromEntries(ALL_HARNESS_IDS.map((id) => [id, runner(id)]))`), which returns `'0.155.1\n'` and fails the verbatim test (first post-implementation run: 1 failed / 1 passed with `expected '0.155.1\n' to be '0.155.1'`).

Resolution (TDD: the failing test is the contract): kept the test byte-verbatim, made the minimal change to `detectWith` — normalize each runner result to its first trimmed line, `null` if empty:

```ts
const raw = runner(id);
const first = (raw ?? '').split('\n')[0].trim();
return [id, first || null];
```

Semantics match `runVersion`'s own output shaping, so `detectInstalledVersions()` behaves identically to the brief's intent, and the wrapper is idempotent for already-normalized values. Everything else in `harnessDetect.ts` is verbatim from the brief.

## Self-review checklist

- [x] BINARY_CANDIDATES exactly as brief (cursor empty; cursor-cli three candidates: `agent`, `~/.cursor/bin/agent`, `~/.local/bin/agent`; deepseek `dsh`) — verified.
- [x] `detectWith` covers all 8 ids in both tests; runner injected; no real spawns in tests — verified.
- [x] `runVersion`: timeout 15000, `r.error || r.status !== 0` status check, first trimmed line — verified verbatim.
- [x] Only the two allowed files changed.

## Concerns

1. The brief-internal inconsistency described above (test demands normalization; verbatim implementation doesn't normalize). Fixed minimally in `detectWith` as documented; flagging so the controller knows the shipped `detectWith` differs from the brief's literal code by those three lines.
2. None otherwise. Known pre-existing red `src/commands/list.test.ts` was not touched (expected until Task 7) and `list.ts` is unaffected by this change.