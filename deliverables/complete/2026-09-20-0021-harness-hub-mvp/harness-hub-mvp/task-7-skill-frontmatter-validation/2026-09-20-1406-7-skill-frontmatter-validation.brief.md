## Task 7: Skill frontmatter validation

**Files:**
- Create: `src/skills/validate.ts`
- Test: `src/skills/validate.test.ts`

**Interfaces:**
- Produces: `FrontmatterIssue`, `validateSkillFrontmatter(dirName: string, frontmatter: Record<string, unknown> | undefined): FrontmatterIssue[]`.

This implements spec §7's required-fields contract exactly: `name` (1–64 chars, lowercase `a-z0-9-`, no leading/trailing/consecutive hyphens, must equal the directory name) and `description` (1–1024 chars, non-empty).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/skills/validate.test.ts
import { describe, it, expect } from 'vitest';
import { validateSkillFrontmatter } from './validate';

describe('validateSkillFrontmatter', () => {
  it('passes a valid skill', () => {
    const issues = validateSkillFrontmatter('writing-tests', {
      name: 'writing-tests',
      description: 'How to write tests.',
    });
    expect(issues).toEqual([]);
  });

  it('flags a missing name', () => {
    const issues = validateSkillFrontmatter('writing-tests', { description: 'x' });
    expect(issues.map((i) => i.code)).toContain('missing-name');
  });

  it('flags an invalid name format (uppercase)', () => {
    const issues = validateSkillFrontmatter('Writing-Tests', { name: 'Writing-Tests', description: 'x' });
    expect(issues.map((i) => i.code)).toContain('invalid-name-format');
  });

  it('flags consecutive hyphens', () => {
    const issues = validateSkillFrontmatter('writing--tests', { name: 'writing--tests', description: 'x' });
    expect(issues.map((i) => i.code)).toContain('invalid-name-format');
  });

  it('flags a name that does not match its directory', () => {
    const issues = validateSkillFrontmatter('writing-tests', { name: 'other-name', description: 'x' });
    expect(issues.map((i) => i.code)).toContain('name-mismatch');
  });

  it('flags a missing description', () => {
    const issues = validateSkillFrontmatter('writing-tests', { name: 'writing-tests' });
    expect(issues.map((i) => i.code)).toContain('missing-description');
  });

  it('flags a description over 1024 chars', () => {
    const issues = validateSkillFrontmatter('writing-tests', {
      name: 'writing-tests',
      description: 'x'.repeat(1025),
    });
    expect(issues.map((i) => i.code)).toContain('description-length');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/skills/validate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/skills/validate.ts
export interface FrontmatterIssue {
  code:
    | 'missing-name'
    | 'invalid-name-format'
    | 'name-mismatch'
    | 'missing-description'
    | 'description-length';
  message: string;
}

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function validateSkillFrontmatter(
  dirName: string,
  frontmatter: Record<string, unknown> | undefined
): FrontmatterIssue[] {
  const issues: FrontmatterIssue[] = [];
  const name = frontmatter?.['name'];
  const description = frontmatter?.['description'];

  if (typeof name !== 'string' || name.length === 0) {
    issues.push({ code: 'missing-name', message: `Skill "${dirName}": frontmatter "name" is missing or empty.` });
  } else {
    if (name.length > 64 || !NAME_PATTERN.test(name)) {
      issues.push({
        code: 'invalid-name-format',
        message: `Skill "${dirName}": "name" must be 1-64 chars, lowercase a-z0-9 and single hyphens, no leading/trailing/consecutive hyphens (got "${name}").`,
      });
    }
    if (name !== dirName) {
      issues.push({
        code: 'name-mismatch',
        message: `Skill "${dirName}": frontmatter "name" ("${name}") must equal the parent directory name.`,
      });
    }
  }

  if (typeof description !== 'string' || description.length === 0) {
    issues.push({
      code: 'missing-description',
      message: `Skill "${dirName}": frontmatter "description" is missing or empty.`,
    });
  } else if (description.length > 1024) {
    issues.push({
      code: 'description-length',
      message: `Skill "${dirName}": "description" must be 1-1024 chars (got ${description.length}).`,
    });
  }

  return issues;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/skills/validate.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/skills/validate.ts src/skills/validate.test.ts
git commit -m "feat: skill frontmatter validation per spec §7"
```

---

