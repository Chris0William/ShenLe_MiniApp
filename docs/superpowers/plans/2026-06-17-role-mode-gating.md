# 角色模式门控实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 在单一已发布小程序内用运行时 `mode: 'user'|'admin'` 区分用户端/管理端：用户端免登录浏览（地图/房源/我的），888 在"我的"切管理端（工作台/房源/销控/地图/我的）。所有浏览页共享，差异靠 mode 显隐按钮 + tab 集 + 管理页门控。

**Spec:** `docs/superpowers/specs/2026-06-17-role-mode-gating-design.md`

**Tech Stack:** uni-app/unibest + Vue3 + wot-design-uni；纯前端，后端 888 校验已具备。

**验证:** `pnpm type-check` + `pnpm lint` + 微信 DevTools 编译 + automator/CDP 运行时断言（注入 storage 改 accountType/mode + cli auto 重启）。无单测设施。

---

### Task 1: mode 状态单例

**Files:** Create `src/store/mode.ts`

- [ ] 建 reactive 单例：`APP_MODE_KEY='app-mode'`；`readInitialMode()` 以 token 存在 + accountType≥888 为 admin 前提（从 storage 读，不依赖 pinia）；`modeStore = reactive({ mode, setMode(m){...persist} })`；导出 `modeStore`、类型 `AppMode`。
- [ ] 在 `store/auth.ts` 的 `signOut()` 末尾 `modeStore.setMode('user')`（import mode 单例）。
- [ ] Verify: `pnpm type-check` 通过。
- [ ] Commit: `feat: add app mode store`

### Task 2: 双 tab 集 + mode 驱动 tabbar

**Files:** Modify `src/tabbar/config.ts`, `src/tabbar/store.ts`

- [ ] config.ts：定义 `userTabbarList`(地图/房源/我的→admin/mine) 与 `adminTabbarList`(工作台/房源/销控/地图/我的)；保留原 `customTabbarList` = adminTabbarList 供 `_tabbarList`/原生 `tabBar` 用（原生 list 仍 5 项并集，不变）。
- [ ] store.ts：`baseUser`/`baseAdmin` 两个归一化（'/'前缀）list；`tabbarList = computed(() => modeStore.mode==='admin' ? baseAdmin : baseUser)`；`setCurIdx` 不变；切 mode 由调用方负责 `setCurIdx(0)`；`setAutoCurIdx`/`isPageTabbar` 基于 `tabbarList.value`。
- [ ] Verify: type-check + 编译；automator 断言用户模式 tabbar cell=3、管理模式=5（切 mode 后）。
- [ ] Commit: `feat: mode-driven dual tabbar sets`

### Task 3: 路由守卫显式化 + 非888留用户端

**Files:** Modify `src/router/interceptor.ts`

- [ ] `PROTECTED_PATHS` 改为显式 7 项（dashboard/sales-control + 5 个 common 管理页），删 `/pages/admin/` 前缀、删 `/pages/user/map/index`、删 community-properties。
- [ ] `needsLogin` 命中 + `!isLogin` → toLogin；`isLogin && !isAdmin` → `uni.showToast('仅管理员可使用管理端')` + `return false`（不踢死）。
- [ ] Verify: type-check；automator 非888 reLaunch 工作台被拦提示、reLaunch 地图/房源放行。
- [ ] Commit: `feat: open user-side routes, gate admin pages explicitly`

### Task 4: 地图页删自守卫 + canManage 显隐

**Files:** Modify `src/pages/user/map/index.vue`

- [ ] 删 onLoad 里 `!isLogin`/`!isAdmin` 跳转；onLoad 直接 createMapContext + loadCommunities + getLocation。
- [ ] `canManage = computed(() => auth.isAdmin && modeStore.mode==='admin')`；底部楼盘卡"编辑楼盘"按钮 `v-if="canManage"`。
- [ ] Verify: 清 token 注入非888 → 冷启动落地图不被踢；管理模式有编辑、用户模式无。
- [ ] Commit: `feat: map page anonymous browse + admin-only edit`

### Task 5: 房源列表页 canManage（新增按钮 + 文案）

**Files:** Modify `src/pages/admin/property-list/index.vue`

- [ ] 加 `canManage`；顶部"新增"按钮 `v-if="canManage"`；admin-head 标题/副标题按 canManage 切换（管理"房源管理/先筛选楼盘…"，用户"找房/按楼盘浏览可租房源"）。
- [ ] Verify: 用户模式无新增按钮、文案中性；管理模式恢复。
- [ ] Commit: `feat: property-list mode-aware header and add button`

### Task 6: 楼盘房源页 canManage + 用户仅可租房源

**Files:** Modify `src/pages/common/community-properties/index.vue`

- [ ] `canManage = auth.isAdmin && modeStore.mode==='admin'`（替换 `auth.isLogin`）。
- [ ] onLoad 分流：canManage→现状（chips+服务端分页+管理操作）；用户模式→隐藏 chips/FAB/编辑/状态/删除，循环全量拉（pageSize100 while）→客户端过滤 `status===0||status===1`→扁平只读列表。
- [ ] media-strip、详情跳转保留两端。
- [ ] Verify: 用户模式只见可租房源、无任何管理按钮、无 chips；管理模式全功能。
- [ ] Commit: `feat: community-properties read-only available-only for users`

### Task 7: 房源详情页 canManage

**Files:** Modify `src/pages/common/property-detail/index.vue`

- [ ] 编辑入口 `v-if="canManage"`（`auth.isAdmin && mode==='admin'`）。
- [ ] Verify: 用户模式无编辑入口；管理模式有。
- [ ] Commit: `feat: property-detail hide edit for users`

### Task 8: 统一"我的"页（双视图 + 切换 + 登出落点）

**Files:** Modify `src/pages/admin/mine/index.vue`；Delete `src/pages/user/mine/`、`src/pages/user/home/`

- [ ] admin/mine 按 `modeStore.mode` 渲染两视图：管理视图=现管理入口 + "切换到用户端"；用户视图=用户向（资料/登录态）+（888 才显）"切换到管理端"。
- [ ] 切管理端：未登录→login(redirect=dashboard)；isAdmin→setMode('admin')+setCurIdx(0)+reLaunch(dashboard)。切用户端：setMode('user')+setCurIdx(0)+reLaunch(map)。
- [ ] 退出登录：signOut()+setMode('user')+reLaunch(map)。
- [ ] 删 `src/pages/user/mine/`、`src/pages/user/home/`；全局搜 `pages/user/home`、`pages/user/mine` 引用清理；tabbar config 我的指向 admin/mine。
- [ ] Verify: 非888 用户视图无切换；888 可双向切换；切后 tabbar/页面正确；登出回地图。
- [ ] Commit: `feat: unified mode-adaptive mine page, drop user/home+user/mine`

### Task 9: 登录页去拦死

**Files:** Modify `src/pages/common/login/index.vue`

- [ ] `goAfterLogin`：isAdmin→setMode('admin')+reLaunch(redirect||dashboard)；非isAdmin→toast"仅管理员可使用管理端"+**保留登录态**+setMode('user')+reLaunch(map)。
- [ ] denied 态保留为提示但不 signOut。
- [ ] Verify: 非888 微信登录后落用户端地图且仍登录；888 落管理端。
- [ ] Commit: `feat: login authorizes admin entry without locking out users`

### Task 10: 回归巡检 + 构建上传

- [ ] 全场景 automator：非888免登录浏览/无管理元素；888 双向切换+管理功能；mode 记忆（cli auto 重启）；登出落点。
- [ ] `pnpm type-check && pnpm lint` 全绿；DevTools 编译。
- [ ] `pnpm build:mp` + 上传体验版（版本号递增），描述"角色模式门控：用户端/管理端"。
- [ ] 汇报：变更摘要 + 验证证据 + 风险。
