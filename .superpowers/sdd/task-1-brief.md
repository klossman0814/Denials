### Task 1: Fix Test Infrastructure — Replace chai with Jest across all test files

**Files:**
- Modify: `tests/edi837.parser.test.js` (all lines)
- Modify: `tests/edi835.parser.test.js` (chai import line only)
- Modify: `tests/claims.test.js` (chai import line only)
- Modify: `tests/dashboard.test.js` (chai import line only)
- Modify: `tests/auth.test.js` (chai import line only)
- Modify: `tests/upload.test.js` (chai import line only)
- Modify: `package.json` (remove chai from devDependencies)

**Interfaces:**
- Consumes: None
- Produces: All tests use Jest native `expect`, chai package removed

- [ ] **Step 1: Replace chai in edi837.parser.test.js**

Current:
```js
const { expect } = require('chai');
```
Replace with:
```js
// chai removed — using Jest native expect
```

Tests use `expect(actual).to.equal(expected)` — replace with `expect(actual).toBe(expected)`. Replace `.to.be.closeTo(a, b)` with `.toBeCloseTo(a, b)`. Replace `.to.have.lengthOf(n)` with `.toHaveLength(n)`.

- [ ] **Step 2: Replace chai in edi835.parser.test.js**

Same change as step 1 — replace chai import with Jest native `expect`.

- [ ] **Step 3: Replace chai in claims.test.js, dashboard.test.js, auth.test.js, upload.test.js**

Same change — find `const { expect } = require('chai')` and replace with Jest native usage. Replace all chai assertions with Jest equivalents:
- `to.equal(x)` → `toBe(x)`
- `to.have.lengthOf(x)` → `toHaveLength(x)`
- `to.be.closeTo(x, p)` → `toBeCloseTo(x, p)`
- `to.be.true` → `toBe(true)`
- `to.be.null` → `toBeNull()`
- `to.deep.equal(x)` → `toEqual(x)`
- `to.include(x)` → `toContain(x)`
- `to.be.above(x)` → `toBeGreaterThan(x)`
- `to.be.below(x)` → `toBeLessThan(x)`
- `to.throw()` → `toThrow()`
- `to.exist` → `toBeDefined()`
- `to.be.ok` → `toBeTruthy()`
- `to.have.property(x)` → `toHaveProperty(x)`

- [ ] **Step 4: Remove chai from package.json and rebuild**

```bash
npm uninstall chai
npm install
```

- [ ] **Step 5: Verify all tests pass (will fail due to pending implementation — verify tests RUN, not that assertions pass)**

Run: `npx jest --forceExit --detectOpenHandles 2>&1`

Expected: No "unexpected token 'export'" errors. Tests may fail on assertions but must not fail on chai import.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix: replace chai with Jest native expect across all test files"
```

---


