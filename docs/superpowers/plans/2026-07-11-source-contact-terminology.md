# 盘源对接人术语统一 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前新小程序、官网和后端的用户可见身份术语统一为“盘源对接人”，删除房源级联系人交互和官网咨询区，同时保持内部 API、数据库和英文标识兼容。

**Architecture:** 采用展示层术语迁移，不重命名 `SlLandlord`、`sl_landlord`、`isLandlord` 等内部契约。先用源码扫描测试锁定禁止旧术语和已删除功能，再分别修改小程序、官网、后端说明，最后执行完整构建和微信开发者工具验证。

**Tech Stack:** Vue 3、uni-app、wot-design-uni、Vitest、ASP.NET Core 8、xUnit、WeChat DevTools MCP。

---

### Task 1: 添加术语和删除范围回归测试

**Files:**
- Create: `src/utils/__tests__/source-contact-terminology.test.ts`
- Create: `E:/WorkSpace/WorkSpace-MiniApp/深乐租项目/ShenLe/Api/ShenLe.Test/Terminology/SourceContactTerminologyTests.cs`

- [ ] **Step 1: 编写小程序失败测试**

扫描 `src/pages`、`src/router`、`src/store`、`src/tabbar`、`src/pages.json` 与 `website`，禁止出现 `\u623f\u4e1c`；并断言房源表单、详情和批量组件不再包含 `landlordName`、`landlordPhone` 或 `callLandlord`，官网不存在 `id="contact"` 和 `.contact-form`。

- [ ] **Step 2: 验证小程序测试因现有旧术语和功能失败**

Run: `pnpm vitest run src/utils/__tests__/source-contact-terminology.test.ts`

Expected: FAIL，列出仍含旧术语的生产文件和仍存在的联系人/咨询区。

- [ ] **Step 3: 编写后端失败测试**

新增 xUnit 测试，递归扫描 `Api/ShenLe.Application` 下的 `.cs` 文件，使用 Unicode 字符构造旧术语，断言业务源码中不再出现该中文词。测试自身不写入旧中文词，避免自命中。

- [ ] **Step 4: 验证后端测试因现有旧术语失败**

Run: `dotnet test .\Api\ShenLe.Test\ShenLe.Test.csproj -f net8.0 --no-restore --filter FullyQualifiedName~SourceContactTerminologyTests`

Expected: FAIL，列出包含旧术语的业务源码。

### Task 2: 统一新小程序身份术语

**Files:**
- Modify: `src/pages.json`
- Modify: `src/router/interceptor.ts`
- Modify: `src/pages/admin/landlord-manage/index.vue`
- Modify: `src/pages/common/apply/index.vue`
- Modify: `src/pages/admin/mine/index.vue`
- Modify: `src/store/auth.ts`
- Modify: `src/store/mode.ts`
- Modify: `src/tabbar/config.ts`
- Modify: `src/tabbar/store.ts`

- [ ] **Step 1: 修改所有页面标题、按钮、弹窗、状态和错误提示**

统一使用“盘源对接人”“盘源对接人端”“盘源对接人管理”“申请成为盘源对接人”，保持所有变量、路由和接口调用不变。

- [ ] **Step 2: 运行术语测试**

Run: `pnpm vitest run src/utils/__tests__/source-contact-terminology.test.ts`

Expected: 仍可能因房源联系人或官网咨询区失败，但身份页面不再出现在旧术语清单中。

### Task 3: 删除小程序房源级联系人

**Files:**
- Modify: `src/pages/common/property-form/index.vue`
- Modify: `src/pages/common/property-detail/index.vue`
- Modify: `src/components/sl-property-batch/sl-property-batch.vue`
- Modify: `src/utils/property-batch.ts`
- Modify: `src/utils/__tests__/property-batch-ui.test.ts`
- Modify: `src/utils/__tests__/batch-api-contracts.test.ts`

- [ ] **Step 1: 删除单条表单和详情交互**

从表单状态、详情填充、提交 payload 和模板中删除联系人姓名、联系电话；从详情页删除拨号函数及“联系”按钮。保留 `src/types/shenle.ts` 中兼容字段。

- [ ] **Step 2: 删除批量编辑联系人字段**

从批量编辑字段集合、初始值、payload 构造和界面中删除联系人姓名、联系电话，不改变后端 DTO。

- [ ] **Step 3: 调整既有测试并运行批量相关测试**

Run: `pnpm vitest run src/utils/__tests__/source-contact-terminology.test.ts src/utils/__tests__/property-batch-ui.test.ts src/utils/__tests__/batch-api-contracts.test.ts`

Expected: 房源联系人断言通过；官网部分可能仍失败。

### Task 4: 删除官网咨询区并修正文案

**Files:**
- Modify: `website/index.html`
- Modify: `website/assets/main.js`
- Modify: `website/assets/styles.css`
- Modify: `website/scripts/verify-website.mjs`

- [ ] **Step 1: 删除咨询区域及入口**

删除 `#contact` 整个 section、导航锚点、预约按钮、表单提交脚本和 `.contact-*` / `.form-*` 专属样式。首屏主按钮改为指向现有产品能力区，避免死链。

- [ ] **Step 2: 删除不存在的市场定位**

官网受众改为“盘源对接人、房源门店和区域房源团队”，场景卡改为“盘源规模化运营”，不保留旧身份词。

- [ ] **Step 3: 强化官网校验并执行**

`requiredIds` 删除 `contact`；新增断言禁止旧身份词、`id="contact"` 和 `contact-form`。

Run: `pnpm website:verify`

Expected: PASS。

### Task 5: 统一后端用户可见术语

**Files:**
- Modify: `E:/WorkSpace/WorkSpace-MiniApp/深乐租项目/ShenLe/Api/ShenLe.Application/**/*.cs`
- Update generated artifact: `E:/WorkSpace/WorkSpace-MiniApp/深乐租项目/ShenLe/Api/ShenLe.Web.Entry/swagger.json`

- [ ] **Step 1: 替换业务说明和提示**

将异常消息、DisplayName、ApiDescriptionSettings、XML 注释、实体列说明和行内业务说明中的旧身份词改为“盘源对接人”。保留所有英文类型、方法、字段、路由、表名和权限条件。

- [ ] **Step 2: 同步静态 Swagger 描述**

仅机械替换生成文件中的中文描述，随后用 JSON 解析验证文件仍有效，不改结构和格式。

- [ ] **Step 3: 运行术语测试和核心权限测试**

Run: `dotnet test .\Api\ShenLe.Test\ShenLe.Test.csproj -f net8.0 --no-restore --filter "FullyQualifiedName~SourceContactTerminologyTests|FullyQualifiedName~SlAccessPolicyTests"`

Expected: PASS。

### Task 6: 完整验证和质量检查

**Files:**
- Verify only; no new production files expected.

- [ ] **Step 1: 验证新小程序**

Run: `pnpm test`

Run: `pnpm type-check`

Run: `pnpm build:mp-weixin`

Expected: 全部退出码 0。

- [ ] **Step 2: 验证后端**

Run: `dotnet test .\Api\ShenLe.Test\ShenLe.Test.csproj -f net8.0 --no-restore`

Run: `dotnet build .\Api\ShenLe.sln --no-restore`

Expected: 测试和构建通过，无新增警告。

- [ ] **Step 3: 验证微信开发者工具**

执行 MCP compile，要求 `compiled: true`、`errors: []`、`warnings: []`、AppID 为 `wxb3b545efe13da99b`。

- [ ] **Step 4: 检查编码和工作区**

扫描所有改写文件首字节，确认无 UTF-8 BOM；运行 `git diff --check`；确认未修改旧小程序。

