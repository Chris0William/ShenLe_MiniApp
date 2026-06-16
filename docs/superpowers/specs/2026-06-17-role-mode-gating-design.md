# 角色模式门控设计（用户端 / 管理端，单版本 B 方案）

> 状态：已与用户对齐，待评审 → 实施。
> 日期：2026-06-17

## 目标（Goal）

在**同一个已发布小程序**内，用一个全局模式状态区分"用户端 / 管理端"，而不是靠微信发版渠道（体验版/正式版）区分。所有浏览页面单一来源、两端共用，差异**只**体现在三处：tab 集、共享页上的管理按钮显隐、管理端独有页的可达性。

## 背景与现状

- 当前整个小程序被 888 强门控：入口=地图，tabbar=管理端 5 项，未登录/非 888 一律拦在登录页（"仅管理员可使用"）。
- 浏览 UI 的实际承载者是 `src/components/` 下的共享组件（地图、`sl-property-filter-bar`、`sl-property-card`、`sl-community-card`、详情等），两端早已共用；"用户端页面 / 管理端页面"只是薄入口壳。
- `src/pages/user/home`（找房，房源优先）是历史孤岛，本方案**弃用并删除**——两端统一走管理端的"楼盘列表优先"浏览模型。
- 后端对每个管理接口已强制校验 888（接口层 + 路由守卫）。前端 mode 仅控制 UX，安全由后端兜底，本轮不改后端。

## 核心架构

### 模式状态

新增全局模式：`mode: 'user' | 'admin'`，存于 pinia（复用或扩展 `store/auth` 或新建 `store/app`），并持久化到 storage。

- **默认**：所有人首次进入 = `user`。
- **记忆**：888 用户的 `mode` 持久化；下次打开恢复上次模式（管理员上次在管理端，下次直接进管理端）。
- **非 888**：`mode` 恒为 `user`，无切换入口；即使 storage 残留 `admin` 也在读取时强制纠正为 `user`（防止降权后残留）。

### Tab 集（随 mode 切换）

- 用户模式：`地图 / 房源 / 我的`（3 项）
- 管理模式：`工作台 / 房源 / 销控 / 地图 / 我的`（5 项）

实现：`src/tabbar/config.ts` 暴露两套 `customTabbarList`（userTabbarList / adminTabbarList）；`src/tabbar/store.ts` 的 `tabbarList` 改为 computed，依据 `mode` 返回对应集合，并在切换时重置 `curIdx`。`pages.config.ts` 的原生 `tabBar.list`（用于占位/启动页合法性）取两套的并集或保持自定义 tabbar 策略不依赖它。

> 注意：自定义 tabBar（CUSTOM_TABBAR 策略）下，tab 页仍必须在 `pages.json` 注册且原生 tabBar 至少声明合法 list。切换 tab 集本质是切换自定义组件渲染的数组，不改 `pages.json`。

### 共享页面（两端同一份，按 mode 显隐）

| 页面 | 用户模式 | 管理模式 |
|------|---------|---------|
| 地图 `pages/user/map` | 楼盘卡仅"查看房源" | 多"编辑楼盘" |
| 房源（楼盘列表）`pages/admin/property-list` | 只读：刷楼盘→进楼盘看房源→看详情；**无**新增 FAB | 新增 FAB + 进楼盘可管理 |
| 楼盘房源列表 `pages/common/community-properties` | 只读列表 + 媒体；**只展示可租房源（status 0 空置 / 1 预定）**；无新增/编辑/状态/删除 | 全状态 + 管理操作 |
| 房源详情 `pages/common/property-detail` | 只读 | 可编辑入口 |

> 房源 tab 在两个模式下都叫"房源"，都是楼盘列表优先（用户确认）。

### 管理端独有页（用户模式不放 tab、不可达）

工作台 `admin/dashboard`、销控 `admin/sales-control`、楼盘管理 `common/community-manage`、楼栋管理 `common/building-manage`、区域管理 `common/region-manage`、标签管理 `common/tag-manage`、房源表单 `common/property-form`。

### "我的"页

- 用户模式：`pages/user/mine` 展示用户向内容（登录/资料），888 用户额外显示"切换到管理端"入口。
- 管理模式：`pages/admin/mine` 展示管理入口，顶部/底部显示"切换到用户端"入口。
- 切换动作：设 `mode`，持久化，`reLaunch` 到目标模式的首 tab（用户端→地图，管理端→工作台 或上次页）。

### 登录与门控调整（`router/interceptor.ts` + `login`）

- **放开用户端**：`PROTECTED_PATHS` 移除用户可浏览的路径（地图、房源列表、楼盘房源、详情），改为公开。
- **管理端仍 888 门控**：管理独有页 + 共享页的管理动作入口，要求 `isLogin && isAdmin`。
- **切到管理端时**：若未登录 → 走微信授权登录；登录后非 888 → 提示"仅管理员可使用管理端"，留在用户端（不再像现在那样把人踢死）。
- 登录页 `common/login`：去掉"整个 app 仅管理员"的拦死逻辑，改为"用于进入管理端的授权"；普通用户浏览不触发登录。

## 数据流

- 进入小程序 → 读 storage 的 mode（非 888 纠正为 user）→ tabbar 渲染对应集合 → 落在该模式首 tab。
- 共享页通过 `mode`（或 `auth.isAdmin && mode==='admin'`）的计算属性 `canManage` 控制按钮/FAB/筛选可见性与列表过滤（用户模式 community-properties 仅请求/展示可租房源）。
- 切模式 → 写 storage → reLaunch。

## 影响文件清单

- 修改：`src/tabbar/config.ts`（两套 tab 集）、`src/tabbar/store.ts`（mode 驱动 computed）、`src/tabbar/index.vue`（如需）
- 新增或扩展：模式 store（`store/app.ts` 或扩展 `store/auth.ts`）
- 修改：`src/router/interceptor.ts`（放开用户端、管理端门控）
- 修改：`src/pages/common/login/index.vue`（授权进管理端，不再拦死）
- 修改：`src/pages/user/map/index.vue`、`src/pages/admin/property-list/index.vue`、`src/pages/common/community-properties/index.vue`、`src/pages/common/property-detail/index.vue`（canManage 显隐 + 用户模式仅可租房源）
- 修改：`src/pages/user/mine/index.vue`、`src/pages/admin/mine/index.vue`（双向切换入口）
- 删除：`src/pages/user/home/`（弃用的找房页）
- 入口/启动页：地图为首页（已是 `type:'home'`），保持。

## 不在本轮范围（明确 YAGNI / 延后）

- 用户端视觉打磨到生产级（卡片/空态/动效）——延后。
- 管理端页面移入分包（subpackage）——延后（多数页共享，分包收益主要来自管理独有页，单独一轮做）。
- 后端任何改动——本轮纯前端门控，后端 888 校验已具备。
- 用户端登录/收藏/联系房东等业务——延后。

## 验证策略（无单测设施，遵循项目惯例）

- `pnpm type-check` + `pnpm lint` 全绿。
- 微信开发者工具编译通过。
- automator/CDP 运行时断言：
  1. 非 888（伪造 accountType=1）：tabbar = 用户 3 项；进房源 tab 无新增 FAB；进楼盘只见可租房源；无任何管理端 tab；我的页无切换入口。
  2. 888：我的页有"切换到管理端"；切换后 tabbar = 管理 5 项、出现新增 FAB/管理动作；可进工作台/销控；再切回用户端正常。
  3. mode 记忆：888 切到管理端后冷启动（cli auto 重启）仍落在管理端；非 888 冷启动恒在用户端。
  4. 免登录：清空登录态后地图/房源/详情可正常浏览（不被踢登录页）；点"切换到管理端"才触发登录。
- 渲染层 hit-test 复核关键按钮显隐（沿用本项目既有方法）。

## 风险与回滚

- mode 与 tabbar 持久化 idx 语义变化：切 mode 必须重置 `curIdx`，否则越界。
- 自定义 tabbar 两套切换时的启动页一致性：保证地图在两套里都存在，冷启动落地图安全。
- 每个任务一个 git checkpoint，便于回退（本项目允许 Codex/Claude 自主提交回滚）。
