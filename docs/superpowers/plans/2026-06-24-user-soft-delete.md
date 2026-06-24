# 用户软删除（注销）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 超级管理员可在"用户管理"页注销小程序用户——软删 `SysUser`、清申请记录、立即踢下线；该微信再进来视为全新游客重新注册。

**Architecture:** 给 `SysUser` 加 `IsDelete` 并实现 `IDeletedFilter`（仅启用框架 SELECT 软删过滤器，**不改任何删除行为**——本仓库 `DeleteAsync` 是物理删除）。注销端点用**显式 `UpdateColumns(IsDelete=true)`** 软删 + 复用 `SlAuth.ForceRelogin` 踢下线。"可重新注册"由现有 `needProfile`/`CompleteProfile` 登录流程自动成立，登录代码不改。可判定的守卫抽到纯函数 `SlAccessPolicy.CheckCanDeleteUser` 做 TDD 单测；DB 编排部分由 E2E 验证（仓库无集成测试框架，与 `SetRole`/`Approve` 一致）。

**Tech Stack:** 后端 Admin.NET + Furion + SqlSugar（.NET 8，CodeFirst 自动加列）+ xUnit；前端 unibest + Vue3 + wot-design-uni。

**关联 spec:** [docs/superpowers/specs/2026-06-24-user-soft-delete-design.md](../specs/2026-06-24-user-soft-delete-design.md)

**起点/约束:**
- 后端 `e:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe`，分支 `admin.net`。**后端改完停下等用户 Git/部署指令，不自动提交、不自动部署。**
- 前端 `e:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next`，可自主提交；体验版上传须在后端部署之后（功能依赖新端点）。
- 后端编译：`dotnet build Api/ShenLe.sln -c Debug --nologo -clp:ErrorsOnly` → 0 错。
- 后端单测：`dotnet test Api/ShenLe.Test/ShenLe.Test.csproj -f net8.0 --nologo` → 全绿。（测试工程 `net8.0;net9.0` 双目标，`-f net8.0` 跑单目标更快；测试工程 `<Nullable>disable</Nullable>` 但 `NoWarn` 含 `8632`，故 `string?` 形参可编译。）

---

## 文件结构

**后端（ShenLe）**
- 创建 `Api/ShenLe.Core/Entity/SysUser.SoftDelete.cs` — partial 类，给 `SysUser` 加 `IsDelete` + `IDeletedFilter`（stock `SysUser.cs` 保持不动）。
- 修改 `Api/ShenLe.Application/Helper/SlAccessPolicy.cs` — 加纯函数 `CheckCanDeleteUser`。
- 修改 `Api/ShenLe.Test/Landlord/SlAccessPolicyTests.cs` — 加守卫单测。
- 修改 `Api/ShenLe.Application/Service/SlUserManage/SlUserManageService.cs` — 加 `DeleteUser` 端点 + Page 防御性过滤。

**前端（ShenLe_MiniApp_Next）**
- 修改 `src/api/user-manage.ts` — 加 `deleteUser(userId)`。
- 修改 `src/pages/admin/user-manage/index.vue` — 加"注销"按钮 + 强确认弹窗。

---

## Task 1: SysUser 加 IsDelete + IDeletedFilter（框架软删过滤器）

**Files:**
- Create: `Api/ShenLe.Core/Entity/SysUser.SoftDelete.cs`

**说明：** stock `SysUser.cs` 是 `public partial class SysUser : EntityBaseTenantOrg`。用 partial 在**同一程序集（ShenLe.Core）**追加接口与列，stock 文件零改动。`IDeletedFilter`（`IEntityFilter.cs:12`）声明 `bool IsDelete { get; set; }`。实现后框架全局过滤器 `AddTableFilter<IDeletedFilter>(u => u.IsDelete==false)`（`SqlSugarSetup.cs:259`）自动作用于所有 `SysUser` 查询。

- [ ] **Step 1: 新建 partial 文件**

```csharp
// ShenLe 项目的版权、商标、专利和其他相关权利均受相应法律法规的保护。使用本项目应遵守相关法律法规和许可证的要求。
//
// 本项目主要遵循 MIT 许可证和 Apache 许可证（版本 2.0）进行分发和使用。许可证位于源代码树根目录中的 LICENSE-MIT 和 LICENSE-APACHE 文件。
//
// 不得利用本项目从事危害国家安全、扰乱社会秩序、侵犯他人合法权益等法律法规禁止的活动！任何基于本项目二次开发而产生的一切法律纠纷和责任，我们不承担任何责任！

namespace ShenLe.Core;

/// <summary>
/// 系统用户表 — 小程序软删除扩展（注销/可恢复）。
/// 实现 IDeletedFilter 即启用框架全局软删 SELECT 过滤器（不改任何删除行为，本仓库 DeleteAsync 为物理删除）。
/// </summary>
[SugarIndex("index_{table}_D", nameof(IsDelete), OrderByType.Asc)]
public partial class SysUser : IDeletedFilter
{
    /// <summary>
    /// 软删除
    /// </summary>
    [SugarColumn(ColumnDescription = "软删除")]
    public bool IsDelete { get; set; } = false;
}
```

- [ ] **Step 2: 编译**

Run: `dotnet build Api/ShenLe.sln -c Debug --nologo -clp:ErrorsOnly`
Expected: 0 错（partial 合并成 `SysUser : EntityBaseTenantOrg, IDeletedFilter`）。

- [ ] **Step 3: 提交**（本地，等用户 Git 指令——见末尾"提交说明"）

---

## Task 2: SlAccessPolicy.CheckCanDeleteUser 纯函数（TDD）

**Files:**
- Modify: `Api/ShenLe.Application/Helper/SlAccessPolicy.cs`
- Test: `Api/ShenLe.Test/Landlord/SlAccessPolicyTests.cs`

**守卫优先级（已与 spec 一致）：** 自己 > 超级管理员(999) > 必须是微信绑定用户（挡框架 PC 账号，因 `SysAdmin==888` 与小程序888同值无法靠 AccountType 区分）。

- [ ] **Step 1: 写失败的测试**（加到 `SlAccessPolicyTests` 类内）

```csharp
[Theory]
[InlineData(666, 5L, 1L, true, null)]                  // 游客 + 有微信绑定 → 可注销
[InlineData(777, 5L, 1L, true, null)]                  // 业务员 → 可注销
[InlineData(888, 5L, 1L, true, null)]                  // 管理人员 → 可注销
[InlineData(777, 5L, 5L, true, "不能注销自己")]         // 注销自己
[InlineData(999, 5L, 1L, true, "不能注销超级管理员")]   // 注销超管
[InlineData(999, 1L, 1L, true, "不能注销自己")]         // 自己且是超管 → 自己优先
[InlineData(888, 5L, 1L, false, "仅可注销小程序用户")]  // 无微信绑定（框架 PC 账号）
public void CheckCanDeleteUser_AppliesGuards(int targetAccountType, long targetUserId, long currentUserId, bool hasWxBinding, string? expected)
    => Assert.Equal(expected, SlAccessPolicy.CheckCanDeleteUser(targetAccountType, targetUserId, currentUserId, hasWxBinding));
```

- [ ] **Step 2: 运行测试确认失败**

Run: `dotnet test Api/ShenLe.Test/ShenLe.Test.csproj -f net8.0 --nologo`
Expected: 编译失败 / FAIL（`CheckCanDeleteUser` 不存在）。

- [ ] **Step 3: 实现纯函数**（加到 `SlAccessPolicy` 类内）

```csharp
/// <summary>
/// 判断能否注销(软删)目标用户。返回 null=可注销；非 null=拒绝原因。
/// 守卫优先级：自己 &gt; 超级管理员(999) &gt; 必须是微信绑定用户(挡框架 PC 账号)。
/// </summary>
/// <param name="targetAccountType">目标账号类型(666/777/888/999)</param>
/// <param name="targetUserId">目标用户Id</param>
/// <param name="currentUserId">当前操作者用户Id</param>
/// <param name="targetHasWxBinding">目标是否有微信绑定(SysWechatUser)</param>
public static string? CheckCanDeleteUser(int targetAccountType, long targetUserId, long currentUserId, bool targetHasWxBinding)
{
    if (targetUserId == currentUserId) return "不能注销自己";
    if (targetAccountType >= 999) return "不能注销超级管理员";
    if (!targetHasWxBinding) return "仅可注销小程序用户";
    return null;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `dotnet test Api/ShenLe.Test/ShenLe.Test.csproj -f net8.0 --nologo`
Expected: PASS（新增 7 条 + 原有 8 条全绿）。

- [ ] **Step 5: 提交**（本地）

---

## Task 3: DeleteUser 端点（软删 + 清申请 + 踢下线）

**Files:**
- Modify: `Api/ShenLe.Application/Service/SlUserManage/SlUserManageService.cs`（在 `SetNickName` 之后、`#endregion` 之前加）

**说明：** 复用现有注入 `_sysUserRep`/`_wxUserRep`/`_accessRep`（构造函数无需改）。DTO 复用 `SlUserIdInput`（`Approve`/`Reject` 同款）。`_accessRep.DeleteAsync` 物理删除（`SlUserAccess : EntityBase`，与 `Approve`/`SetRole` 一致）。

- [ ] **Step 1: 加 DeleteUser 端点**

```csharp
/// <summary>
/// 注销(软删)小程序用户（仅超级管理员）。软删 SysUser、清其申请记录、立即踢下线。
/// </summary>
/// <param name="input">用户Id</param>
[HttpPost("/api/slUserManage/deleteUser")]
[DisplayName("注销用户")]
public async Task DeleteUser(SlUserIdInput input)
{
    SlAuth.RequireSuperAdmin();

    var user = await _sysUserRep.GetByIdAsync(input.UserId) ?? throw Oops.Oh("用户不存在");
    // 注：SysUser 已软删过滤，已注销用户 GetByIdAsync 取不到 → 重复注销返回"用户不存在"（设计如此）。

    // 守卫：自己 / 超管(999) / 非微信绑定(框架PC账号) 不可注销
    var hasWx = await _wxUserRep.IsAnyAsync(w => w.UserId == input.UserId);
    var reason = SlAccessPolicy.CheckCanDeleteUser((int)user.AccountType, user.Id, SlAuth.CurrentUserId(), hasWx);
    if (reason != null)
        throw Oops.Oh(reason);

    // 软删 SysUser（本仓库 DeleteAsync 是物理删除，必须显式置位 IsDelete）
    user.IsDelete = true;
    await _sysUserRep.AsUpdateable(user).UpdateColumns(u => u.IsDelete).ExecuteCommandAsync();

    // 清理其用户权限申请 + 房东申请记录（物理删除），保持待审列表干净
    await _accessRep.DeleteAsync(a => a.UserId == input.UserId);

    // 立即踢下线（拉黑 → 旧 token 下次请求 403 → 前端重登流程接管）
    await SlAuth.ForceRelogin(input.UserId);
}
```

- [ ] **Step 2: 编译**

Run: `dotnet build Api/ShenLe.sln -c Debug --nologo -clp:ErrorsOnly`
Expected: 0 错。

- [ ] **Step 3: 单测回归**

Run: `dotnet test Api/ShenLe.Test/ShenLe.Test.csproj -f net8.0 --nologo`
Expected: 全绿（不退化）。

- [ ] **Step 4: 提交**（本地）

---

## Task 4: Page 防御性软删过滤（belt-and-suspenders，低优先）

**Files:**
- Modify: `Api/ShenLe.Application/Service/SlUserManage/SlUserManageService.cs`（`Page` 方法的查询）

**说明：** 全局过滤器在 999 上下文已生效（`SuperAdminIgnoreIDeletedFilter=false`）+ 注销后旧微信绑定改指新号，故注销用户本就不会出现；此条仅防"将来有人打开 `SuperAdminIgnoreIDeletedFilter`"。`Page` 已有 `w.UserId != 0`，`u` 必为真实用户，加 `!u.IsDelete` 不误伤。`Pending` 不需要（Task 3 已物删申请记录）。

- [ ] **Step 1: Page 查询追加 `!u.IsDelete`**

在 `Page` 的 `.Where((w, u) => w.UserId != 0)` 之后追加一行：

```csharp
            .Where((w, u) => !u.IsDelete) // 防御：注销用户不出现在列表（全局过滤器已覆盖，此为双保险）
```

- [ ] **Step 2: 编译**

Run: `dotnet build Api/ShenLe.sln -c Debug --nologo -clp:ErrorsOnly`
Expected: 0 错。

- [ ] **Step 3: 提交**（本地）

---

## Task 5: 前端 deleteUser API

**Files:**
- Modify: `src/api/user-manage.ts`

- [ ] **Step 1: 加 deleteUser**（仿 `rejectUser`）

```ts
export function deleteUser(userId: ShenLeId) {
  return post<void>('/api/slUserManage/deleteUser', { userId })
}
```

- [ ] **Step 2: 类型检查**

Run: `cd ShenLe_MiniApp_Next && npm run type-check`
Expected: 0 错（`ShenLeId` 已 import）。

- [ ] **Step 3: 提交**

```bash
cd ShenLe_MiniApp_Next && git add src/api/user-manage.ts && git commit -m "feat(user-manage): 注销用户 API"
```

---

## Task 6: 用户管理页"注销"按钮 + 强确认弹窗

**Files:**
- Modify: `src/pages/admin/user-manage/index.vue`

**说明：** 在用户卡片 `.user__actions` 里、角色按钮之后加红色"注销"按钮（`item.accountType < 999` 才显示，与角色按钮同条件）。强确认弹窗 → 调 `deleteUser` → 成功后从 `items` 移除该用户。

- [ ] **Step 1: import 与函数**

`<script setup>` 顶部 import 增加 `deleteUser`：

```ts
import { approveUser, deleteUser, getPendingUsers, getUserPage, rejectUser, setUserNickName, setUserRole } from '@/api/user-manage'
```

加注销函数（放在 `changeRole` 之后）：

```ts
function removeUser(item: SlUserOutput) {
  uni.showModal({
    title: '注销用户',
    content: `确定注销「${item.nickName || '该用户'}」？该用户会立即下线、从列表移除；之后需用微信重新注册才能再次使用。此操作不可在小程序内撤销。`,
    confirmText: '注销',
    confirmColor: '#c94832',
    success: async (res) => {
      if (!res.confirm)
        return
      try {
        await deleteUser(item.userId)
        items.value = items.value.filter(u => String(u.userId) !== String(item.userId))
        total.value = Math.max(0, total.value - 1)
        uni.showToast({ title: '已注销', icon: 'success' })
      }
      catch {}
    },
  })
}
```

- [ ] **Step 2: 模板加按钮**

在 `.user__actions` 里、`ROLE_OPTIONS` 的 `<template v-if="item.accountType < 999">…</template>` **之内、循环之后**加注销按钮（注销同样仅对非超管显示）：

```html
            <template v-if="item.accountType < 999">
              <view
                v-for="opt in ROLE_OPTIONS"
                :key="opt.value"
                class="role-btn"
                :class="{ active: item.accountType === opt.value }"
                @tap="changeRole(item, opt.value)"
              >
                {{ opt.label }}
              </view>
              <view class="role-btn role-btn--danger" @tap="removeUser(item)">
                注销
              </view>
            </template>
```

- [ ] **Step 3: 加样式**（`<style scoped>` 内，仿 `.mini-btn--reject` 配色）

```scss
.role-btn--danger {
  border-color: rgb(201 72 50 / 40%);
  color: #c94832;
}
```

- [ ] **Step 4: 类型检查 + lint**

Run: `cd ShenLe_MiniApp_Next && npm run type-check && npx eslint src/pages/admin/user-manage/index.vue`
Expected: 0 错。

- [ ] **Step 5: 提交**

```bash
cd ShenLe_MiniApp_Next && git add src/pages/admin/user-manage/index.vue && git commit -m "feat(user-manage): 用户卡片注销按钮 + 强确认弹窗"
```

---

## Task 7: 部署 + E2E 验证（等用户 Git/部署指令）

> 后端**不自动部署**。下列在用户给出部署指令后执行。前端体验版须在后端部署之后再上传。

- [ ] **后端部署**：`dotnet publish Api/ShenLe.Web.Entry/ShenLe.Web.Entry.csproj -c Release -f net8.0` → tar → scp → `docker restart shenle-app`；看启动日志无异常、CodeFirst 已给 `SysUser` 加 `IsDelete` 列。
- [ ] **验证列已加**：`docker exec -i shenle-mysql mysql -uroot -p'***' adminnet -e "SHOW COLUMNS FROM SysUser LIKE 'IsDelete';"` → 有该列。
- [ ] **E2E（用 automator/真实 token，已有手段）**：999 注销某微信用户 A →
  1. A 在"用户管理"列表消失；
  2. A 旧 token 调任意鉴权接口 → **403**；前端弹"登录状态已失效，请重新登录"；
  3. A 用同一微信重进 → `needProfile` → 重新注册为 666 新号（**新 userId**）；
  4. DB：旧 `SysUser` 行仍在、`IsDelete=1`（断言**未物理删除**）。
- [ ] **守卫**：注销自己 / 注销 999 / 注销无微信绑定的框架账号(`admin`) → 均被拒；对已注销用户再次注销 → "用户不存在"。
- [ ] **PC 后台不回归**：Admin.NET 后台用户列表隐藏注销用户、不报错；PC"删除用户"仍物理删除（抽查）。
- [ ] **前端体验版**：后端部署确认后，`build:mp:prod` → sync → `cli.bat upload`（版本 0.4.2）。

---

## 提交说明
- 后端各 Task"提交"= 本地准备好；**实际 commit/push/部署等用户明确指示**（`ShenLe` CLAUDE.md 约定）。
- 前端可自主提交；体验版上传须在后端部署之后。
