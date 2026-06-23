# 房东(申请制 / 无付费)实施计划 — Phase 1 增量改造

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已实现的 Phase 1 房东代码改造成"申请→999 审批拿房东、纯房东锁房东端只看自己、999 双列表、角色标签更新"的最终形态。

**Architecture:** 复用 Phase 1 的 `sl_landlord` 标记 / `OwnerId` / `RequireCommunityOwnerOrAdmin` / `ownerScope`;新增 `sl_user_access.ApplyType` 双申请类型;房东管理全部收紧到 999;前端锁端 + 去高亮 + 加申请入口。

**Tech Stack:** 后端 .NET 8 / Admin.NET / SqlSugar(CodeFirst);前端 uni-app + Vue3 `<script setup>` + pinia + 自定义 tabBar。

**关联 spec:** `docs/superpowers/specs/2026-06-21-landlord-application-model.md`

**起点状态(重要):**
- 后端 Phase 1 改动在**工作树未提交**(base `fb964bb`)。本计划继续在工作树上改,**不 commit/部署,等用户 Git 指令**。
- 前端 Phase 1 已**本地提交** `c31be88..5813d57`(分支 `refactor/unibest-wot-next`,未推送)。本计划前端**可自主提交**。

**验证约定:** 后端 `dotnet build ShenLe.sln`(0 错)+ 现有 `SlAccessPolicyTests`(8 过)保持;接口逻辑靠 build + 后续 E2E。前端 `vue-tsc` + `eslint`(改动文件 0 错)+ `pnpm build:mp` + 模拟器。**新文件不得带 UTF-8 BOM。**

---

## File Structure（本轮改动）

**后端(改)**
- `Api/ShenLe.Application/Entity/SlUserAccess.cs` — 加 `ApplyType`
- `Api/ShenLe.Application/Service/SlAccess/SlAccessService.cs` — `Apply(applyType)` + 已是房东/待审兜底;`MyStatus` 加 `landlordApplyStatus`
- `Api/ShenLe.Application/Service/SlAccess/Dto/SlAccessDto.cs` — `MyAccessOutput` 加 `LandlordApplyStatus`(`IsLandlord` 已有);`ApplyInput` 加 `ApplyType`
- `Api/ShenLe.Application/Service/SlUserManage/SlUserManageService.cs` — `Pending` 加 `ApplyType==0`;`Approve`/`Reject` 删除/查询按 `ApplyType==0` 限定
- `Api/ShenLe.Application/Service/SlLandlord/SlLandlordService.cs` — 守卫 888→999;加 `PendingApplications`/`ApproveLandlord`/`RejectLandlord`;`SetLandlord`→保留为 `RevokeLandlord`(或改名)
- `Api/ShenLe.Application/Service/SlLandlord/Dto/SlLandlordDto.cs` — 申请项输出 DTO
- `Api/ShenLe.Application/Service/SlCommunity/SlCommunityService.cs` — `assignOwner`/`unassignOwner` 888→999

**前端(改)**
- `src/types/shenle.ts` — `MyAccessOutput` 加 `landlordApplyStatus`
- `src/api/user-manage.ts` — `applyAccess(applyType)`;`getMyAccess` 类型;新增房东审批 API（或新建 `src/api/landlord.ts` 已存在则加）
- `src/api/landlord.ts` — `getLandlordPending`/`approveLandlord`/`rejectLandlord`/`revokeLandlord`
- `src/store/auth.ts` — 暴露 `landlordApplyStatus`;`mergeIsLandlord` 后做锁端再校正
- `src/store/mode.ts` — `readInitialMode` 强制房东
- `src/pages/admin/mine/index.vue` — 非管理员房东去切端;业务员加申请房东;房东管理菜单→999;角色标签
- `src/pages/common/apply/index.vue` — 加「申请成为房东」
- `src/pages/user/map/index.vue` + `src/pages/admin/property-list/index.vue` — landlord 恒 `ownerScope=self`;去 mineOnly 开关 + 高亮
- `src/pages/admin/landlord-manage/index.vue` — 守卫→999;加待审申请 + 审批/拒绝

---

## 后端任务

### Task 1: `sl_user_access.ApplyType` + `Apply(applyType)` + `MyStatus`

**Files:** `Entity/SlUserAccess.cs`、`Service/SlAccess/Dto/SlAccessDto.cs`、`Service/SlAccess/SlAccessService.cs`

- [ ] **Step 1:** `SlUserAccess.cs` 加字段(读现有字段风格;`ApplyStatus` 已有):
```csharp
/// <summary>
/// 申请类型：0=用户权限(游客→777)，1=房东
/// </summary>
[SugarColumn(ColumnDescription = "申请类型:0用户权限,1房东")]
public int ApplyType { get; set; }
```
- [ ] **Step 2:** `SlAccessDto.cs`:`MyAccessOutput` 加 `public int LandlordApplyStatus { get; set; }`(`IsLandlord` 已有,勿重复加);`Apply` 的输入加可选 `ApplyType`(若现 `Apply` 无入参,新增 `ApplyAccessInput { int ApplyType }`,默认 0)。读现有 `Apply` 签名后决定最小改法。
- [ ] **Step 3:** `SlAccessService.Apply`:按 `applyType` 写/复用申请行(`ApplyStatus=1`)。**兜底**:
```csharp
// applyType==1 且已是房东 → 拒绝
if (applyType == 1 && await _landlordRep.IsAnyAsync(x => x.UserId == uid))
    throw Oops.Oh("您已是房东");
// 同类型已有待审 → 复用该行更新时间（避免重复插入）；或提示"申请审核中"
```
(读现有 Apply 看它如何取 uid / 是否已注入 `_landlordRep`;`SlLandlord` 仓储按需注入。)
- [ ] **Step 4:** `SlAccessService.MyStatus`:已返回 `IsLandlord`,加 `LandlordApplyStatus`(查 `sl_user_access` 中该用户 `ApplyType==1` 的 `ApplyStatus`,无记录=0):
```csharp
var landlordApply = await _accessRep.AsQueryable()
    .Where(a => a.UserId == uid && a.ApplyType == 1).Select(a => a.ApplyStatus).FirstAsync();
// output.LandlordApplyStatus = landlordApply; // First() 对 int 空结果返回 0 = 未申请
```
- [ ] **Step 5: 编译** `dotnet build ShenLe.sln -c Debug --nologo -clp:ErrorsOnly` → 0 错。
- [ ] **Step 6: 提交**（本地,等用户 Git 指令）

### Task 2: `SlUserManageService` 按 ApplyType 限定

**Files:** `Service/SlUserManage/SlUserManageService.cs`

- [ ] **Step 1:** `Pending` 查询加 `ApplyType == 0`(只列用户权限申请)。
- [ ] **Step 2:** `Approve`/`Reject` 中所有对 `sl_user_access` 的删除/更新加 `&& a.ApplyType == 0`(防止误删该用户的房东申请)。现有 `DeleteAsync(a => a.UserId == input.UserId)` → `DeleteAsync(a => a.UserId == input.UserId && a.ApplyType == 0)`。
- [ ] **Step 3: 编译** 0 错。**Step 4: 提交**（本地）

### Task 3: `SlLandlordService` 收紧 999 + 审批/撤销;assignOwner 999

**Files:** `Service/SlLandlord/SlLandlordService.cs`、`Service/SlLandlord/Dto/SlLandlordDto.cs`、`Service/SlCommunity/SlCommunityService.cs`

- [ ] **Step 1:** `SlLandlordService` 所有方法守卫 `RequireAdmin()`→`RequireSuperAdmin()`(`Page` 等)。
- [ ] **Step 2:** DTO 加房东申请项输出(昵称 + 申请时间 + userId)。
- [ ] **Step 3:** 加方法(均 `RequireSuperAdmin`):
  - `PendingApplications` → 查 `sl_user_access` `ApplyType==1 && ApplyStatus==1`,join SysUser 取昵称。
  - `ApproveLandlord(userId)` → `[UnitOfWork]`:`await EnsureLandlord(userId)`(复用,插标记+升≥777)+ `DeleteAsync(a => a.UserId==userId && a.ApplyType==1)`。
  - `RejectLandlord(userId)` → `UpdateColumns ApplyStatus=3 where UserId==userId && ApplyType==1`。
- [ ] **Step 4:** `SetLandlord(false)` 撤销逻辑保留并改名/保留为 `RevokeLandlord(userId)`(清 OwnerId + 删标记)。直接 `SetLandlord(true)` 手点入口可删(改走审批)或保留备用——按最小改动,保留 `SetLandlord` 但守卫升 999。
- [ ] **Step 5:** `SlCommunityService.AssignOwner`/`UnassignOwner`:`RequireAdmin()`→`RequireSuperAdmin()`。
- [ ] **Step 6: 编译** 0 错 + `dotnet test ... SlAccessPolicyTests`（仍 8 过）。**Step 7: 提交**（本地）

---

## 前端任务

### Task 4: 类型 + API（先于用它的页面）

**Files:** `src/types/shenle.ts`、`src/api/user-manage.ts`、`src/api/landlord.ts`

- [ ] **Step 1:** `MyAccessOutput` 加 `landlordApplyStatus?: number`。
- [ ] **Step 2:** `applyAccess` 加可选 `applyType` 入参(默认 0),POST 带 `{ applyType }`;`getMyAccess` 返回类型含 `landlordApplyStatus`。
- [ ] **Step 3:** `api/landlord.ts` 加 `getLandlordPending()`、`approveLandlord(userId)`、`rejectLandlord(userId)`、`revokeLandlord(userId)`(对应后端路由,长 id 用 `number|string`)。
- [ ] **Step 4: 验证** `vue-tsc` 0 错 + `eslint` 改动文件 0 错。**Step 5: 提交**（前端自主)

### Task 5: 锁端（mode + auth 再校正）

**Files:** `src/store/mode.ts`、`src/store/auth.ts`

- [ ] **Step 1:** `mode.ts` `readInitialMode`:加强制——读 storage 的 user,若 `isLandlord===true && (accountType||0) < 888` → 恒返回 `'landlord'`(置于 admin 判定之后、user 兜底之前)。
- [ ] **Step 2:** `auth.ts`:暴露 `landlordApplyStatus`(computed from user 或单独 ref,来自 myStatus)。`mergeIsLandlord` 写完 user/storage 后,加锁端再校正:
```ts
// 非管理员房东若不在 landlord 模式 → 纠正
if (user.value?.isLandlord && (user.value?.accountType || 0) < 888 && modeStore.mode !== 'landlord') {
  modeStore.setMode('landlord')
  uni.reLaunch({ url: '/pages/user/map/index' })
}
```
(注意避免与登录"大刷新"的 reLaunch 打架——若 finishLogin 已 reLaunch,这里再纠正一次是幂等的;读现有 mergeIsLandlord/login 流程确认时序,必要时只 setMode 不 reLaunch,靠下次进入生效。)
- [ ] **Step 3: 验证** vue-tsc + eslint。**Step 4: 提交**

### Task 6: mine 页（去切端 / 业务员申请 / 菜单 999 / 标签）

**Files:** `src/pages/admin/mine/index.vue`

- [ ] **Step 1:** 非管理员房东视图(`isLandlordView && !auth.isAdmin`):**移除**"切换到用户端/管理端"行,只留「我的楼盘」。管理员(888+)房东视图保留切换。
- [ ] **Step 2:** 业务员用户视图(`!isAdminView && !isLandlordView` 且 `auth.canUseApp`,非房东):加「申请成为房东」入口,据 `auth.landlordApplyStatus`(0 可申请 / 1 申请中 / 3 重申)显示;点击调 `applyAccess(1)`。
- [ ] **Step 3:** `adminMenus`:把「房东管理」从 `base` 移到 `auth.isSuperAdmin` 分支(与「用户管理」一致)。
- [ ] **Step 4:** 角色标签:把展示"普通账号/管理员账号"等文案更新为 业务员(777)/管理人员(888)(读现有 meta 三元表达式,最小改)。
- [ ] **Step 5: 验证** vue-tsc + eslint。**Step 6: 提交**

### Task 7: apply 页加「申请成为房东」

**Files:** `src/pages/common/apply/index.vue`

- [ ] **Step 1:** 在现有"申请使用"按钮旁加第二个按钮「申请成为房东」,调 `applyAccess(1)`;据 `getMyAccess().landlordApplyStatus` 显示状态(申请中禁用)。
- [ ] **Step 2: 验证** + **提交**

### Task 8: map/list 改"只看自己"

**Files:** `src/pages/user/map/index.vue`、`src/pages/admin/property-list/index.vue`

- [ ] **Step 1:** landlord 模式下 `buildQuery` **恒**带 `ownerScope: 'self'`(去掉 `mineOnly` 条件)。
- [ ] **Step 2:** **移除**「只看我的楼盘」`wd-switch` 开关 + `mineOnly` ref;**移除**地图 isMine 金色高亮(`★`/`#b46d08` 分支)与列表「我的」badge——既然只看自己,无需区分。保留 `isLandlordMode` computed 仅用于 ownerScope 判定。
- [ ] **Step 3: 验证** vue-tsc + eslint + `pnpm build:mp` 成功。**Step 4: 提交**

### Task 9: landlord-manage 页 999 + 待审申请

**Files:** `src/pages/admin/landlord-manage/index.vue`

- [ ] **Step 1:** 页面守卫 `onLoad` 由 `!auth.isAdmin` → `!auth.isSuperAdmin`(非 999 退回)。
- [ ] **Step 2:** 加「房东申请」待审区:`getLandlordPending()` 列表 + 每条「通过」(`approveLandlord`)/「拒绝」(`rejectLandlord`);带待审数红点。
- [ ] **Step 3:** 现有"设为房东/取消"改为以审批为主;保留「撤销房东」(`revokeLandlord`)。「分配楼盘」沿用(后端已 999)。
- [ ] **Step 4: 验证** vue-tsc + eslint + build + wxml 存在。**Step 5: 提交**

### Task 10: E2E 验收（部署后端后)

- [ ] 部署后端(等用户 Git/部署指令)。
- [ ] 业务员「我的」申请房东 → 999 在房东列表看到待审 → 通过 → 该用户重登 → **直接进房东端、无切端、只看自己楼盘**。
- [ ] 游客在申请页能申请房东。
- [ ] 999 能看用户列表+房东列表;888 看不到房东管理入口。
- [ ] 鉴权断言:888 调 `slLandlord/page` 被拒(仅 999);房东改自己楼盘 OK、改别人被拒。

---

## 提交说明
后端各 Task"提交"= 本地准备,**实际 commit/push/部署等用户明确指示**。前端可自主提交。
