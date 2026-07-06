# 深乐租企业官网 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone static enterprise website page for “深租宝典 / 深乐租” based on the approved website design spec and generated visual direction.

**Architecture:** Create an isolated `website/` static site inside `ShenLe_MiniApp_Next` so it does not affect the uni-app mini-program build. The site uses plain HTML, CSS, and minimal JavaScript, with local SVG/CSS-generated visuals rather than generated bitmap screenshots for the hero UI. Verification is done through a Node-based static checker plus browser visual inspection.

**Tech Stack:** HTML5, CSS custom properties, vanilla JavaScript, Node.js verification script, optional local static server.

---

## File Structure

- Create: `website/index.html`
  - Owns the static homepage markup and semantic content.
  - Contains no inline secrets, no real房源地址, no real phone numbers, and no private media.
- Create: `website/assets/styles.css`
  - Owns all layout, responsive behavior, typography, color tokens, animations, and component styling.
- Create: `website/assets/main.js`
  - Owns small progressive enhancements: smooth anchor scrolling, mobile nav toggle, and contact form no-backend feedback.
- Create: `website/README.md`
  - Documents preview/deployment notes and explains this site is independent from mini-program build.
- Create: `website/scripts/verify-website.mjs`
  - Verifies required sections, copy, CTA labels, security wording, no forbidden claims, and UTF-8 no BOM for website files.
- Modify: `package.json`
  - Add `website:verify` script only. Do not alter existing mini-program scripts.

## Task 1: Static Site Skeleton And Verification

**Files:**
- Create: `website/index.html`
- Create: `website/scripts/verify-website.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing verification script**

Create `website/scripts/verify-website.mjs`:

```js
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const websiteDir = path.join(root, 'website')
const filesToCheck = [
  'index.html',
  'assets/styles.css',
  'assets/main.js',
  'README.md',
  'scripts/verify-website.mjs',
]

function assert(condition, message) {
  if (!condition) {
    console.error(`Website verification failed: ${message}`)
    process.exit(1)
  }
}

function readUtf8(relativePath) {
  const filePath = path.join(websiteDir, relativePath)
  assert(fs.existsSync(filePath), `missing ${relativePath}`)
  const bytes = fs.readFileSync(filePath)
  const hasBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  assert(!hasBom, `${relativePath} has UTF-8 BOM`)
  return bytes.toString('utf8')
}

const html = readUtf8('index.html')

for (const relativePath of filesToCheck.slice(1)) {
  readUtf8(relativePath)
}

const requiredSnippets = [
  '深租宝典',
  '深乐租',
  '把分散房源变成可运营的数据资产',
  '预约产品演示',
  '查看核心功能',
  '楼盘与房源管理',
  '地图找房与筛选',
  '销控看板',
  '媒体资产池',
  '数据与权限保护',
  '想把你的房源团队数字化',
  '不提供在线交易、支付或用户自行发布',
]

for (const snippet of requiredSnippets) {
  assert(html.includes(snippet), `missing required copy: ${snippet}`)
}

const requiredIds = ['hero', 'features', 'scenarios', 'security', 'contact']
for (const id of requiredIds) {
  assert(html.includes(`id="${id}"`), `missing section id: ${id}`)
}

const forbiddenClaims = ['保证成交', '自动匹配客户', '官方认证房源', '真实房号', '房东电话']
for (const claim of forbiddenClaims) {
  assert(!html.includes(claim), `forbidden claim or sensitive wording found: ${claim}`)
}

assert(html.includes('assets/styles.css'), 'stylesheet is not linked')
assert(html.includes('assets/main.js'), 'main script is not linked')
console.log('Website verification passed')
```

- [ ] **Step 2: Run verification to confirm it fails before implementation**

Run:

```powershell
pnpm website:verify
```

Expected: fails because `website:verify` script and website files do not exist yet.

- [ ] **Step 3: Add the npm script**

Modify `package.json` `scripts` block by adding:

```json
"website:verify": "node website/scripts/verify-website.mjs"
```

Do not rename or remove any existing scripts.

- [ ] **Step 4: Create the minimal HTML skeleton**

Create `website/index.html` with the required section ids and placeholder semantic content:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="深租宝典是面向二房东、中介门店和区域房源团队的房源管理与展示平台。">
  <title>深租宝典 / 深乐租 - 房源数据管理与展示平台</title>
  <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
  <header class="site-header">
    <a class="brand" href="#hero" aria-label="深租宝典首页">深租宝典 <span>深乐租</span></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">菜单</button>
    <nav id="site-nav" class="site-nav" aria-label="主导航">
      <a href="#features">产品能力</a>
      <a href="#scenarios">适用场景</a>
      <a href="#security">数据安全</a>
      <a href="#contact">合作咨询</a>
    </nav>
  </header>
  <main>
    <section id="hero"></section>
    <section id="features"></section>
    <section id="scenarios"></section>
    <section id="security"></section>
    <section id="contact"></section>
  </main>
  <script src="assets/main.js" defer></script>
</body>
</html>
```

- [ ] **Step 5: Create placeholder CSS and JS files**

Create `website/assets/styles.css`:

```css
:root {
  color: #173325;
  background: #f6f1e8;
}

body {
  margin: 0;
  font-family: "HarmonyOS Sans SC", "Alibaba PuHuiTi", "Source Han Sans SC", "Microsoft YaHei", sans-serif;
}
```

Create `website/assets/main.js`:

```js
document.documentElement.classList.add('is-enhanced')
```

- [ ] **Step 6: Run verification and commit skeleton**

Run:

```powershell
pnpm website:verify
```

Expected: fails because required copy is not yet implemented.

Do not commit until Task 2 completes enough required content to pass.

## Task 2: Homepage Content And Visual Components

**Files:**
- Modify: `website/index.html`
- Modify: `website/assets/styles.css`

- [ ] **Step 1: Replace skeleton sections with final content**

Use semantic sections:

```html
<section id="hero" class="hero section-shell">
  <div class="hero__copy">
    <p class="eyebrow">房源管理 · 地图找房 · 团队协作</p>
    <h1>把分散房源变成可运营的数据资产</h1>
    <p class="hero__lead">深租宝典为二房东、中介门店和区域房源团队提供楼盘、房源、销控、地图、媒体与权限管理能力，让团队更快找房、更准维护、更安全地展示数据。</p>
    <div class="hero__actions">
      <a class="button button--primary" href="#contact">预约产品演示</a>
      <a class="button button--ghost" href="#features">查看核心功能</a>
    </div>
    <div class="trust-strip" aria-label="平台能力摘要">
      <span>微信授权登录</span>
      <span>游客脱敏预览</span>
      <span>管理员审批</span>
    </div>
  </div>
  <div class="hero__visual" aria-label="房源运营看板示意图">
    <!-- CSS-built dashboard markup goes here. -->
  </div>
</section>
```

Implement four feature cards with these exact headings:

```html
<article class="feature-card">
  <span class="feature-card__icon">楼</span>
  <h3>楼盘与房源管理</h3>
  <p>楼盘、楼栋、房号、户型、租金、状态统一维护，减少 Excel 和聊天记录分散管理。</p>
</article>
```

Repeat with:

- `地图找房与筛选`
- `销控看板`
- `媒体资产池`

- [ ] **Step 2: Implement product dashboard visual in HTML**

Inside `.hero__visual`, create:

- a dark green mock app shell
- KPI cards for `楼盘`, `可租`, `媒体`
- a map panel with CSS pins
- a sale-control status panel
- a role permission floating card

Use only abstract labels and counts. Do not include real楼盘名称 or addresses.

- [ ] **Step 3: Implement final visual styling**

Update `website/assets/styles.css` with:

- CSS variables for brand colors
- responsive grid hero
- sticky header
- card shadows and rounded corners
- animated fade-in for hero/cards using `@keyframes`
- mobile breakpoint at `760px`
- no horizontal overflow

Use this baseline:

```css
:root {
  --green-950: #173325;
  --green-700: #1f7a4c;
  --green-100: #e9f4e5;
  --beige-100: #f6f1e8;
  --paper: #fffdf8;
  --text: #173325;
  --muted: #52695c;
  --line: rgba(31, 122, 76, 0.14);
  --gold: #ffd166;
  --shadow: 0 24px 80px rgba(23, 51, 37, 0.14);
}
```

- [ ] **Step 4: Run verification**

Run:

```powershell
pnpm website:verify
```

Expected: `Website verification passed`.

- [ ] **Step 5: Commit homepage content**

Run:

```powershell
git add package.json website/index.html website/assets/styles.css website/assets/main.js website/scripts/verify-website.mjs
git commit -m "feat: add static enterprise website homepage"
```

## Task 3: Interaction, Documentation, And Visual QA

**Files:**
- Modify: `website/assets/main.js`
- Create: `website/README.md`

- [ ] **Step 1: Add progressive JS behavior**

Implement:

```js
const navToggle = document.querySelector('.nav-toggle')
const nav = document.querySelector('#site-nav')

if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const expanded = navToggle.getAttribute('aria-expanded') === 'true'
    navToggle.setAttribute('aria-expanded', String(!expanded))
    nav.classList.toggle('is-open', !expanded)
  })
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const targetId = link.getAttribute('href')
    if (!targetId || targetId === '#') return
    const target = document.querySelector(targetId)
    if (!target) return
    event.preventDefault()
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    nav?.classList.remove('is-open')
    navToggle?.setAttribute('aria-expanded', 'false')
  })
})

const contactForm = document.querySelector('.contact-form')
const formResult = document.querySelector('.form-result')

contactForm?.addEventListener('submit', (event) => {
  event.preventDefault()
  if (formResult) {
    formResult.textContent = '已记录你的咨询意向。正式上线时这里会接入微信或表单服务。'
  }
})
```

- [ ] **Step 2: Add website README**

Create `website/README.md`:

```md
# 深租宝典企业官网

这是深租宝典 / 深乐租的独立静态官网页面，不参与小程序构建。

## 本地预览

```powershell
cd E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next
python -m http.server 4173 -d website
```

打开 `http://localhost:4173`。

## 验证

```powershell
pnpm website:verify
```

验证内容包括关键文案、页面区块、敏感表达和 UTF-8 no BOM。

## 部署建议

第一版可将 `website/` 目录作为静态站点部署到 Nginx 根路径，API 继续保留在 `/api/`。
```

- [ ] **Step 3: Run verification**

Run:

```powershell
pnpm website:verify
```

Expected: `Website verification passed`.

- [ ] **Step 4: Start local static server and inspect visually**

Run:

```powershell
python -m http.server 4173 -d website
```

Open `http://localhost:4173` and verify:

- desktop hero has no horizontal scroll
- mobile width keeps cards readable
- CTA anchors scroll to sections
- contact form shows no-backend feedback
- no visible fake real房源 data

- [ ] **Step 5: Commit docs and interaction**

Run:

```powershell
git add website/README.md website/assets/main.js website/assets/styles.css
git commit -m "docs: document static website preview and interactions"
```

## Task 4: Final Hygiene

**Files:**
- Verify all changed website files
- Verify generated design assets are either intentionally committed or left untracked with user notice

- [ ] **Step 1: Check Git status**

Run:

```powershell
git status --short --branch
```

Expected:

- new website commits are ahead of origin
- no unintended temporary server files tracked
- `design/website/` status is intentionally decided

- [ ] **Step 2: Scan new website files for BOM**

Run:

```powershell
$files = git ls-files website package.json docs/superpowers/plans/2026-07-06-shenle-enterprise-website.md docs/superpowers/specs/2026-07-06-shenle-enterprise-website-design.md
foreach ($f in $files) {
  $bytes = [System.IO.File]::ReadAllBytes((Join-Path (Get-Location) $f))
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    throw "BOM found: $f"
  }
}
"No BOM in checked files"
```

- [ ] **Step 3: Final verification**

Run:

```powershell
pnpm website:verify
```

Expected: `Website verification passed`.

- [ ] **Step 4: Report remaining choices**

Report:

- preview URL used
- committed changes
- whether `design/website/` generated assets are committed or still untracked
- whether the branch should be pushed

## Self-Review

Spec coverage:

- Product positioning is implemented by hero copy and CTA.
- Core abilities are implemented by feature cards and dashboard visual.
- Use cases are implemented by scenario section.
- Data and permission protection is implemented by security section.
- Conversion is implemented by contact section.
- Static deployment boundary is documented in README.

Placeholder scan:

- The plan contains no TBD/TODO placeholders.
- The only temporary wording is a deliberate no-backend feedback message for first-version static form behavior.

Type consistency:

- Section ids are consistent across HTML, navigation, verification script, and JS.
- Script names and paths are consistent with `package.json`.
