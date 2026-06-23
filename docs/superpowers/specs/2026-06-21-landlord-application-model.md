# 深租宝典 · 房东(申请制 / 无付费)— 设计文档 v2

- 状态: Approved (brainstorm)，待评审 → 待写实施计划
- 日期: 2026-06-21
- **取代**: `2026-06-21-landlord-end-design.md`(原"管理员手点标记"模型)。订阅/到期/付费方案已废弃,不做。
- 关联: 建立在已实现但**未提交/未推送**的 Phase 1 代码之上(后端工作树 + 前端 `refactor/unibest-wot-next` 本地提交 `c31be88..5813d57`)。本文档是对那批代码的**修正**。

---

## 1. 背景与目标

引入第三个端「房东端」。房东是平台上自助管理自己楼盘/楼栋/房源的用户。关键约束(本轮最终版):

- **房东身份通过"申请→999 超管审批"获得**,不是管理员手点,也**没有任何付费/订阅/到期**概念。
- 纯房东(非管理员)**锁定在房东端**:打开小程序直接进,不能切到用户端/管理端。
- 房东**只能看到自己名下的楼盘数据**。
- 管理员(888+)**豁免**:仍可三端自由切换。

### 角色标签(本轮调整,数值不变)
| 等级 | 名称 |
|---|---|
| 666 | 游客 |
| 777 | **业务员**(=普通用户) |
| 888 | **管理人员** |
| 999 | 超级管理员 |

### 非目标 (YAGNI)
- 不做订阅、到期时间、续费、微信支付、套餐/价格。
- 不做多角色表。房东仍是与 accountType 正交的**单一标记**。
- 房东端不单开楼栋/房源顶级页(走楼盘→楼栋→房源下钻,沿用 Phase 1)。

---

## 2. 角色与所有权模型

两个正交维度(与 Phase 1 相同,只是房东的"获取方式"与"端访问规则"改了):

| 开关 | 取值 / 来源 | 控制 |
|---|---|---|
| `accountType` | 666/777/888/999(JWT claim) | 用户端(总有) + 管理端(≥888) |
| `isLandlord` | `sl_landlord` 标记(申请→999 审批获得) | 房东端 |
| `SlCommunity.OwnerId` | 指向某用户 | 该房东管哪些楼盘 |

- `isLandlord` 与 accountType 解耦:审批通过时若用户 <777 顺带升 777(房东至少业务员)。
- 房东端是**强制**的:纯房东(非管理员)打开即进房东端,无端切换 UI。

---

## 3. 获取房东 = 申请审批(复用现有申请管线)

现有 `sl_user_access` 表 + `SlAccessService`(Apply/MyStatus) + `SlUserManageService`(Pending/Approve/Reject) 已实现"游客 666 申请升 777"。**扩展它支持两种申请类型**,而非另造一套:

- `sl_user_access` 加 `ApplyType int`:**0=用户权限申请**(游客→777),**1=房东申请**。
- `Apply(applyType)`:写一条对应类型的申请(状态 1 待审核)。同一用户同一类型只保留一条活跃申请。
- `MyStatus()` 返回:`accountType`、`applyStatus`(类型0)、`isLandlord`、`landlordApplyStatus`(类型1)。
- 审批(999):
  - 类型0(用户权限):现有逻辑,通过→升 777,删申请记录。
  - 类型1(房东):通过→插 `sl_landlord` 标记 + 保证 ≥777,删申请记录;拒绝→状态 3。
- **谁能申请房东**:任意登录用户(含游客 666),审批通过顺带升 ≥777。

### 申请入口(前端)
- **入口①**:申请页 `pages/common/apply/index.vue`(游客申请用户权限那页)加第二个按钮「**申请成为房东**」。
- **入口②**:业务员(777)的「我的」(用户端视图)加「**申请成为房东**」。
- 已是房东 / 已有待审房东申请 → 入口显示对应状态(申请中/已是房东),不可重复申请。

---

## 4. 房东访问规则

- **强制进房东端**:`readInitialMode` —— `isLandlord && !isAdmin` → 恒返回 `'landlord'`(忽略上次保存的 mode)。管理员仍按保存值,可切换。
- **隐藏端切换**:房东端「我的」对**非管理员房东**不显示任何"切用户端/切管理端";若该房东同时是 888+(豁免),才显示切换。
- **只看自己**:房东端地图/列表 **`ownerScope=self` 恒定**。移除 Phase 1 的「只看我的」开关与金色高亮(既然只看自己,不需要高亮区分)。
- **写鉴权**:沿用 Phase 1 `RequireCommunityOwnerOrAdmin`(管理员 或 该楼盘 owner)。无订阅,无需活跃判定。
- **楼盘来源**:自己建(`RequireLandlordOrAdmin`,OwnerId 强制归己)+ 999 分配(`assignOwner`),**都保留**。

---

## 5. 管理端(全部 999 超管 only)

- **用户列表**(已有,999):用户 + **用户权限申请**(ApplyType=0)待审红点 + 审批/拒绝。
- **房东列表**(新,999):房东 + 名下楼盘数 + **房东申请**(ApplyType=1)待审红点 + 审批/拒绝 + 撤销房东 + 分配楼盘。
- **权限收紧**:Phase 1 把房东管理放在 888,本轮**全部移到 999**(`SlLandlordService` 的列表/审批/撤销、`assignOwner`/`unassignOwner` 改 `RequireSuperAdmin`)。888 管理人员不碰房东管理。

---

## 6. 数据模型

- `sl_landlord`(沿用 Phase 1 简单标记):`UserId`(唯一)。**不加**订阅字段。
- `sl_user_access` 加 `ApplyType int`(0/1)。
- `SlCommunity.OwnerId`(Phase 1 已加)。
- 输出:`MyAccessOutput` 加 `isLandlord` + `landlordApplyStatus`;`SlCommunityOutput.IsMine`(Phase 1 已加,房东端只看自己时可不强调,但保留无害)。

---

## 7. 后端接口

- `slAccess/apply` 加 `applyType` 入参(默认 0)。
- `slAccess/myStatus` 输出加 `isLandlord` + `landlordApplyStatus`。
- 房东管理(`SlLandlordService`,**全部 RequireSuperAdmin 999**):
  - `page` 房东列表(沿用,改 999)
  - `pendingApplications` 房东待审申请列表(ApplyType=1, 状态1)
  - `approveLandlord(userId)` 通过 → 插标记 + 升≥777 + 删申请
  - `rejectLandlord(userId)` 拒绝 → 申请置状态3
  - `revokeLandlord(userId)`(= 原 setLandlord(false))撤销标记 + 清其 OwnerId
  - `assignOwner` / `unassignOwner` 改 **RequireSuperAdmin**
- 用户管理(`SlUserManageService`):Pending/Approve/Reject 加 ApplyType=0 过滤(只管用户权限申请)。

---

## 8. 前端

- `auth` store:`isLandlord`(已有)+ 从 `myStatus` 取 `landlordApplyStatus`。
- `mode.ts`:`readInitialMode` 强制——`isLandlord && !isAdmin` → `'landlord'`。
- mine 页:
  - 非管理员房东视图:**移除端切换**;保留「我的楼盘」入口。
  - 业务员(777,非房东)用户视图:加「申请成为房东」(据 landlordApplyStatus 显示申请中/可申请)。
  - 管理员:三端切换照旧(含房东端若其也是房东)。
  - 角色标签更新(777 业务员 / 888 管理人员)。
- apply 页:加「申请成为房东」按钮(applyType=1),据状态显示。
- map/list:landlord 模式 → `ownerScope=self` 恒定;**移除**「只看我的」开关与高亮。
- landlord-manage 页:守卫 888→**999**;加**房东待审申请**区 + 审批/拒绝;撤销改 revoke。
- api:`applyLandlord`、`getLandlordPending`、`approveLandlord`、`rejectLandlord`、`revokeLandlord`;`myStatus` 类型扩展。

---

## 9. 对 Phase 1 代码的处置(均未提交/未推送)

| 保留 ✅ | 改造 🔧 | 废弃 ❌ |
|---|---|---|
| `sl_landlord` 标记、`OwnerId`、`SlAccessPolicy`、`RequireCommunityOwnerOrAdmin`、`RequireLandlordOrAdmin`、`ownerScope`、`IsLandlord`、mode/tabbar 接入、my-communities 下钻、interceptor 房东放行 | landlord-manage 与 `SlLandlordService`/`assignOwner` 守卫 888→999;`setLandlord` 手点 → 审批驱动(approve/revoke);`sl_user_access` 加 ApplyType + 双申请;mine 隐藏房东切端、加业务员申请入口;map/list 改只看自己(去高亮/筛选);apply 加申请房东按钮;角色标签 | 三端自由切换给纯房东;map/list 看全部+高亮+「只看我的」开关;**订阅/到期/付费(本就没做)** |

---

## 10. 分期

- **P1(本计划)**:第 3–9 节全部 —— 申请审批拿房东、访问收紧、999 双列表、角色标签。一次做完即可上线。
- 后续(另议):房东端楼盘/楼栋/房源的完整增删改下钻打磨、批量分配等。

---

## 11. 已定决策

- 房东 = 申请审批的单一标记,无付费/订阅/到期。
- 任意登录用户(含游客)可申请房东,通过顺带升 ≥777。
- 申请用扩展 `sl_user_access` + `ApplyType`,不新建表。
- 纯房东锁房东端、只看自己;管理员(888+)豁免。
- 用户列表与房东列表均 999-only。
- 角色:666 游客 / 777 业务员 / 888 管理人员 / 999 超管。
