# 盘源对接人批量管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 隐藏新小程序自助申请入口，并提供可靠的盘源对接人批量设置和楼盘批量归属管理。

**Architecture:** 保留旧申请 API，仅删除新小程序入口。批量设置和批量分配使用管理专用事务接口；楼盘候选查询在后端按目标用户过滤，前端只维护跨分页的增量选择状态。

**Tech Stack:** Vue 3、uni-app、wot-design-uni、Vitest、ASP.NET Core 8、SqlSugar、xUnit、WeChat DevTools MCP。

---

### Task 1: 隐藏新小程序自助申请入口

**Files:**
- Modify: `src/pages/admin/mine/index.vue`
- Modify: `src/pages/common/apply/index.vue`
- Create: `src/utils/__tests__/landlord-self-apply-ui.test.ts`

- [ ] **Step 1: 写失败测试**

递归读取两个页面，断言不再包含 `submitLandlordApply`、`申请成为盘源对接人`、`重新申请盘源对接人` 和 `盘源对接人申请审核中`；同时断言管理页仍包含 `pending-block`。

- [ ] **Step 2: 运行失败测试**

Run: `pnpm vitest run src/utils/__tests__/landlord-self-apply-ui.test.ts`

Expected: FAIL，指出两个页面仍包含自助申请入口。

- [ ] **Step 3: 删除界面和死代码**

删除两个页面中的自助申请模板、状态变量、加载调用和提交函数；不修改 `src/api/access.ts` 及后端申请接口。

- [ ] **Step 4: 运行测试并提交**

Run: `pnpm vitest run src/utils/__tests__/landlord-self-apply-ui.test.ts`

Expected: PASS。

Commit: `feat: hide source contact self application`

### Task 2: 增加后端批量设置能力

**Files:**
- Modify: `E:/WorkSpace/WorkSpace-MiniApp/深乐租项目/ShenLe/Api/ShenLe.Application/Service/SlUserManage/Dto/SlUserManageDto.cs`
- Modify: `E:/WorkSpace/WorkSpace-MiniApp/深乐租项目/ShenLe/Api/ShenLe.Application/Service/SlUserManage/SlUserManageService.cs`
- Modify: `E:/WorkSpace/WorkSpace-MiniApp/深乐租项目/ShenLe/Api/ShenLe.Application/Service/SlLandlord/Dto/SlLandlordDto.cs`
- Modify: `E:/WorkSpace/WorkSpace-MiniApp/深乐租项目/ShenLe/Api/ShenLe.Application/Service/SlLandlord/SlLandlordService.cs`
- Create: `E:/WorkSpace/WorkSpace-MiniApp/深乐租项目/ShenLe/Api/ShenLe.Test/Landlord/SlLandlordBatchContractTests.cs`

- [ ] **Step 1: 写失败契约测试**

断言 `SlUserOutput.IsLandlord`、`BatchSetLandlordInput.UserIds` 和 `SlLandlordService.BatchSetLandlord` 存在，方法带 `/api/slLandlord/batchSetLandlord` 路由及 `UnitOfWork`。

- [ ] **Step 2: 运行失败测试**

Run: `dotnet test .\Api\ShenLe.Test\ShenLe.Test.csproj -f net8.0 --no-restore --filter FullyQualifiedName~SlLandlordBatchContractTests`

Expected: FAIL，缺少新契约。

- [ ] **Step 3: 实现最小后端能力**

在用户分页投影中用 `SqlFunc.Subqueryable<SlLandlord>()` 填充 `IsLandlord`。新增带 `[Required]`、`[MinLength(1)]` 的 `UserIds` 输入；批量方法对 Id 去重后逐个调用 `EnsureLandlord`，返回处理人数。

- [ ] **Step 4: 运行测试**

Run: 同 Step 2。

Expected: PASS。

### Task 3: 增加楼盘归属查询和事务批量写入

**Files:**
- Modify: `E:/WorkSpace/WorkSpace-MiniApp/深乐租项目/ShenLe/Api/ShenLe.Application/Service/SlCommunity/Dto/SlCommunityDto.cs`
- Modify: `E:/WorkSpace/WorkSpace-MiniApp/深乐租项目/ShenLe/Api/ShenLe.Application/Service/SlCommunity/SlCommunityService.cs`
- Create: `E:/WorkSpace/WorkSpace-MiniApp/深乐租项目/ShenLe/Api/ShenLe.Test/Landlord/SlCommunityAssignmentPolicyTests.cs`

- [ ] **Step 1: 写失败测试**

覆盖三项规则：候选条件只允许未分配或目标用户；分配给其他人的楼盘产生冲突；分配和移除 Id 重叠时拒绝。另用反射锁定 `/api/slCommunity/assignmentPage` 和 `/api/slCommunity/batchAssignOwner`。

- [ ] **Step 2: 运行失败测试**

Run: `dotnet test .\Api\ShenLe.Test\ShenLe.Test.csproj -f net8.0 --no-restore --filter FullyQualifiedName~SlCommunityAssignmentPolicyTests`

Expected: FAIL，策略和接口尚不存在。

- [ ] **Step 3: 实现查询 DTO 和接口**

新增 `PageCommunityAssignmentInput`、`CommunityAssignmentOutput`。查询必须先执行 `OwnerId == null || OwnerId == input.OwnerUserId`，再应用 `assignmentStatus`、关键字和分页，投影 `IsAssigned`、`BuildingCount`、`PropertyCount`。

- [ ] **Step 4: 实现增量批量写入**

新增 `BatchAssignOwnerInput` 和结果 DTO。对输入去重并检查交集；一次加载相关楼盘，拒绝其他用户归属冲突；批量分配未分配楼盘，批量移除当前目标用户楼盘，保持重复请求幂等。

- [ ] **Step 5: 运行测试**

Run: 同 Step 2。

Expected: PASS。

### Task 4: 实现前端批量选择状态模型

**Files:**
- Create: `src/utils/landlord-batch.ts`
- Create: `src/utils/__tests__/landlord-batch.test.ts`
- Modify: `src/types/shenle.ts`
- Modify: `src/api/landlord.ts`

- [ ] **Step 1: 写失败测试**

测试用户选择去重、已设置用户不可选、楼盘初始状态切换、跨分页保留以及 `assignCommunityIds/unassignCommunityIds` 增量构造。

- [ ] **Step 2: 运行失败测试**

Run: `pnpm vitest run src/utils/__tests__/landlord-batch.test.ts`

Expected: FAIL，工具函数不存在。

- [ ] **Step 3: 实现纯函数和 API 类型**

实现 `toggleUserSelection`、`toggleCommunityAssignment`、`buildAssignmentDelta`；补齐 `isLandlord`、归属分页 DTO、批量输入输出和三个 API 方法。

- [ ] **Step 4: 运行测试**

Run: 同 Step 2。

Expected: PASS。

### Task 5: 改造盘源对接人管理界面

**Files:**
- Modify: `src/pages/admin/landlord-manage/index.vue`
- Create: `src/utils/__tests__/landlord-manage-ui.test.ts`

- [ ] **Step 1: 写失败 UI 契约测试**

断言页面包含“批量设置”、“全部/未分配/已分配给他”、“新增分配”和“移除”的摘要文案，不再包含单行同时出现的 `confirmAssign`、`confirmUnassign` 按钮结构。

- [ ] **Step 2: 运行失败测试**

Run: `pnpm vitest run src/utils/__tests__/landlord-manage-ui.test.ts`

Expected: FAIL，仍是单选和双按钮界面。

- [ ] **Step 3: 实现批量设置弹层**

用户列表使用复选框；已设置用户显示状态并禁选；选择跨分页保留；底部显示数量和确认按钮，提交后刷新盘源对接人列表。

- [ ] **Step 4: 实现楼盘增量分配弹层**

接入专用分页接口、分段筛选和搜索；以服务端 `isAssigned` 建立初始状态，以本地变更映射覆盖显示；底部显示 `新增分配 X 个 · 移除 X 个` 并一次保存增量。

- [ ] **Step 5: 运行前端相关测试**

Run: `pnpm vitest run src/utils/__tests__/landlord-batch.test.ts src/utils/__tests__/landlord-manage-ui.test.ts src/utils/__tests__/landlord-self-apply-ui.test.ts`

Expected: PASS。

### Task 6: 全量验证、版本和发布

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 完整验证**

Run: `pnpm test`

Run: `pnpm type-check`

Run: `pnpm build:mp-weixin`

Run: `dotnet test .\Api\ShenLe.Test\ShenLe.Test.csproj -f net8.0 --no-restore --filter "FullyQualifiedName!~ShenLe.Test.User.UserTest"`

Run: `dotnet build .\Api\ShenLe.sln --no-restore`

Expected: 全部退出码 0；Selenium 环境测试继续单独说明。

- [ ] **Step 2: 编码和差异检查**

扫描所有改写文件首字节，确保无 UTF-8 BOM；运行前后端 `git diff --check`。

- [ ] **Step 3: 微信验证与发布**

将版本更新为 `0.4.6`，重新构建。DevTools `compile` 必须返回 `compiled: true`、`errors: []`、`warnings: []`；随后执行 `build_npm` 和 `upload(version='0.4.6')`。

- [ ] **Step 4: 后端部署与线上校验**

发布 net8.0 产物、上传到 `/home/ubuntu/shenle`、重启 `shenle-app`，验证容器运行、公共接口 HTTP 200，并对比本地与服务器 `ShenLe.Application.dll` SHA256。
