### Task 2: Specific finding-id renames (R10)

**Files:**
- Modify: `src/doctor/rules/clobberRisk.ts`, `configValidity.ts`, `skillShape.ts`, `skillFrontmatter.ts`, `generatedFileDrift.ts`
- Modify: `src/commands/enable.ts`, `src/cli.ts`, `src/commands/migrate.ts`, `src/wiring/migrateSymlink.ts` (comment only)
- Test: `src/doctor/rules/generatedFileDrift.test.ts`, `src/commands/enable.test.ts`, `src/doctor/rules/clobberRisk.test.ts`, `src/doctor/rules/configValidity.test.ts`, `src/doctor/rules/skillShape.test.ts`, `src/doctor/rules/skillFrontmatter.test.ts`

**Interfaces:**
- Produces: finding `ruleId` values `claude-md-clobber`, `claude-skills-clobber`, `config-ambiguous`, `config-parse-error`, `config-invalid-shape`, `config-unknown-harness-id`, `skill-flat-file`, `skill-missing-skill-md`, `skill-missing-name`, `skill-invalid-name-format`, `skill-name-mismatch`, `skill-missing-description`, `skill-description-length`, `claude-drift`. Rule `id` values unchanged. `enable.ts` drift check now matches `'claude-drift'`.

- [ ] **Step 1: Update the two tests that already assert ruleId strings (RED)**

In `src/doctor/rules/generatedFileDrift.test.ts`, change the assertion:

```ts
expect.objectContaining({ ruleId: 'claude-drift', severity: 'warning', harnessId: 'claude-code' }),
```

In `src/commands/enable.test.ts`, change both `blockingFindings[0].ruleId` assertions from `'clobber-risk'` to `'claude-md-clobber'` (the "hand-written CLAUDE.md without --force" test and the "does not clobber a foreign file on drift-repair" test).

- [ ] **Step 2: Add specific-ruleId assertions to the rule tests (RED)**

In `src/doctor/rules/clobberRisk.test.ts`, add to the "flags a hand-written CLAUDE.md" test:

```ts
expect(findings.some((f) => f.ruleId === 'claude-md-clobber')).toBe(true);
```

and to the "flags a .claude/skills symlink pointing elsewhere" test:

```ts
expect(findings.some((f) => f.ruleId === 'claude-skills-clobber')).toBe(true);
```

In `src/doctor/rules/configValidity.test.ts`, add per-case ruleId assertions:
- unknown ids → `config-unknown-harness-id`
- ambiguous → `config-ambiguous`
- parse error → `config-parse-error`
- invalid shape → `config-invalid-shape`

In `src/doctor/rules/skillShape.test.ts`, assert the flat-file case emits `skill-flat-file` and the missing-SKILL.md case emits `skill-missing-skill-md`.

In `src/doctor/rules/skillFrontmatter.test.ts`, assert the name/dir mismatch case emits `skill-name-mismatch`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/doctor/rules src/commands/enable.test.ts`
Expected: FAIL — source still emits the old `ruleId` strings.

- [ ] **Step 4: Apply the renames in the rule source**

`clobberRisk.ts`: agents-doc branch → `ruleId: 'claude-md-clobber'`; skills branch → `ruleId: 'claude-skills-clobber'`.

`configValidity.ts`: map the four branches to `config-ambiguous`, `config-parse-error`, `config-invalid-shape`, `config-unknown-harness-id` (respectively: the `ambiguous` case, `parse-error` case, `invalid-shape` case, and the `ok`-with-`unknownIds` case).

`skillShape.ts`: flat-file branch → `ruleId: 'skill-flat-file'`; missing-SKILL.md branch → `ruleId: 'skill-missing-skill-md'`.

`skillFrontmatter.ts`: add a code→ruleId map and set `ruleId` from `issue.code`:

```ts
const CODE_TO_RULE_ID: Record<string, string> = {
  'missing-name': 'skill-missing-name',
  'invalid-name-format': 'skill-invalid-name-format',
  'name-mismatch': 'skill-name-mismatch',
  'missing-description': 'skill-missing-description',
  'description-length': 'skill-description-length',
};

// inside the loop, replace the literal with:
ruleId: CODE_TO_RULE_ID[issue.code] ?? 'skill-frontmatter',
```

`generatedFileDrift.ts`: `ruleId: 'generated-file-drift'` → `'claude-drift'`.

- [ ] **Step 5: Update the string-match consumers**

`src/commands/enable.ts` (drift check):

```ts
const drifted = harnessFindings.some((f) => f.ruleId === 'claude-drift' && f.severity === 'warning');
```

`src/cli.ts` (`--force` help text):

```ts
.option('--force', 'overwrite clobber findings (CLAUDE.md, .claude/skills symlink target)')
```

`src/commands/migrate.ts` (error prose): change `clobber-risk — refusing to adopt invalid skill(s)` to `invalid skill — refusing to adopt invalid skill(s)`.

`src/wiring/migrateSymlink.ts`: update the doc comment listing `(clobber-risk, …)` to `(claude-md-clobber, claude-skills-clobber, …)`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS (full suite — the renames touch rule ids used across `enable`/`migrate` tests).

- [ ] **Step 7: Commit**

```bash
git add src/doctor src/commands src/wiring src/cli.ts
git commit -m "refactor: rename finding ruleIds to be failure-specific"
```

---

