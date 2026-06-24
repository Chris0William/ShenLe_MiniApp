# 用户软删除（注销）— 设计文档

- 状态: Approved (design) → 待 spec 评审 → 待写计划
- 日期: 2026-06-24
- 关联: 复用 [2026-06-23-force-relogin-on-permission-change](2026-06-23-force-relogin-on-permission-change.md) 的强制重登机制

## 1. 背景与目标

管理端需要"注销用户"能力。要求**软删**（保留数据、可审计/可恢复），**主要落在 `SysUser` 表**上。

注销后的核心语义（已与用户确认）：
- 该用户从"用户管理"列表**消失**；
- **立即被踢下线**（旧 token 失效）；
- `SysUser` 行**保留**（`IsDelete=true`），不物理删除；
- 之后同一微信再进来，视为**全新游客(666)重新注册**一条新记录（"可重新注册"）。

## 2. 关键现状（决定方案的事实）

- `SysUser : EntityBaseTenantOrg`，**没有 `IsDelete` 列**，未实现 `IDeletedFilter`（只有 `*Del` 基类实现）。已有 `Status`(启用/停用) 与 `AccountType`(666/777/888/999) 字段。
- 框架全局软删过滤器：`SqlSugarSetup.cs:259` `db.QueryFilter.AddTableFilter<IDeletedFilter>(u => u.IsDelete == false)`，**对所有实现 `IDeletedFilter` 的实体自动生效**。
- 超管忽略软删过滤的开关 `SuperAdminIgnoreIDeletedFilter` **当前未配置 = 默认 false** → 过滤器对超管也生效（999 的列表、匿名登录都会隐藏注销用户）。
- 登录流程 `SysWxOpenService.WxOpenIdLogin`：`SysWechatUser` 按 OpenId 查、`.Includes(u => u.SysUser)`；判断 `if (wxUser.UserId == 0 || wxUser.SysUser == null)`（**OR**）→ 返回 `needProfile=true`；前端再调 `CompleteProfile`，其 `if (wxUser.UserId > 0 && wxUser.SysUser != null)`（**AND**）为 false → 走 `else` 分支 `CreateSysUserForWxUser` 建新 666 用户并把微信绑定 `UserId` 改指到新号。被软删用户 `UserId` 虽非 0，但 `SysUser==null`（被过滤）即触发 needProfile，逻辑成立。
- `SysWechatUser : EntityBase`（无 `IsDelete`），不需改动。
- **本仓库的 `DeleteAsync` 是物理删除**（已核实）：`SqlSugarRepository<T> : SimpleClient<T>` 未重写删除；AOP（`SqlSugarSetup.SetDbAop`）只处理新增/更新审计字段，**无 `OnExecutingChangeSql` 等 DELETE→UPDATE 改写**；生产库 `sl_community/sl_building/sl_property` 的 `IsDelete=1` 行数均为 0。结论：实现 `IDeletedFilter` **只影响 SELECT 查询过滤器（line 259）**，不改变任何 `DeleteAsync`/`AsDeleteable` 的物理删除行为。`IsDelete` 字段只能靠**显式 `UpdateColumns(IsDelete=true)`** 置位。

## 3. 方案选型

### ✅ 采用：给 `SysUser` 加 `IsDelete` 并实现 `IDeletedFilter`（框架级软删）

唯一能让"注销 + 可重新注册"近乎零成本落地的方案，直接复用框架全局软删过滤器：

- `SysUser` 带 `IsDelete` + `IDeletedFilter` 后，**所有 SysUser 查询自动隐藏注销用户**（列表/统计/登录关联查询都不用改）。
- **"可重新注册"自动成立**：注销用户再登录时 `.Includes(u => u.SysUser)` 被全局过滤器挡掉 → `wxUser.SysUser == null` → 走现有 `needProfile=true` → `CompleteProfile` 新建 666 游客、微信绑定改指新号。**登录代码不改。**
- 旧 `SysUser` 行保留（`IsDelete=true`），审计/可恢复（DB 层）。

### ❌ 不采用

- **复用 `Status=停用`**：微信绑定仍指向停用号，再登录拿的还是停用号 token，给不了"可重新注册"；语义是"停用"非"注销"。
- **独立标记表**：不碰 `SysUser`（与"操作 SysUser 表"诉求不符），且"可重新注册"反而要改登录逻辑（Core），更绕、更易漏。

### 影响范围（已确认接受）

- **改 `ShenLe.Core` 的 `SysUser` 实体**（与历史上加 `AccountType` 同一处、同性质）。
- **框架级影响 = 仅 SELECT 查询过滤器**：实现 `IDeletedFilter` 后，所有 `SysUser` 的查询（含 PC 端 Admin.NET 后台、匿名登录关联查询）自动追加 `WHERE IsDelete=0` → 注销用户在各处列表/登录里被隐藏，正是"注销"语义所需。
- **不改变任何删除行为**（B1 评审结论）：因本仓库 `DeleteAsync` 是物理删除（见 §2），实现 `IDeletedFilter` **不会**把框架已有的两处物理删除（`SysUserService` PC 删用户 `:250`、`SysTenantService` 删租户 `:421`）变成软删，**不会产生孤儿行、不改变其行为**。这两处 Core 逻辑**不修改**。
- 存量影响为零：`IsDelete` 列新增默认 false，所有现有用户 `IsDelete=0`，查询过滤器不会过滤掉任何现有数据；仅本功能 `UpdateColumns` 置位的注销用户被隐藏。

## 4. 详细设计

### 4.1 后端实体（ShenLe.Core）

给 `SysUser` 增加：
```csharp
/// <summary>软删除</summary>
[SugarColumn(ColumnDescription = "软删除")]
public bool IsDelete { get; set; } = false;
```
并让类声明实现 `IDeletedFilter`（`public partial class SysUser : EntityBaseTenantOrg, IDeletedFilter`）。

- 启动 CodeFirst 自动给生产 `SysUser` 表加 `IsDelete` 列（纯追加、默认 false，存量用户 `IsDelete=false` 不受影响，安全）。
- 与其它 `Del` 实体一致地加软删索引 `index_{table}_D`（可选，便于过滤）。

### 4.2 后端注销接口（ShenLe.Application — `SlUserManageService`，与 `SetRole` 同文件同风格）

```
DeleteUser(input)   [HttpPost /api/slUserManage/deleteUser]   RequireSuperAdmin
```
逻辑：
1. `RequireSuperAdmin()`；`GetByIdAsync(input.UserId)`，不存在 → `Oops.Oh("用户不存在")`。
   - 注：`SysUser` 实现 `IDeletedFilter` 后，`GetByIdAsync` 取不到已软删用户（被全局过滤器隐藏）。因此**对已注销用户再次调用本接口会返回"用户不存在"（设计如此，天然防重复注销）**，后续步骤不会重跑（B3 评审项）。
2. **守卫**（= 用户选择"666/777/888 可，999+自己不可"）：
   - `user.Id == SlAuth.CurrentUserId()` → `Oops.Oh("不能注销自己")`；
   - `user.AccountType == AccountTypeEnum.SuperAdmin`(999) → `Oops.Oh("不能注销超级管理员")`；
   - **目标必须是微信绑定用户**（`_wxUserRep.IsAnyAsync(w => w.UserId == input.UserId)` 为真），否则 `Oops.Oh("仅可注销小程序用户")`。
     原因（N5 评审项）：`AccountTypeEnum.SysAdmin == 888`，与小程序"888 管理人员"**同值**，无法靠 AccountType 区分框架 PC 账号（`admin` 等种子用户 = SysAdmin/888）与小程序 888 用户。框架 PC 账号**无微信绑定**，故用"必须有微信绑定"精确放行小程序用户、挡住框架账号（防误删 `admin` 致 PC 后台登录损坏）。
3. **软删**：显式 `AsUpdateable(user).UpdateColumns(u => u.IsDelete).ExecuteCommandAsync()`（`user.IsDelete=true`）。
   - 必须用显式 update：本仓库 `DeleteAsync` 是**物理删除**（§2），会真删行、丢审计、且与"行保留"诉求冲突；显式 update 才是软删。
   - 写入受 `IsAutoUpdateQueryFilter` 影响会在 WHERE 注入 `IsDelete=0`：首次（也是唯一可达）注销时该行 `IsDelete=0` 必命中 → 影响行数 = 1（验证须断言）。重复注销已被第 1 步 `GetByIdAsync` 挡掉，不会出现"0 行静默"。
4. **顺手清理申请/房东记录**：**物理删除**（`_accessRep.DeleteAsync(...)`，`sl_user_access` 是 `EntityBase` 无 `IsDelete`，删除即物理，与现有 `Approve`/`SetRole` 一致——非"软删"）该用户在 `sl_user_access` 的两类记录（`ApplyType==0` 用户权限申请、`ApplyType==1` 房东申请），保持待审列表干净。**名下楼盘 `sl_community` 保留不动**（用户选择）。
5. **立即踢下线**：`await SlAuth.ForceRelogin(input.UserId)`（拉黑 → 旧 token 下次请求 403 → 前端 403 重登流程接管）。注销对象必为非自己，`ForceRelogin` 的"不踢自己"判断不影响。

DTO：复用现有 `SlUserIdInput { UserId }`（`Approve`/`Reject` 同款），或新建 `DeleteSlUserInput : BaseIdInput`。
需在 `SlUserManageService` 注入 `SqlSugarRepository<SysWechatUser> _wxUserRep`（该类已注入 `_wxUserRep` 用于 `Page`，复用即可）。

### 4.3 防御性列表过滤（可选、低优先）

在 `SlUserManageService.Page` 的查询里**显式追加 `IsDelete==false`**（针对关联的 `SysUser`），作为 belt-and-suspenders：当前 `SuperAdminIgnoreIDeletedFilter=false`、且注销后旧微信绑定会被改指到新号（旧软删行天然成孤儿、本就不会出现在列表），所以全局过滤器已足够；显式条件只在将来有人打开 `SuperAdminIgnoreIDeletedFilter` 时才发挥作用。
- 注意：`Page` 从 `SysWechatUser` 起 `LeftJoin SysUser`，加 `IsDelete==false` 不会误伤（已有 `w.UserId != 0`，`u` 不会为 null）。
- `Pending`（`sl_user_access`）**不需要**加：§4.2.4 已物理删除注销用户的申请记录，源头已无该行。

### 4.4 前端（用户管理页，已是 999-only）

- `src/pages/admin/user-manage/index.vue`：每个用户卡片加**"注销"**按钮（红色，与"拒绝"同色系）。
- 强确认弹窗：
  > 确定注销「{昵称}」？该用户会**立即下线**、从列表移除；之后需用微信**重新注册**才能再次使用。此操作不可在小程序内撤销。
- 成功后本地列表移除该用户（`items` 过滤掉）。
- `src/api/user-manage.ts` 增加 `deleteUser(userId)`。

### 4.5 不做（YAGNI）

- 不做小程序内"恢复/还原"按钮（恢复走 DB；功能性恢复 = 让对方重新注册）。
- 不做名下楼盘的转移/级联软删（楼盘保留不动）。
- 不碰 `SysWechatUser`、不改登录代码。

## 5. 验证

1. **编译/单测**：改 `SysUser` 后 `dotnet build ShenLe.sln` 0 错；现有 8 个 `SlAccessPolicyTests` 仍绿；启动无异常（CodeFirst 正确加 `IsDelete` 列）。
2. **软删写入**：注销接口执行后**影响行数 = 1**，DB 中旧 `SysUser` 行仍在、`IsDelete=1`（断言行未被物理删除）。
3. **E2E 软删生效**：999 注销某微信用户 A →
   - A 在"用户管理"列表消失；
   - A 旧 token 调任意鉴权接口 → 403（被踢）；前端弹重新登录；
   - A 用同一微信重进 → `needProfile` → 重新注册为 666 新号（新 userId）；
   - 旧 `SysUser` 行仍在、`IsDelete=1`。
4. **守卫**：注销自己 / 注销 999 / 注销无微信绑定的框架账号(如 `admin`) → 均被拒；对已注销用户再次注销 → "用户不存在"。
5. **PC 后台不回归**：Admin.NET 后台用户列表按预期隐藏注销用户、不报错；**PC 端"删除用户"仍为物理删除**（不因本改动变软删、不产生孤儿行）——抽查确认。

## 6. 已定决策

- 语义：注销 + 可重新注册；`SysUser` 行软删保留（显式 `UpdateColumns(IsDelete=true)`，因 `DeleteAsync` 是物理删除）。
- 可删范围：666/777/888 的**微信绑定用户**可；999、操作者自己、无微信绑定的框架 PC 账号受保护。
- 名下楼盘：保留不动（不级联、不阻止）。
- 实现：`SysUser` 实现 `IDeletedFilter` —— 仅启用 SELECT 查询过滤器（不改任何删除行为，B1 评审已确认无孤儿/无回归）；复用 `ForceRelogin` 踢下线；登录"可重新注册"复用现有 `needProfile`/`CompleteProfile` 流程。
- 不做：小程序内恢复、楼盘级联、改 `SysWechatUser`/登录代码、改框架删除调用点。

## 7. 后端提交约定

后端（`ShenLe`，分支 `admin.net`）改动完成后**停下等用户 Git/部署指令，不自动提交**。前端（`ShenLe_MiniApp_Next`）可自主提交。
