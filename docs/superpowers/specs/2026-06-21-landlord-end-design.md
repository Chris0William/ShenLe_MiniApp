# 深租宝典 · 三端架构 + 房东端 设计文档

- 状态: Approved (brainstorm)，待评审 → 待写实施计划
- 日期: 2026-06-21
- 关联: 本设计建立在已上线的「按接口显式鉴权(SlAuth.RequireXxx)」与「匿名浏览 + 动作登录」之上。

---

## 1. 背景与目标

平台目前有两个「端」：**用户端**(浏览房源)与**管理端**(全量管理)，由 `accountType`(666 游客 / 777 普通 / 888 管理 / 999 超管)这一条整数 ladder 控制。

现在要引入第三个端 —— **房东端**：让房东(二房东)自助管理自己名下的楼盘/楼栋/房源，并向其他用户展示房源的已租/未租状态与浏览热度。

**核心设计判断**：「房东」不是 `accountType` ladder 上的一档，而是与全局档位**正交**的一个独立身份。因此引入三个正交开关，各控一个端，互不耦合。

### 非目标 (YAGNI)
- 不引入通用多角色系统(角色表/用户-角色关联/多角色 claim)。每个用户在全局档位上恰好是 1 种(游客/普通/管理/超管)，房东是唯一的正交叠加位。
- 不做房源状态的真实时推送(WebSocket/SignalR)。用「进页/下拉拉取最新」达成「及时」。
- 不做房东自建楼盘的管理员复审流程(自建即公开)。
- 浏览数不做去重(每次打开 +1)。

---

## 2. 角色与权限模型：三个正交开关

| 开关 | 取值 / 来源 | 控制 | 互斥? |
|---|---|---|---|
| `accountType` | 666/777/888/999(JWT claim) | **用户端**(总有) + **管理端**(≥888 才显) | 互斥(一人一档) |
| `isLandlord` | 独立字段(`sl_landlord` 表，管理员设置) | **房东端**(为真才显) | 正交布尔 |
| `SlCommunity.OwnerId` | 指向某用户 Id | 该房东**管哪些楼盘** | N/A(归属，不是身份) |

关键解耦：
- `accountType` **不再参与**房东判定，只决定「用户端 / 管理端」显隐。
- `isLandlord`(身份) 与 `OwnerId`(归属) **完全解耦** —— 一个刚被设为房东的用户名下可以 0 楼盘，仍能进房东端去自建/接收分配。这解决了「先设房东、他再自己建楼盘」的鸡生蛋问题。
- 三端正交可叠加：`accountType≥888 且 isLandlord` 的用户可在用户/管理/房东三端切换。

「我的」页根据 `(accountType, isLandlord)` 渲染 1~3 个端切换入口。

---

## 3. 需求清单

- **R1** 三端：用户端 / 管理端 / 房东端，正交可叠加，「我的」页切换。
- **R2** 房东身份 = 独立字段，仅管理员可设置；`accountType` 不参与房东判定。
- **R3** 管理端新增「房东管理」界面：① 查看谁是房东 ② 设/取消房东 ③ 给房东分配楼盘(设 OwnerId)。
- **R4** 房东端仅 `isLandlord` 用户可进。
- **R5** 房东端 地图 & 列表：看**全部**楼盘，**高亮 + 筛选**自己的。
- **R6** 房东端「我的」：管理自己楼盘，走 **楼盘 → 楼栋 → 房源 下钻**，不单开楼栋/房源顶级页。
- **R7** 房东可**自建楼盘**、编辑自己的楼盘/楼栋/房源。
- **R8** 房东可控房源 **已租/未租**。
- **R9** 其他用户**进页/下拉时**同步最新已租未租(轻量，无推送)。
- **R10** 记录用户端对房源的浏览，房东可见**总浏览次数**。

---

## 4. 数据模型

### 4.1 新表 `sl_landlord`（房东标记表 = 那个「房东字段」）

用独立表存房东标记，避免改动框架 `SysUser`(ShenLe.Core，约定勿改)。

| 字段 | 类型 | 说明 |
|---|---|---|
| Id | long | 雪花 Id(EntityBaseId 即可) |
| UserId | long | 房东用户 Id(唯一索引) |
| CreateTime / CreateUserId | 审计 | 谁在何时设的(用 EntityBase) |

`isLandlord(userId)` = `sl_landlord` 中存在该 UserId。设/取消 = 插入/删除该行。

### 4.2 `SlCommunity` 增字段

| 字段 | 类型 | 说明 |
|---|---|---|
| OwnerId | `long?` (IsNullable，加索引) | 楼盘所有者用户 Id；null = 无主(历史批量导入，待分配) |

楼栋(`SlBuilding`)/房源(`SlProperty`)**不**单独加 OwnerId，归属顺楼盘继承(按 `CommunityId` → 楼盘 `OwnerId` 判定)。理由：避免改楼盘归属时还要同步楼栋/房源的一致性维护。若后续性能不足再考虑冗余。

### 4.3 新表 `sl_property_view` + `SlProperty.ViewCount`

| `sl_property_view` 字段 | 类型 | 说明 |
|---|---|---|
| Id | long | |
| PropertyId | long | 被浏览房源(加索引) |
| UserId | long | 浏览者(必有，详情需登录) |
| CreateTime | DateTime | 浏览时间 |

`SlProperty` 增 `ViewCount int = 0`(冗余总数)：每次 `recordView` 时 `ViewCount+1` 且插一条 view 记录。列表展示直接读 `ViewCount`，避免 N 次 COUNT。

### 4.4 输出 DTO 增字段

- `SlCommunityOutput` 增 `isMine: bool`(= `OwnerId == 当前用户Id`，服务端算，不暴露 owner 身份给租客)。
- `SlPropertyListOutput` / `SlPropertyOutput` 增 `viewCount: int`。
- `LoginUserOutput`(getUserInfo / 登录返回) **复用已有 `id`**(前端 auth store 已携带，不新增 `userId` 标识) + 增 `isLandlord: bool`。

> 注：`isMine` / `viewCount` 是共享输出 DTO 上的**附加字段**，对用户端/管理端的响应无害(多返回、前端忽略即可)，无需为各端拆分 DTO。

---

## 5. 后端设计

### 5.1 鉴权原语（SlAuth 扩展）

- 已有：`CurrentAccountType()`、`CurrentUserId()`、`RequireNormalUser(≥777)`、`RequireAdmin(≥888)`、`RequireSuperAdmin(≥999)`。
- 新增：
  - `IsLandlord()` → `sl_landlord` 中存在 `CurrentUserId()`。
  - `RequireLandlordOrAdmin()` → `IsLandlord() || CurrentAccountType()≥888`，否则抛「无房东权限」。
  - `RequireCommunityOwnerOrAdmin(communityId)` → `CurrentAccountType()≥888` 放行；否则该楼盘 `OwnerId == CurrentUserId()` 才放行，否则抛「无权操作该楼盘」。
  - 楼栋/房源写操作：先由 `CommunityId` 取所属楼盘，再走 `RequireCommunityOwnerOrAdmin`。

> 房东身份的鉴权以**服务端查 DB / claim** 为准；与 `accountType` 一致，采用 claim + 重登刷新策略(管理员设/取消房东后，房东需重登生效；前端 getUserInfo 实时拿到新值)。归属(OwnerId)类写操作在写入时实时查楼盘 OwnerId，无 claim 滞后问题。

### 5.2 写接口鉴权改造（现状为 RequireAdmin）

| 接口 | 改为 |
|---|---|
| `slCommunity/add` | `RequireLandlordOrAdmin`；房东建时 `OwnerId` 强制 = `CurrentUserId()`，管理员建时按入参(可空/可指定) |
| `slCommunity/update` `delete` | `RequireCommunityOwnerOrAdmin(input.Id)` |
| `slBuilding/add` | `RequireCommunityOwnerOrAdmin(input.CommunityId)`(或 admin) |
| `slBuilding/update` `delete` | 由楼栋 → CommunityId → `RequireCommunityOwnerOrAdmin` |
| `slProperty/add` | `RequireCommunityOwnerOrAdmin(input.CommunityId)` |
| `slProperty/update` `delete` `updateStatus` | 由房源 → CommunityId → `RequireCommunityOwnerOrAdmin` |

普通 777 非房东、非 owner 的用户仍被全部挡住(查不到匹配)。

### 5.3 新接口

**房东管理(管理端 ≥888):**
- `POST /api/slLandlord/page` → 房东列表(join `sl_landlord` + SysUser 取昵称 + 名下楼盘数)。`RequireAdmin`。
- `POST /api/slLandlord/setLandlord` `{ userId, isLandlord }` → 设/取消。`RequireAdmin`。
  - 设为房东：若目标 `accountType < 777`，顺手升 777(房东至少普通用户)。
  - 取消房东：同时把其名下楼盘 `OwnerId` 清空(退回无主)，避免「非房东却挂着楼盘」孤儿态。
- `POST /api/slCommunity/assignOwner` `{ communityId, ownerUserId }` → 设 OwnerId。`RequireAdmin`。
  - 若 `ownerUserId` 尚不是房东，顺手设为房东(并按需升 777)。
- `POST /api/slCommunity/unassignOwner` `{ communityId }` → OwnerId=null。`RequireAdmin`。

**房东自管 / 浏览:**
- 「我的楼盘」列表：复用 `slCommunity/page`/`list` 增可选 `ownerScope=self`，服务端按 `OwnerId=CurrentUserId()` 过滤。
- `POST /api/slProperty/recordView` `{ propertyId }` → 插 view 记录 + `ViewCount+1`。`RequireNormalUser`。**owner 本人 / 管理员自看不计数**(排除 owner 需 `propertyId → CommunityId → 楼盘 OwnerId` 查一次，顺 §4.2 的继承判定)。

### 5.4 作用域查询

- 房东端**地图/列表**：复用现有真实数据接口(房东 ≥777，看真实数据)，输出带 `isMine` 供前端高亮；「只看我的」= 前端过滤 isMine 或后端 `ownerScope=self`。
- 房东端**我的楼盘**：`ownerScope=self`。

> 注：`slCommunity/page` 与 `slCommunity/list` 当前是 `[HttpGet]` + `[FromQuery]`，故 `ownerScope=self` 是加在 `PageSlCommunityInput`/`ListSlCommunityInput` 上的**查询串字段**(GET)，不是 POST body。

---

## 6. 前端设计

### 6.1 mode 与角色判定
- `modeStore.mode: 'user' | 'admin' | 'landlord'`；`readInitialMode` 增 landlord 判定(token + storage 标记 isLandlord + 上次选择)。
- `auth` store 增 `isLandlord` computed(= `user.isLandlord`)。
- 「我的」页端切换入口：用户端(总有)；管理端(`isAdmin`)；房东端(`isLandlord`)。切换走与现有 admin/user 一致的 `setMode + reLaunch(map)`。

### 6.2 tabbar
- `landlordTabbarList = [地图, 房源, 我的]`(三项与用户端相同)。差异在页面行为，不在 tab 结构。

### 6.3 页面复用 + 房东行为
- **地图页 / 房源列表页**：已有 `canManage / isPreviewMode` 分支，增 `mode==='landlord'` 分支：
  - 数据 = 全部楼盘真实数据；
  - 自己的楼盘(`isMine`)**高亮**(不同颜色 marker / 角标)；
  - 顶部「只看我的楼盘」开关 → 筛选；
  - 点 isMine 楼盘 → 进下钻管理；点别人的 → 普通查看。
- **「我的」(房东视图)**：房东资料 + 端切换 +
  - 「我的楼盘」下钻：`我的楼盘列表 → 楼栋列表 → 房间列表 → 编辑/改状态`(复用现有楼盘/楼栋/房源管理页，带 communityId/buildingId 参数 + 房东作用域)。
  - 「新增楼盘」入口(自建，OwnerId 自动)。
  - 房间显示「N 次浏览」；房间卡片「已租/未租」开关 → `updateStatus`。
- **用户端房源详情**：`onLoad` 调 `recordView`；`onShow` 重新拉取 → 状态及时同步。

### 6.4 「已租/未租」与 Status 映射
复用 `SlProperty.Status`(0空置/1预定/2已租/3下架)：房东简单开关在 `未租=0空置 ↔ 已租=2已租` 之间切；1预定/3下架仍由管理端销控使用。

---

## 7. 管理端「房东管理」界面（新）

- 房东列表页：展示已是房东的用户(昵称 + 名下楼盘数)；可「取消房东」。
- 「设为房东」：从用户中选一个设为房东(可复用用户管理的用户选择)。
- 「分配楼盘」：给某房东分配/取消楼盘归属(可在楼盘管理页每个楼盘加「分配房东」操作，或在房东详情里选楼盘)。
- 历史批量导入的楼盘 `OwnerId=null`，逐个分配。(批量分配为 P2 可选。)

---

## 8. 安全与一致性

- 所有房东写操作经 `RequireCommunityOwnerOrAdmin` / `RequireLandlordOrAdmin` 服务端兜底；前端 mode 仅控展示，非安全边界(沿用 JwtHandler 对 APP 放行的既有约束)。
- 取消房东级联清空 OwnerId，杜绝孤儿归属。
- `recordView` 排除 owner / 管理员自看，避免房东自刷浏览数。
- 设为房东自动保证 ≥777，避免「游客房东」无法访问真实数据。

---

## 9. 分期实施

**Phase 1 — 地基 + 可进可看**
1. 数据：`sl_landlord`、`SlCommunity.OwnerId`、输出加 `isMine` / `isLandlord` / `userId`。
2. 后端：`IsLandlord` / `RequireLandlordOrAdmin` / `RequireCommunityOwnerOrAdmin`；房东管理接口(setLandlord / assignOwner / 房东列表)；写接口鉴权改造。
3. 管理端：「房东管理」界面(设房东 / 分配楼盘)。
4. 前端：房东端可进入(mode/tabbar/「我的」端切换)；地图/列表高亮 + 「只看我的」筛选；我的楼盘**只读**下钻。

**Phase 2 — 房东自管 + 浏览/状态**
5. 房东自建楼盘、编辑楼栋/房源(下钻里的增改删)。
6. `sl_property_view` + `ViewCount` + `recordView` + 浏览数展示。
7. 已租/未租开关 + 用户端 `onShow` 状态同步。

---

## 10. 已定决策（确认项）

- 「标注」= 视觉高亮(颜色/角标)，非笔记备注。
- 房东自建楼盘**立即公开**，无管理员复审。
- 浏览数**每次打开 +1，不去重**。
- 单一所有者/楼盘(非共有)。
- 房东身份用独立字段(`sl_landlord` 表)显式控制，与 accountType、OwnerId 均解耦。

---

## 11. 开放/后续（不阻塞）

- 楼盘批量分配房东(P2+)。
- 房源级冗余 OwnerId(仅当 join 性能不足时)。
- 浏览数去重 / 时间趋势(若房东需要)。
- 房东端楼盘审核流程(若后续要管控自建质量)。
