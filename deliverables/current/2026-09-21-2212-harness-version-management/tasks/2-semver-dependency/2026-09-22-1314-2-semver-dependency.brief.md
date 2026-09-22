### Task 2: Add the `semver` dependency

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `semver` and `@types/semver` available to `src/`.

- [ ] **Step 1: Install**

Run:

```bash
npm install semver@^7.6.0
npm install -D @types/semver@^7.5.0
```

- [ ] **Step 2: Verify resolution**

Run: `node -e "const s = require('semver'); console.log(s.gte('0.155.1','0.139.0'), s.lt('0.155.1','0.155.0'))"`
Expected: `true false`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add semver dependency for version-range matching"
```

---

