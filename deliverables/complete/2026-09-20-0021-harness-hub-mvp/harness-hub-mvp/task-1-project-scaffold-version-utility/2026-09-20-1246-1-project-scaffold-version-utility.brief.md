## Task 1: Project scaffold + version utility

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore` (append `dist/`, `node_modules/` — the existing repo `.gitignore` is otherwise untouched)
- Create: `src/version.ts`
- Test: `src/version.test.ts`

**Interfaces:**
- Produces: `getPackageVersion(): string` — used by Task 23's CLI `--version` wiring.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "harness-hub",
  "version": "0.1.0",
  "description": "Make a repo harness-agnostic: wire AGENTS.md and .agents/skills/ into whichever coding harnesses you enable.",
  "license": "MIT",
  "bin": {
    "harness-hub": "dist/bin.js"
  },
  "engines": {
    "node": ">=18"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "commander": "^15.0.0",
    "gray-matter": "^4.0.3",
    "yaml": "^2.9.1"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^7.0.2",
    "vitest": "^5.0.1"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts", "dist", "node_modules"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Append build artifacts to `.gitignore`**

Add to the existing `.gitignore`:

```
dist/
node_modules/
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: `package-lock.json` created, `node_modules/` populated, no errors.

- [ ] **Step 6: Write the failing test for `getPackageVersion`**

```typescript
// src/version.test.ts
import { describe, it, expect } from 'vitest';
import { getPackageVersion } from './version';

describe('getPackageVersion', () => {
  it('returns the version string from package.json', () => {
    const version = getPackageVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run src/version.test.ts`
Expected: FAIL — `Cannot find module './version'`.

- [ ] **Step 8: Implement `getPackageVersion`**

```typescript
// src/version.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function getPackageVersion(): string {
  const pkgPath = join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
  return pkg.version;
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run src/version.test.ts`
Expected: PASS.

- [ ] **Step 10: Verify the build toolchain compiles**

Run: `npm run build`
Expected: `dist/version.js` created, no errors.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore src/version.ts src/version.test.ts
git commit -m "chore: project scaffold (TS/vitest/tsc) + getPackageVersion"
```

---

