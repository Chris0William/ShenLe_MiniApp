# Popup Login Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the normal login-page flow with a WeChat-compliant on-demand login popup flow that requires explicit agreement before calling WeChat login.

**Architecture:** Keep the existing auth store and backend login contract. Add a small centralized login flow utility, a reusable popup component mounted by pages that need login entry, and an agreement detail page for service/privacy text. Leave the old login page as a fallback but remove all implicit-agreement wording.

**Tech Stack:** uni-app + Vue 3 + Pinia + wot-design-uni + WeChat Mini Program APIs.

---

### Task 1: Add Compliance Guard Test

**Files:**
- Create: `scripts/check-login-compliance.mjs`

- [ ] **Step 1: Write failing compliance check**

Create a Node script that scans source files and fails while the old implicit consent copy and hard login-page redirects still exist.

```js
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = path => readFileSync(join(root, path), 'utf8')
const failures = []

const forbidden = [
  ['src/pages/common/login/index.vue', '登录即表示同意'],
  ['src/pages/admin/mine/index.vue', '微信授权登录'],
]

for (const [file, text] of forbidden) {
  if (read(file).includes(text))
    failures.push(`${file} still contains forbidden copy: ${text}`)
}

if (!existsSync(join(root, 'src/pages/common/agreement/index.vue')))
  failures.push('missing agreement detail page')

if (!existsSync(join(root, 'src/components/sl-login-consent/sl-login-consent.vue')))
  failures.push('missing shared login consent component')

const guard = read('src/utils/auth-guard.ts')
if (guard.includes('/pages/common/login/index'))
  failures.push('auth guard still navigates directly to login page')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('login compliance check passed')
```

- [ ] **Step 2: Run check and verify RED**

Run: `node scripts/check-login-compliance.mjs`

Expected: FAIL because current code still contains `登录即表示同意`, `微信授权登录`, no agreement page, no shared component, and direct auth-guard login navigation.

### Task 2: Add Agreement Content And Detail Page

**Files:**
- Create: `src/constants/agreements.ts`
- Create: `src/pages/common/agreement/index.vue`
- Modify: `src/pages.json`

- [ ] **Step 1: Add local service/privacy agreement text**

Create `agreements.ts` exporting service/privacy metadata and text paragraphs. Use concise real text that covers account login, application review, listing browsing, location use, and data security.

- [ ] **Step 2: Add agreement page**

Create a mobile-readable scroll page. It reads `type=service|privacy`, shows the matching title and paragraphs, and falls back to privacy policy if the query is invalid.

- [ ] **Step 3: Register the page**

Add `pages/common/agreement/index` to `src/pages.json` with navigation title `协议说明`.

### Task 3: Centralize Popup Login Flow

**Files:**
- Create: `src/utils/login-flow.ts`
- Create: `src/components/sl-login-consent/sl-login-consent.vue`

- [ ] **Step 1: Add event-driven utility**

Create `requestLogin(options)` and `promptProtectedLogin(tip)` helpers. They emit a global `shenle:login-request` event and avoid navigating to login for normal actions.

- [ ] **Step 2: Add consent/profile component**

Create `sl-login-consent` with two popup states: agreement consent and profile completion. Agreement popup links to agreement page. It calls `auth.wxLoginStep1()` only after `同意并登录`; if `needProfile`, it shows profile completion and calls `auth.wxLoginStep2()`.

### Task 4: Wire Protected Actions And Mine Page

**Files:**
- Modify: `src/utils/auth-guard.ts`
- Modify: `src/pages/admin/mine/index.vue`
- Modify: `src/pages/common/login/index.vue`
- Modify: `src/api/request.ts`
- Modify: `src/router/interceptor.ts`
- Modify pages using protected actions only as needed to mount `sl-login-consent`.

- [ ] **Step 1: Replace auth-guard navigation**

Use `promptProtectedLogin()` for unauthenticated actions. Keep guest users going to apply page.

- [ ] **Step 2: Update mine page**

Mount `sl-login-consent`. Remove the login menu row. Make the unauthenticated profile card trigger `requestLogin()`.

- [ ] **Step 3: Simplify login fallback page**

Keep `/pages/common/login/index` as a fallback page, but change button behavior to open explicit consent first and remove implicit-agreement copy.

- [ ] **Step 4: Reduce forced login-page redirects**

For request 401 and protected-route interception, prefer `promptProtectedLogin()` or fallback login request event. Keep direct login page only where no component can catch the event.

### Task 5: Verify

**Files:**
- Existing project files only.

- [ ] **Step 1: Run compliance check**

Run: `node scripts/check-login-compliance.mjs`

Expected: PASS.

- [ ] **Step 2: Run type check**

Run: `pnpm type-check`

Expected: PASS.

- [ ] **Step 3: Build WeChat mini program**

Run: `pnpm build:mp-weixin`

Expected: PASS and `dist/build/mp-weixin` syncs to `dist/dev/mp-weixin`.

- [ ] **Step 4: Search for risky wording**

Run: `rg "登录即表示同意|微信授权登录" src`

Expected: no implicit consent copy; the old term may only appear if used as page navigation fallback title, preferably not at all.
