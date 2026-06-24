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

### 3.1 helper
在 `SlAuth`(或一个小 helper)加:
```csharp
/// <summary>把用户加入登录黑名单，强制其下次请求重新登录（权限变更后用）</summary>
public static void ForceRelogin(long userId)
{
    if (userId <= 0 || userId == CurrentUserId()) return; // 不踢自己
    var cache = App.GetRequiredService<SysCacheService>();
    var expire = App.GetRequiredService<SysConfigService>().GetTokenExpire().GetAwaiter().GetResult();
    cache.Set($"{CacheConst.KeyBlacklist}{userId}", "perm-changed", TimeSpan.FromSeconds(expire));
}
```
- TTL = token 有效期(到期自动失效,防止用户一直不重登导致永久残留;登录清除是主路径)。
- **不踢操作者自己**(改自己时跳过)。
- 验证 `SysCacheService.Set(key, value, TimeSpan)` 与 `SysConfigService.GetTokenExpire()` 的真实签名,按需调整取值方式(避免 `.GetAwaiter().GetResult()` 死锁——若在 async 方法里调用,改为传入已 await 的 expire,或让 ForceRelogin 为 async)。

### 3.2 在"会改 accountType / 房东状态"的端点调用 ForceRelogin(目标用户)
- `SlUserManageService.SetRole`(改 accountType)← **核心场景**
- `SlUserManageService.Approve`(用户权限申请 666→777,token 仍 666 需刷新)
- `SlLandlordService.ApproveLandlord`(可能升 777 + 变房东)
- `SlLandlordService.SetLandlord(false)` / 撤房东(房东状态变,需踢出房东端)
- 纯拒绝(`Reject` / `RejectLandlord`,不改角色)**不踢**。

### 3.3 登录时清黑名单(关键,不能漏)
`SysWxOpenService.wxOpenIdLogin`(以及 `completeProfile`)发完新 token、确定 `sysUser.Id` 后:
```csharp
App.GetRequiredService<SysCacheService>().Remove($"{CacheConst.KeyBlacklist}{sysUser.Id}");
```
> `ShenLe.Core` 是框架层(约定勿改)。`SysWxOpenService` 在 ShenLe.Core —— 若不便改,退路:在 `ShenLe.Application` 提供一个登录后调用的清除点,或在前端登录成功后调一个 `slAccess` 下的"清自己黑名单"接口(需匿名+仅清自己)。**优先直接在 wxOpenIdLogin 清;不行再走 Application 兜底。**(实现时先确认 wxOpenIdLogin 能否最小改动。)

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
