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
- 登录流程 `SysWxOpenService.WxOpenIdLogin`：`SysWechatUser` 按 OpenId 查、`.Includes(u => u.SysUser)`；若 `wxUser.SysUser == null` → 返回 `needProfile=true`；前端再调 `CompleteProfile`，其 `else` 分支 `CreateSysUserForWxUser` 建新 666 用户并把微信绑定 `UserId` 改指到新号。
- `SysWechatUser : EntityBase`（无 `IsDelete`），不需改动。

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
- **框架级影响**：PC 端 Admin.NET 后台同样会隐藏/软删注销用户，并使 `SysUser` 的 `DeleteAsync` 变软删——对"注销"语义而言正是预期。

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
1. `RequireSuperAdmin()`；取用户，不存在 → `Oops.Oh("用户不存在")`。
2. **守卫**（= 用户选择"666/777/888 可，999+自己不可"）：
   - `user.Id == SlAuth.CurrentUserId()` → `Oops.Oh("不能注销自己")`；
   - `user.AccountType == AccountTypeEnum.SuperAdmin`(999) → `Oops.Oh("不能注销超级管理员")`。
3. **软删**：显式 `AsUpdateable(user).UpdateColumns(u => u.IsDelete).ExecuteCommandAsync()`（`user.IsDelete=true`）。
   - 用显式 update 而非 `DeleteAsync`：语义明确（保证行保留）、不依赖框架 delete 的软删实现细节。
4. **顺手清理申请/房东记录**：软删该用户在 `sl_user_access` 的两类记录（`ApplyType==0` 用户权限申请、`ApplyType==1` 房东申请），保持待审列表干净；防止与重新注册后的新 userId 数据混淆。**名下楼盘 `sl_community` 保留不动**（用户选择）。
5. **立即踢下线**：`await SlAuth.ForceRelogin(input.UserId)`（拉黑 → 旧 token 下次请求 403 → 前端 403 重登流程接管）。注销对象必为非自己，`ForceRelogin` 的"不踢自己"判断不影响。

DTO：复用现有 `SlUserInput { UserId }`（与 `SetNickName`/`Approve` 等同款），或新建 `DeleteSlUserInput : BaseIdInput`。

### 4.3 防御性列表过滤

在 `SlUserManageService.Page` 与 `getPendingUsers` 的查询里**显式追加 `IsDelete==false`**（针对 `SysUser` 关联）。即使将来有人把 `SuperAdminIgnoreIDeletedFilter` 打开，999 的列表也绝不漏出注销用户。

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

1. **编译/单测**：改 `SysUser` 后 `dotnet build ShenLe.sln` 0 错；现有 8 个 `SlAccessPolicyTests` 仍绿；启动无异常（CodeFirst 正确加列）。
2. **E2E 软删生效**：999 注销某用户 A →
   - A 在"用户管理"列表消失；
   - A 旧 token 调任意鉴权接口 → 403（被踢）；前端弹重新登录；
   - A 用同一微信重进 → `needProfile` → 重新注册为 666 新号（新 userId）；
   - DB 中旧 `SysUser` 行仍在、`IsDelete=1`。
3. **守卫**：注销自己 / 注销 999 → 被拒。
4. **PC 后台**：Admin.NET 后台用户列表按预期隐藏注销用户、不报错。

## 6. 已定决策

- 语义：注销 + 可重新注册；`SysUser` 行软删保留。
- 可删范围：666/777/888 可；999 与操作者自己受保护。
- 名下楼盘：保留不动（不级联、不阻止）。
- 实现：`SysUser` 实现 `IDeletedFilter`（框架级软删，PC 后台同步生效）；复用 `ForceRelogin` 踢下线；登录"可重新注册"复用现有 `needProfile`/`CompleteProfile` 流程。
- 不做：小程序内恢复、楼盘级联、改 `SysWechatUser`/登录代码。

## 7. 后端提交约定

后端（`ShenLe`，分支 `admin.net`）改动完成后**停下等用户 Git/部署指令，不自动提交**。前端（`ShenLe_MiniApp_Next`）可自主提交。
