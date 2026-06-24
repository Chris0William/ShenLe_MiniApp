# 权限变更后强制重新登录 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** 管理员改用户权限(accountType / 房东)后,目标用户被强制重新登录,新权限立即生效。

**Architecture:** 复用 Admin.NET 黑名单(`sys_blacklist:{userId}`):权限变更处把目标用户拉黑 → 其下次请求被 `JwtHandler` 踢 401 → 前端已有 401 重登流程接管 → 重登拿新 token,登录时清黑名单。

**关联 spec:** `docs/superpowers/specs/2026-06-23-force-relogin-on-permission-change.md`

**起点/约束:** 后端在 `e:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe\Api`,分支 `admin.net`(已是干净已推送状态)。本计划后端改动**完成后停下等用户 Git/部署指令,不自动提交**。验证:`dotnet build ShenLe.sln`(0 错)+ 现有 8 单测保持 + 部署后 E2E。

---

## Task 1: `SlAuth.ForceRelogin` 异步 helper

**File:** `ShenLe.Application/Helper/SlAuth.cs`

- [ ] **Step 1:** 加 async 方法(**所有调用方都是 async,直接 await,禁止 `.GetAwaiter().GetResult()`**):
```csharp
/// <summary>把用户加入登录黑名单，强制其下次请求重新登录（权限变更后用）</summary>
public static async Task ForceRelogin(long userId)
{
    if (userId <= 0 || userId == CurrentUserId()) return; // 不踢操作者自己
    // GetTokenExpire() 返回“分钟”，必须 FromMinutes（否则黑名单 TTL 60x 过短）
    var minutes = await App.GetRequiredService<SysConfigService>().GetTokenExpire();
    App.GetRequiredService<SysCacheService>()
        .Set($"{CacheConst.KeyBlacklist}{userId}", "perm-changed", TimeSpan.FromMinutes(minutes));
}
```
- 确认 `using`/全局 using 覆盖 `SysCacheService`/`SysConfigService`/`CacheConst`(它们在 ShenLe.Core,ShenLe.Application 已引用 Core)。`App.GetRequiredService<SysConfigService>()` 与 `<SysCacheService>()` 可用(JwtHandler 即如此)。读 `JwtHandler.cs` 确认确切类型名/命名空间。
- [ ] **Step 2: 编译** `dotnet build ShenLe.sln -c Debug --nologo -clp:ErrorsOnly` → 0 错。
- [ ] **Step 3: 提交**（本地,等用户 Git 指令）

---

## Task 2: 在权限变更端点调用 ForceRelogin

**Files:** `ShenLe.Application/Service/SlUserManage/SlUserManageService.cs`、`ShenLe.Application/Service/SlLandlord/SlLandlordService.cs`

**先读这几个方法**确认它们的目标用户字段(多为 `input.UserId`)与是否 async(都是 `async Task`,可直接 `await`)。

- [ ] **Step 1 — SetRole**(改 accountType,核心场景):在成功改完角色后加 `await SlAuth.ForceRelogin(input.UserId);`
- [ ] **Step 2 — Approve**(用户权限申请 666→777):在升 777 成功后加 `await SlAuth.ForceRelogin(input.UserId);`
- [ ] **Step 3 — ApproveLandlord**:`EnsureLandlord` 后加 `await SlAuth.ForceRelogin(input.UserId);`(若用户原 <777 会升 777,token 需刷新;已 777 时重登一次无害,保持简单无条件调)
- [ ] **Step 4 — SetLandlord**:
  - `IsLandlord==true`(可能升 777)→ `await SlAuth.ForceRelogin(input.UserId);`
  - `IsLandlord==false`(撤房东)→ 也 `await SlAuth.ForceRelogin(input.UserId);`(借重登刷新 myStatus,立刻把人踢出房东端;非 token 必需但符合"撤了立刻生效")
- [ ] **不动** `Reject` / `RejectLandlord`(不改角色)。
- [ ] **Step 5: 编译** 0 错 + `dotnet test ... SlAccessPolicyTests`(8 过)。
- [ ] **Step 6: 提交**（本地）

---

## Task 3: 登录时清黑名单（两条 mint-token 路径）

**File:** `ShenLe.Core/Service/Wechat/SysWxOpenService.cs`

> ShenLe.Core 约定勿改,但这是纯 DI + 一行清除,属可接受最小改动。**两条都发新 token 的路径都要清,漏一个对应路径登录后仍被黑名单挡。**

- [ ] **Step 1:** 给 `SysWxOpenService` 构造函数注入 `SysCacheService _sysCacheService`(该类已注入多个服务,照其风格加一个)。
- [ ] **Step 2:** 在 `WxOpenIdLogin` **已认证、发 token 的那个 return**(取到 `var sysUser = wxUser.SysUser;` 之后、`return` 之前)加:
```csharp
_sysCacheService.Remove($"{CacheConst.KeyBlacklist}{sysUser.Id}");
```
⚠️ **`WxOpenIdLogin` 有一个 `needProfile:true` 的提前 return 分支(不发 token、无 sysUser)——那里不要加 Remove**(会 NRE/userId=0)。只在认证成功、有 `sysUser` 的 return 路径加。
- [ ] **Step 3:** 在 `CompleteProfile`(也 mint token)同样在拿到 `sysUser.Id`、return 前加同一行。读两个方法确认 `sysUser` 变量名与位置。
- [ ] **Step 4: 编译** 0 错。
- [ ] **Step 5: 提交**（本地）

---

## Task 4: 部署 + E2E 验证（等用户 Git/部署指令）

- [ ] 部署后端(publish→scp→docker restart),看启动无错。
- [ ] E2E(用 automator + 真实 token,已有手段):
  1. 用 999 账号给某用户 A `setRole` 改 accountType。
  2. 用 A 的**旧 token** 调任意鉴权接口(如 `slCommunity/page`)→ 应得 **401**(被黑名单踢)。
  3. A 重新登录(`wxOpenIdLogin`)→ 拿到带新 accountType 的 token + 黑名单已清。
  4. 用新 token 调接口 → 正常(200),旧权限已失效、新权限生效。
  - 注:测试用 999 自己的账号操作时,改的是“别的 userId”;若手头只有 999 一个账号,可让用户在 DB 造一个 A,或对 999 自己改角色(注意 ForceRelogin 不踢自己——验证“不踢自己”这条也算一个用例)。

## 提交说明
后端各 Task“提交”=本地准备,**实际 commit/push/部署等用户明确指示**。
