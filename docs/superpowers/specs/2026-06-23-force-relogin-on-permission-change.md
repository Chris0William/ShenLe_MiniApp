# 权限变更后强制重新登录 — 设计文档

- 状态: Approved (design) → 待评审 → 待写计划
- 日期: 2026-06-23

## 1. 背景与问题

小程序鉴权是 JWT claim 制:`accountType` 在登录时写进 token。管理员改某用户权限(如撤管理员 888→777、审批游客 666→777、设/撤房东)后,该用户**手里的旧 token 仍带旧 claim**,最长扛到 token 过期(7 天)。今天只能"线下通知重登"。

目标:**权限一变,目标用户被强制重新登录**,新权限立即生效。

## 2. 机制(复用 Admin.NET 现成黑名单,不造轮子)

`JwtHandler.HandleAsync`(`ShenLe.Web.Core/Handlers/JwtHandler.cs:34`)每次鉴权先查缓存黑名单 `sys_blacklist:{userId}`(`CacheConst.KeyBlacklist`),命中即 `context.Fail()` → 401。`SysUserService` 已用 `SysCacheService.Set/Remove` 操作它(框架自带"强退"能力)。

**强制重登 = 把目标用户加进黑名单**:
1. 目标用户下次任意请求 → JwtHandler 命中黑名单 → 401。
2. 前端已有 401 处理(`request.ts` → `shenle:unauthorized` → 清 token + 走重登)接管。
3. 用户重新登录(`wxOpenIdLogin` 是匿名接口,不查黑名单,能登)→ 拿到**带新 claim 的 token**。
4. **登录成功时清掉该用户黑名单**,否则新 token 也会被黑名单挡掉。

> 这是"拉"模型:目标用户**下次发请求**才被踢。在线用户基本下个动作就触发,够"及时"。真·实时推送(SignalR 主动弹下线)是后续可选项,小程序要常驻 WebSocket,较重,本期不做。

## 3. 后端改动

### 3.1 helper（async，避免死锁；TTL 用分钟）
在 `SlAuth` 加 **async** 方法(所有调用方都是 async,直接 await,**不要用 `.GetAwaiter().GetResult()`**——会死锁):
```csharp
/// <summary>把用户加入登录黑名单，强制其下次请求重新登录（权限变更后用）</summary>
public static async Task ForceRelogin(long userId)
{
    if (userId <= 0 || userId == CurrentUserId()) return; // 不踢操作者自己
    // GetTokenExpire() 返回的是“分钟”（与 JWTEncryption 用法一致），务必用 FromMinutes，
    // 否则 7 天 token 会变成 7 分钟黑名单，用户等几分钟就能绕过。
    var minutes = await App.GetRequiredService<SysConfigService>().GetTokenExpire();
    App.GetRequiredService<SysCacheService>()
        .Set($"{CacheConst.KeyBlacklist}{userId}", "perm-changed", TimeSpan.FromMinutes(minutes));
}
```
- `SysCacheService`(ISingleton)与 `SysConfigService` 经 `App.GetRequiredService<>()` 取(`JwtHandler` 即如此用,模式成立)。
- TTL = token 有效期(到期自动失效;登录清除是主路径)。**不踢操作者自己。**
- 调用方:`await SlAuth.ForceRelogin(targetUserId);`

### 3.2 调用 ForceRelogin(目标用户) 的端点

**关键区分**:`accountType` 在 JWT claim 里(改了必须重登才生效);**房东身份不在 JWT**——`SlAuth.IsLandlord()` 每次实时查 DB,前端 `isLandlord` 来自 `myStatus`(实时)。所以:

- **accountType 变化 → 必须 ForceRelogin**(token claim 过期):
  - `SlUserManageService.SetRole`(改 accountType)← **核心场景(撤管理员)**
  - `SlUserManageService.Approve`(用户权限申请 666→777)
  - `SlLandlordService.ApproveLandlord` / `SetLandlord(true)`:内部 `EnsureLandlord` 仅当用户 <777 时升 777——**这种情况 accountType 变了,必须重登**;若已是 777 则 token 不变。可**无条件调 ForceRelogin**(已正确的 token 重登一次无害,实现更简单),也可判断"确实升了 777"再调。
- **房东身份变化(不改 accountType)→ ForceRelogin 为体验优化(非安全必需)**:
  - `SlLandlordService.SetLandlord(false)` / 撤房东:后端写操作本就 live-check(撤了就拒),但前端 `isLandlord` 是缓存的,踢一次重登能让其**立刻退出房东端**(重登后 `myStatus` 返回非房东)。**纳入触发,标注其作用是"借重登刷新 myStatus 踢出房东端",而非 token 必需。**
- 纯拒绝(`Reject` / `RejectLandlord`,不改任何角色)**不踢**。

### 3.3 登录时清黑名单(关键,不能漏)

`SysWxOpenService`(ShenLe.Core)给两条**都会发新 token** 的登录路径清黑名单:`WxOpenIdLogin` 与 `CompleteProfile`(两者都 mint token,都要清,漏一个就会让对应路径登录后仍被挡)。

**做法**:给 `SysWxOpenService` 构造函数注入 `SysCacheService`(该类已注入多个服务,加一个是纯 DI、非业务逻辑,在"勿改 Core"原则下属可接受的最小改动),在两个方法发完 token、拿到 `sysUser.Id` 后:
```csharp
_sysCacheService.Remove($"{CacheConst.KeyBlacklist}{sysUser.Id}");
```
> 兜底(仅当坚决不动 Core 时):前端登录成功后调一个 `ShenLe.Application` 里的匿名"清自己黑名单"接口(只清当前 openId 对应用户)。**优先直接注入清除,不走兜底。**

## 4. 前端改动(很小)

- 已有 401 → 重登流程,直接复用,**多数情况无需改动**。
- 可选:后端黑名单 Fail 时返回可识别的 message,前端在 401 时若识别为"权限变更"则提示「您的权限已变更,请重新登录」,否则沿用"登录已过期"。本期可不做。

## 5. 非目标 (YAGNI)
- 不做 SignalR 实时推送下线。
- 不改前端 401 处理的核心逻辑(已能用)。

## 6. 验证

改某用户角色 → 用其**旧 token** 调任意鉴权接口 → 应得 401 → 重登 → 新 claim 生效、黑名单已清。可用 automator + 真实 token 端到端验(已有手段)。

## 7. 已定决策
- 用黑名单 + 现有 401 重登,不上实时推送。
- ForceRelogin 不踢操作者本人;TTL=token 有效期;登录时清除为主路径。
- 触发端点:SetRole / Approve(用户权限) / ApproveLandlord / 撤房东;纯拒绝不触发。
