# 房东端 Phase 1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地三端架构的地基 —— 管理员能把用户设为房东并给房东分配楼盘，房东能进入房东端、在地图/列表里高亮+筛选自己的楼盘、只读下钻查看「我的楼盘→楼栋→房源」。

**Architecture:** 三个正交开关：`accountType`(用户/管理端显隐) + `sl_landlord` 表(房东端) + `SlCommunity.OwnerId`(归属)。后端用显式 `SlAuth.RequireXxx()` 兜底鉴权(JwtHandler 对 APP 放行)；前端 `modeStore` 增 `landlord` 模式、复用现有页面按 mode 改行为。

**Tech Stack:** 后端 .NET 8 / Admin.NET / Furion / SqlSugar(CodeFirst 自动建表)；前端 uni-app + Vue3 `<script setup>` + pinia + 自定义 tabBar。

**关联 spec:** `docs/superpowers/specs/2026-06-21-landlord-end-design.md`(§编号下引用该 spec)。

---

## 验证约定（本项目实际手段，替代标准单测 harness）

- **后端纯逻辑**(鉴权决策、状态映射)：在 `ShenLe/Api/ShenLe.Test` 写 xunit 单测(仿现有 `Utils/SafeMathTests.cs`)。把"给定 accountType/isLandlord/ownerId/currentUserId → 允许/拒绝"抽成**纯函数** `SlAccessPolicy`，先写失败测试再实现。
- **后端集成/接口**：`dotnet build ShenLe.sln` 编译通过 + 用不同身份 token `curl` 生产/本地接口断言允许/拒绝(本会话已验证可行：token 取自模拟器 `wx.getStorageSync('shenle_token')` 或 DB 造)。
- **前端**：`pnpm type-check`(vue-tsc) + `npx eslint`(0 error) + 编译产物 `dist/build/mp-weixin/**/*.wxml` grep 断言 + 模拟器 automator 脚本(harness 在 `C:/Users/Administrator/AppData/Local/Temp/wx-automator-test/`)。
- 后端仓库改动**完成后停下等用户 Git 指令**(ShenLe 仓库约定)；前端可自主提交。

---

## File Structure（Phase 1 改动地图）

**后端 ShenLe(新增)**
- `Api/ShenLe.Application/Entity/SlLandlord.cs` — 房东标记实体
- `Api/ShenLe.Application/Helper/SlAccessPolicy.cs` — 纯鉴权决策函数(可单测)
- `Api/ShenLe.Application/Service/SlLandlord/SlLandlordService.cs` — 房东管理服务
- `Api/ShenLe.Application/Service/SlLandlord/Dto/SlLandlordDto.cs` — DTO
- `Api/ShenLe.Test/Landlord/SlAccessPolicyTests.cs` — 纯逻辑单测

**后端 ShenLe(修改)**
- `Api/ShenLe.Application/Entity/SlCommunity.cs` — 加 `OwnerId long?`
- `Api/ShenLe.Application/Helper/SlAuth.cs` — 加 `IsLandlord/RequireLandlordOrAdmin/RequireCommunityOwnerOrAdmin`
- `Api/ShenLe.Application/Service/SlCommunity/SlCommunityService.cs` — add/update/delete 改鉴权、Page/List 加 `ownerScope`、输出加 `isMine`、新增 `assignOwner/unassignOwner`
- `Api/ShenLe.Application/Service/SlCommunity/Dto/SlCommunityDto.cs` — `SlCommunityOutput.IsMine`、`PageSlCommunityInput.OwnerScope`、`AssignOwnerInput`
- `Api/ShenLe.Application/Service/SlBuilding/SlBuildingService.cs` — add/update/delete 改 `RequireCommunityOwnerOrAdmin`
- `Api/ShenLe.Application/Service/SlProperty/SlPropertyService.cs` — add/update/delete/updateStatus 改 `RequireCommunityOwnerOrAdmin`
- `Api/ShenLe.Core/Service/Auth/SysAuthService.cs`(或 GetUserInfo 所在) — 输出加 `isLandlord`

**前端 ShenLe_MiniApp_Next(新增)**
- `src/api/landlord.ts` — 房东管理 API
- `src/pages/admin/landlord-manage/index.vue` — 管理端房东管理页
- `src/pages/landlord/my-communities/index.vue` — 房东「我的楼盘」入口(只读下钻)

**前端(修改)**
- `src/store/mode.ts` — `AppMode` 加 `'landlord'`、`readInitialMode` 支持
- `src/store/auth.ts` — `isLandlord` computed、user 输出字段
- `src/tabbar/config.ts` — `landlordTabbarList`
- `src/tabbar/store.ts`(若按 mode 选 list) — 房东 mode 用 landlord list
- `src/pages/admin/mine/index.vue` — 端切换增「房东端」入口 + 房东视图入口
- `src/pages/user/map/index.vue` — landlord 模式 `isMine` 高亮 +「只看我的」筛选
- `src/pages/admin/property-list/index.vue` — 同上(列表)
- `src/api/community.ts` / `src/api/user-manage.ts` — 接 `ownerScope`、房东管理接口
- `src/types/shenle.ts` — 类型补 `isMine/isLandlord/ownerScope` 等

---

## 后端任务

### Task 1: `SlLandlord` 实体 + `SlCommunity.OwnerId`

**Files:**
- Create: `Api/ShenLe.Application/Entity/SlLandlord.cs`
- Modify: `Api/ShenLe.Application/Entity/SlCommunity.cs`

- [ ] **Step 1: 写 SlLandlord 实体**

```csharp
namespace ShenLe.Application;

/// <summary>
/// 房东标记表（有记录=该用户是房东，身份与 accountType 正交，由管理员设置）
/// </summary>
[SugarTable("sl_landlord", "房东标记表")]
[SugarIndex("index_{table}_U", nameof(UserId), OrderByType.Asc, true)] // 唯一
public class SlLandlord : EntityBase
{
    /// <summary>房东用户Id</summary>
    [SugarColumn(ColumnDescription = "房东用户Id")]
    public long UserId { get; set; }
}
```

- [ ] **Step 2: 给 SlCommunity 加 OwnerId**

在 `SlCommunity.cs` 的 `RegionId` 字段后加：

```csharp
    /// <summary>
    /// 楼盘所有者用户Id（null=无主，待管理员分配；与房东身份解耦，仅表示归属）
    /// </summary>
    [SugarColumn(ColumnDescription = "楼盘所有者用户Id", IsNullable = true)]
    public long? OwnerId { get; set; }
```

并在类上加索引(类的 `[SugarIndex...]` 处下一行)：

```csharp
[SugarIndex("index_{table}_O", nameof(OwnerId), OrderByType.Asc)]
```

- [ ] **Step 3: 编译验证（CodeFirst 启动时自动建表/加列）**

Run: `cd "e:/WorkSpace/WorkSpace-MiniApp/深乐租项目/ShenLe/Api" && dotnet build ShenLe.sln -c Debug --nologo -clp:ErrorsOnly`
Expected: 0 错误。

- [ ] **Step 4: 提交（停下等用户 Git 指令，仅本地）** — 见末尾"后端提交说明"。

---

### Task 2: 纯鉴权决策 `SlAccessPolicy` + 单测（TDD）

把"能否操作某楼盘 / 能否当房东建楼盘"的决策抽成无副作用纯函数，便于单测；`SlAuth` 的 Require 方法取数据后调用它。

**Files:**
- Create: `Api/ShenLe.Application/Helper/SlAccessPolicy.cs`
- Modify: `Api/ShenLe.Test/ShenLe.Test.csproj`（加对 ShenLe.Application 的引用）
- Test: `Api/ShenLe.Test/Landlord/SlAccessPolicyTests.cs`

- [ ] **Step 0: 让测试工程能引用 ShenLe.Application（否则测试编不过）**

`ShenLe.Test.csproj` 当前只 `ProjectReference` 了 `ShenLe.Core`。在其 `<ItemGroup>` 里补一行(`SlAccessPolicy` 在 Application，按"业务写 Application"约定不放 Core)：

```xml
<ProjectReference Include="..\ShenLe.Application\ShenLe.Application.csproj" />
```

- [ ] **Step 1: 写失败测试**

```csharp
using ShenLe.Application;
using Xunit;

namespace ShenLe.Test.Landlord;

public class SlAccessPolicyTests
{
    // 管理员(≥888)对任意楼盘可写
    [Theory]
    [InlineData(888, false, 999L, 1L, true)]   // admin, 非owner -> 允许
    [InlineData(999, false, 999L, 1L, true)]
    public void Admin_CanWriteAnyCommunity(int accountType, bool isLandlord, long ownerId, long currentUserId, bool expected)
        => Assert.Equal(expected, SlAccessPolicy.CanWriteCommunity(accountType, isLandlord, ownerId, currentUserId));

    // 非管理员：仅当是该楼盘 owner 才可写
    [Theory]
    [InlineData(777, true, 5L, 5L, true)]    // owner 本人
    [InlineData(777, true, 5L, 6L, false)]   // 房东但非该楼盘 owner
    [InlineData(777, false, 5L, 5L, true)]   // 即便没房东标记，owner 仍可改自己名下(归属即权)
    [InlineData(666, false, 5L, 5L, true)]   // 注：owner 一定≥777(设房东时已升级)，此行仅验证逻辑分支
    public void NonAdmin_CanWriteOnlyOwnCommunity(int accountType, bool isLandlord, long ownerId, long currentUserId, bool expected)
        => Assert.Equal(expected, SlAccessPolicy.CanWriteCommunity(accountType, isLandlord, ownerId, currentUserId));

    // 自建楼盘：管理员 或 有房东标记
    [Theory]
    [InlineData(888, false, true)]
    [InlineData(777, true, true)]
    [InlineData(777, false, false)] // 普通用户非房东不能自建
    public void CanCreateCommunity_RequiresLandlordOrAdmin(int accountType, bool isLandlord, bool expected)
        => Assert.Equal(expected, SlAccessPolicy.CanCreateCommunity(accountType, isLandlord));
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd "e:/WorkSpace/WorkSpace-MiniApp/深乐租项目/ShenLe/Api" && dotnet test ShenLe.Test/ShenLe.Test.csproj --filter "FullyQualifiedName~SlAccessPolicyTests" -f net8.0`
Expected: 编译失败 / 测试失败(SlAccessPolicy 不存在)。

- [ ] **Step 3: 实现 SlAccessPolicy**

```csharp
namespace ShenLe.Application;

/// <summary>
/// 房东/归属相关的纯鉴权决策（无副作用，便于单测）。
/// 角色：≥888 管理员对全量可写；非管理员仅对自己 OwnerId 的楼盘可写。
/// </summary>
public static class SlAccessPolicy
{
    /// <summary>能否写某楼盘（及其楼栋/房源）</summary>
    public static bool CanWriteCommunity(int accountType, bool isLandlord, long? ownerId, long currentUserId)
        => accountType >= 888 || (ownerId.HasValue && ownerId.Value == currentUserId);

    /// <summary>能否自建新楼盘</summary>
    public static bool CanCreateCommunity(int accountType, bool isLandlord)
        => accountType >= 888 || isLandlord;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: 同 Step 2。Expected: 全部 PASS。

- [ ] **Step 5: 提交**（本地，等用户 Git 指令）

---

### Task 3: `SlAuth` 鉴权方法（取数据 + 调 policy）

**Files:**
- Modify: `Api/ShenLe.Application/Helper/SlAuth.cs`

> SlAuth 是静态类，需要查 `sl_landlord` / `SlCommunity`。用 `App.GetRequiredService<SqlSugarRepository<T>>()` 取仓储(Furion 容器)。

- [ ] **Step 1: 加方法**

```csharp
// using ShenLe.Application;（实体同命名空间）
// 顶部需要：using SqlSugar; using Furion;

/// <summary>当前用户是否房东（sl_landlord 有记录）</summary>
public static bool IsLandlord()
{
    var uid = CurrentUserId();
    if (uid == 0) return false;
    return App.GetRequiredService<SqlSugarRepository<SlLandlord>>()
        .IsAny(x => x.UserId == uid);
}

/// <summary>要求房东或管理员（自建楼盘用）</summary>
public static void RequireLandlordOrAdmin()
{
    if (!SlAccessPolicy.CanCreateCommunity(CurrentAccountType(), IsLandlord()))
        throw Oops.Oh("无房东权限");
}

/// <summary>要求某楼盘的 owner 或管理员（改/删该楼盘及其楼栋/房源用）</summary>
public static void RequireCommunityOwnerOrAdmin(long communityId)
{
    var accountType = CurrentAccountType();
    if (accountType >= 888) return; // 管理员放行，免查
    var ownerId = App.GetRequiredService<SqlSugarRepository<SlCommunity>>()
        .AsQueryable().Where(c => c.Id == communityId).Select(c => c.OwnerId).First();
    if (!SlAccessPolicy.CanWriteCommunity(accountType, false, ownerId, CurrentUserId()))
        throw Oops.Oh("无权操作该楼盘");
}
```

- [ ] **Step 2: 编译验证**

Run: `dotnet build ShenLe.sln -c Debug --nologo -clp:ErrorsOnly`
Expected: 0 错误。

- [ ] **Step 3: 提交**（本地）

---

### Task 4: `SlLandlordService` 房东管理服务

**Files:**
- Create: `Api/ShenLe.Application/Service/SlLandlord/SlLandlordService.cs`
- Create: `Api/ShenLe.Application/Service/SlLandlord/Dto/SlLandlordDto.cs`

- [ ] **Step 1: DTO**

```csharp
namespace ShenLe.Application;

public class PageSlLandlordInput : BasePageInput { public string? Keyword { get; set; } }

public class SlLandlordOutput
{
    public long UserId { get; set; }
    public string? NickName { get; set; }
    public int AccountType { get; set; }
    public int CommunityCount { get; set; } // 名下楼盘数
}

public class SetLandlordInput { public long UserId { get; set; } public bool IsLandlord { get; set; } }
```

- [ ] **Step 2: Service（page / setLandlord）**

```csharp
using Microsoft.AspNetCore.Authorization;
using System.ComponentModel;

namespace ShenLe.Application;

/// <summary>房东管理（管理端 ≥888）</summary>
[ApiDescriptionSettings(Order = 185, Name = "SlLandlord", Description = "房东管理")]
public class SlLandlordService : IDynamicApiController, ITransient
{
    private readonly SqlSugarRepository<SlLandlord> _rep;
    private readonly SqlSugarRepository<SlCommunity> _communityRep;
    private readonly SqlSugarRepository<SysUser> _userRep;

    public SlLandlordService(SqlSugarRepository<SlLandlord> rep,
        SqlSugarRepository<SlCommunity> communityRep, SqlSugarRepository<SysUser> userRep)
    { _rep = rep; _communityRep = communityRep; _userRep = userRep; }

    /// <summary>房东分页列表</summary>
    [HttpGet("/api/slLandlord/page")]
    [DisplayName("房东分页列表")]
    public async Task<SqlSugarPagedList<SlLandlordOutput>> Page([FromQuery] PageSlLandlordInput input)
    {
        SlAuth.RequireAdmin();
        return await _rep.AsQueryable()
            .LeftJoin<SysUser>((l, u) => l.UserId == u.Id)
            .WhereIF(!string.IsNullOrWhiteSpace(input.Keyword), (l, u) => u.NickName.Contains(input.Keyword!))
            .OrderBy((l, u) => l.CreateTime, OrderByType.Desc)
            .Select((l, u) => new SlLandlordOutput
            {
                UserId = l.UserId,
                NickName = u.NickName,
                AccountType = (int)u.AccountType,
                CommunityCount = SqlFunc.Subqueryable<SlCommunity>().Where(c => c.OwnerId == l.UserId && !c.IsDelete).Count()
            })
            .ToPagedListAsync(input.Page, input.PageSize);
    }

    /// <summary>设/取消房东</summary>
    [UnitOfWork]
    [HttpPost("/api/slLandlord/setLandlord")]
    [DisplayName("设置/取消房东")]
    public async Task SetLandlord(SetLandlordInput input)
    {
        SlAuth.RequireAdmin();
        var user = await _userRep.GetByIdAsync(input.UserId) ?? throw Oops.Oh("用户不存在");
        if (input.IsLandlord)
        {
            // 房东至少 777
            if ((int)user.AccountType < 777)
            {
                user.AccountType = AccountTypeEnum.NormalUser;
                await _userRep.AsUpdateable(user).UpdateColumns(u => u.AccountType).ExecuteCommandAsync();
            }
            if (!await _rep.IsAnyAsync(x => x.UserId == input.UserId))
                await _rep.InsertAsync(new SlLandlord { UserId = input.UserId });
        }
        else
        {
            // 取消房东：级联清空其名下楼盘归属，避免孤儿
            await _communityRep.AsUpdateable()
                .SetColumns(c => new SlCommunity { OwnerId = null }).Where(c => c.OwnerId == input.UserId).ExecuteCommandAsync();
            await _rep.DeleteAsync(x => x.UserId == input.UserId);
        }
    }
}
```

- [ ] **Step 3: 编译验证** — `dotnet build ...`，0 错误。
- [ ] **Step 4: 提交**（本地）

---

### Task 5: 楼盘归属分配 + ownerScope + isMine

**Files:**
- Modify: `Api/ShenLe.Application/Service/SlCommunity/SlCommunityService.cs`
- Modify: `Api/ShenLe.Application/Service/SlCommunity/Dto/SlCommunityDto.cs`

- [ ] **Step 1: DTO 改动**

`SlCommunityOutput` 加：
```csharp
    /// <summary>是否当前用户名下楼盘（服务端算，不暴露 owner 身份）</summary>
    public bool IsMine { get; set; }
```
`PageSlCommunityInput` / `ListSlCommunityInput` 加：
```csharp
    /// <summary>归属过滤：self=只看我名下；为空=全量</summary>
    public string? OwnerScope { get; set; }
```
新增：
```csharp
public class AssignOwnerInput { public long CommunityId { get; set; } public long OwnerUserId { get; set; } }
public class UnassignOwnerInput { public long CommunityId { get; set; } }
```

- [ ] **Step 2: Page/List 加 ownerScope 过滤 + isMine 投影**

在 `Page` 与 `List` 的查询里：
```csharp
var meId = SlAuth.CurrentUserId();
// ... .WhereIF(input.OwnerScope == "self" && meId > 0, u => u.OwnerId == meId)
// 投影里：IsMine = u.OwnerId != null && u.OwnerId == meId
```
> 注意：`slCommunity/page` 与 `list` 是 `[HttpGet]`+`[FromQuery]`，`OwnerScope` 是查询串字段(spec §5.4)。`Page` 现有 `SlAuth.RequireNormalUser()` 保留(房东/用户都是 ≥777)。

- [ ] **Step 3: add 改鉴权 + 房东建时强制 OwnerId**

`Add` 把 `SlAuth.RequireAdmin()` 改为：
```csharp
SlAuth.RequireLandlordOrAdmin();
var entity = input.Adapt<SlCommunity>();
if (SlAuth.CurrentAccountType() < 888) entity.OwnerId = SlAuth.CurrentUserId(); // 房东自建强制归己
```
`Update`/`Delete` 把 `RequireAdmin()` 改为 `SlAuth.RequireCommunityOwnerOrAdmin(input.Id);`

- [ ] **Step 4: 新增 assignOwner / unassignOwner**

```csharp
/// <summary>分配楼盘归属（管理端）</summary>
[UnitOfWork]
[HttpPost("/api/slCommunity/assignOwner")]
[DisplayName("分配楼盘归属")]
public async Task AssignOwner(AssignOwnerInput input)
{
    SlAuth.RequireAdmin();
    var c = await _rep.GetByIdAsync(input.CommunityId) ?? throw Oops.Oh("楼盘不存在");
    var user = await App.GetRequiredService<SqlSugarRepository<SysUser>>().GetByIdAsync(input.OwnerUserId)
        ?? throw Oops.Oh("用户不存在");
    if ((int)user.AccountType < 777) { user.AccountType = AccountTypeEnum.NormalUser;
        await App.GetRequiredService<SqlSugarRepository<SysUser>>().AsUpdateable(user).UpdateColumns(u => u.AccountType).ExecuteCommandAsync(); }
    var llRep = App.GetRequiredService<SqlSugarRepository<SlLandlord>>();
    if (!await llRep.IsAnyAsync(x => x.UserId == input.OwnerUserId))
        await llRep.InsertAsync(new SlLandlord { UserId = input.OwnerUserId }); // 分配即设为房东
    c.OwnerId = input.OwnerUserId;
    await _rep.AsUpdateable(c).UpdateColumns(x => x.OwnerId).ExecuteCommandAsync();
}

/// <summary>取消楼盘归属（管理端）</summary>
[HttpPost("/api/slCommunity/unassignOwner")]
[DisplayName("取消楼盘归属")]
public async Task UnassignOwner(UnassignOwnerInput input)
{
    SlAuth.RequireAdmin();
    await _rep.AsUpdateable().SetColumns(c => new SlCommunity { OwnerId = null })
        .Where(c => c.Id == input.CommunityId).ExecuteCommandAsync();
}
```

> 注：`AssignOwner`(本 Task) 与 `SlLandlordService.SetLandlord`(Task 4) 都有"确保目标用户 ≥777 + 在 `sl_landlord` 有行"的逻辑。建议抽一个共享私有方法 `EnsureLandlord(long userId)`(放 SlLandlordService 或一个 `LandlordHelper`)供两处调用，避免两份逻辑漂移。非阻塞，可在实现时顺手做。

- [ ] **Step 5: 编译验证** — `dotnet build`，0 错误。
- [ ] **Step 6: 接口集成断言**（本地起服务或部署后）

用三种 token 验证(token 造法见会话记忆)：
- 管理员 token → `assignOwner` 200；`slCommunity/update` 任意楼盘 200。
- 房东A token → `update` 自己楼盘 200；`update` 别人楼盘 → `无权操作该楼盘`。
- 普通777非房东 token → `slCommunity/add` → `无房东权限`。

- [ ] **Step 7: 提交**（本地）

---

### Task 6: 楼栋/房源写接口改鉴权

**Files:**
- Modify: `Api/ShenLe.Application/Service/SlBuilding/SlBuildingService.cs`
- Modify: `Api/ShenLe.Application/Service/SlProperty/SlPropertyService.cs`

- [ ] **Step 1: SlBuilding** add/update/delete 把 `SlAuth.RequireAdmin()` 改为按所属楼盘校验：
  - `Add(input)`：`SlAuth.RequireCommunityOwnerOrAdmin(input.CommunityId);`
  - `Update`/`Delete`：先 `var b = await _slBuildingRep.GetByIdAsync(input.Id) ?? throw Oops.Oh("楼栋不存在"); SlAuth.RequireCommunityOwnerOrAdmin(b.CommunityId);`

- [ ] **Step 2: SlProperty** add/update/delete/updateStatus 同理：
  - `Add(input)`：`SlAuth.RequireCommunityOwnerOrAdmin(input.CommunityId);`
  - `Update`/`Delete`/`UpdateStatus`：先取房源 → `SlAuth.RequireCommunityOwnerOrAdmin(p.CommunityId);`

- [ ] **Step 3: 编译验证** — `dotnet build`，0 错误。
- [ ] **Step 4: 提交**（本地）

---

### Task 7: 前端获取 isLandlord（走 myStatus，不碰框架层）

`LoginUserOutput` 与 `GetUserInfo` 都在 `ShenLe.Core/Service/Auth/`(框架层，CLAUDE.md 标注"勿改")。因此**首选**在 `ShenLe.Application` 的现有 `SlAccessService.MyStatus`(申请流程已用，前端 `getMyAccess` 已接)里加 `isLandlord`，避免改 Core。

**Files:**
- Modify: `Api/ShenLe.Application/Service/SlAccess/SlAccessService.cs`（`MyStatus`）
- Modify: `Api/ShenLe.Application/Service/SlAccess/Dto/SlAccessDto.cs`（MyStatus 输出 DTO 加 `IsLandlord`）

- [ ] **Step 1:** 给 MyStatus 的输出 DTO **`MyAccessOutput`**(在 `Service/SlAccess/Dto/SlAccessDto.cs`) 加 `public bool IsLandlord { get; set; }`；`MyStatus` 里查并赋值：
```csharp
var isLandlord = await App.GetRequiredService<SqlSugarRepository<SlLandlord>>()
    .IsAnyAsync(x => x.UserId == SlAuth.CurrentUserId());
// output.IsLandlord = isLandlord;  // output 即 MyAccessOutput 实例
```
前端在登录成功后 / app 启动时调一次 `myStatus`，把 `isLandlord` 并入 auth user(见 Task 8)。

- [ ] **Step 2: 编译 + curl 验证** `slAccess/myStatus` 返回含 `isLandlord`。
- [ ] **Step 3: 提交**（本地）

> 备选(不推荐，触碰框架层)：给 `ShenLe.Core/Service/Auth/Dto/LoginUserOutput.cs` 加 `IsLandlord`、在 `SysAuthService.GetUserInfo` 赋值。仅当不愿新增 myStatus 调用时用。另注：小程序登录 claim 实际在 `SysWxOpenService.cs` 组装，将来若要把 `isLandlord` 做成 JWT claim 改那里。

---

## 前端任务

### Task 8: mode / auth store / tabbar 接入 landlord

**Files:**
- Modify: `src/store/mode.ts`, `src/store/auth.ts`, `src/tabbar/config.ts`, `src/types/shenle.ts`

- [ ] **Step 1:** `mode.ts`：`export type AppMode = 'user' | 'admin' | 'landlord'`。`readInitialMode` 增 landlord 分支：`saved==='landlord' && !!token && user?.isLandlord ? 'landlord' : ...`。**关键：landlord 只看 `user?.isLandlord`，与 accountType 完全无关，不要写成 `>=888`**(房东正交于全局档位)。admin 分支仍是 `>=888`，两者独立判断。
- [ ] **Step 2:** `auth.ts`：加 `const isLandlord = computed(() => !!user.value?.isLandlord)` 并导出。`isLandlord` 来源是 `slAccess/myStatus`(Task 7)——在登录成功(`applyWxSession`)与 `refreshUser` 后调一次 `myStatus`，把 `isLandlord` 合并进 `user.value` 并写 storage(`SHENLE_USER_KEY`)，这样 `mode.ts` 冷启动能从 storage 读到。`types/shenle.ts` 的 user 类型加 `isLandlord?: boolean`。
- [ ] **Step 3:** `tabbar/config.ts`：`export const landlordTabbarList = [MAP_TAB, PROPERTY_TAB, MINE_TAB]`。tabbar 运行时按 `modeStore.mode` 选 list(找到现有按 mode 选 user/admin list 的位置，加 landlord 分支)。
- [ ] **Step 4: 验证** `pnpm type-check` 0 错 + `npx eslint src/store src/tabbar` 0 错。
- [ ] **Step 5: 提交**

---

### Task 9: 「我的」端切换增加房东端

**Files:**
- Modify: `src/pages/admin/mine/index.vue`

- [ ] **Step 1:** 用户视图(`v-else` 块)增「切换到房东端」入口，`v-if="auth.isLandlord"`，点击：
```ts
function toLandlord() {
  modeStore.setMode('landlord'); tabbarStore.setCurIdx(0)
  uni.reLaunch({ url: '/pages/user/map/index' })
}
```
房东视图(`mode==='landlord'`)：显示「我的楼盘」入口(跳 `/pages/landlord/my-communities/index`)、「新增楼盘」(P2)、切回用户端/管理端(若 isAdmin)。
- [ ] **Step 2: 验证** type-check + eslint。
- [ ] **Step 3: 提交**

---

### Task 10: 管理端「房东管理」页

**Files:**
- Create: `src/api/landlord.ts`, `src/pages/admin/landlord-manage/index.vue`
- Modify: `src/pages/admin/mine/index.vue`（管理入口加「房东管理」，`v-if isAdmin`）、`pages.json`（注册新页，标题「房东管理」）

- [ ] **Step 1:** `api/landlord.ts`：`getLandlordPage`、`setLandlord(userId,isLandlord)`、`assignOwner(communityId,ownerUserId)`、`unassignOwner(communityId)`。
- [ ] **Step 2:** 页面：房东列表(昵称+名下楼盘数+取消)；「设为房东」选用户(可复用用户管理列表/搜索)；某房东下「分配楼盘」(选楼盘 → assignOwner)。
- [ ] **Step 3: 验证** type-check + eslint + 模拟器：管理员进入该页，设一个用户为房东、分配一个楼盘，断言接口 200。
- [ ] **Step 4: 提交**

---

### Task 11: 地图/列表 landlord 高亮 +「只看我的」

**Files:**
- Modify: `src/pages/user/map/index.vue`, `src/pages/admin/property-list/index.vue`, `src/api/community.ts`, `src/types/shenle.ts`

- [ ] **Step 1:** community 接口与类型接 `ownerScope` 入参、`isMine` 出参。
- [ ] **Step 2:** 地图页 `mode==='landlord'` 时：marker 用 `isMine` 区分高亮(自己的换色/角标)；顶部加「只看我的楼盘」开关 → 重新 `loadCommunities`(带 `ownerScope='self'` 或前端按 isMine 过滤已加载数据)。列表页同理(卡片标记 + 筛选)。
- [ ] **Step 3: 验证** type-check + eslint + 构建 + `dist` wxml grep + 模拟器：房东端地图能看到全部楼盘、自己的高亮、切「只看我的」后只剩自己的。
- [ ] **Step 4: 提交**

---

### Task 12: 房东「我的楼盘」只读下钻

**Files:**
- Create: `src/pages/landlord/my-communities/index.vue`（楼盘列表 `ownerScope=self`）
- 复用现有楼栋/房源管理页(带 communityId/buildingId 参数)做下钻展示(P1 只读，编辑入口 P2 开)

- [ ] **Step 1:** my-communities 列出 `ownerScope=self` 的楼盘 → 点进 → 楼栋列表(复用 building-manage 只读模式)→ 点进 → 房间列表(复用 community-properties)。P1 不渲染增改删按钮。
- [ ] **Step 2:** `pages.json` 注册。
- [ ] **Step 3: 验证** type-check + eslint + 模拟器：房东进「我的楼盘」能逐级看到自己名下楼盘→楼栋→房源。
- [ ] **Step 4: 提交**

---

### Task 13: 端到端联调（P1 验收）

- [ ] 部署后端(本会话已验证流程)；前端构建上传/模拟器。
- [ ] 用 999 管理员把某 777 用户设为房东并分配一个楼盘 → 该用户重登 → 「我的」出现「切换到房东端」。
- [ ] 进房东端：地图/列表看到全部楼盘、自己的高亮、「只看我的」筛选可用；「我的楼盘」下钻可看自己名下楼栋/房源。
- [ ] 鉴权断言：该房东 `update` 自己楼盘 200、别人楼盘被拒；普通777非房东 `add` 被拒。
- [ ] 记录验收结果，进入 Phase 2 计划。

---

## 后端提交说明

ShenLe 仓库约定"完成开发任务后停下等用户 Git 指令"。各后端 Task 的"提交"= 本地准备好 commit 内容，但**实际 `git commit`/`push`/部署等用户明确指示**。前端可自主提交。

## 非本计划范围（Phase 2 另起计划）

房东自建楼盘/编辑楼栋房源(开放下钻的增改删)、`sl_property_view`+`ViewCount`+`recordView`+浏览数展示、已租/未租开关 + 用户端 onShow 状态同步。
