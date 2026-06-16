# 角色模式门控设计（用户端 / 管理端，单版本 B 方案）

> 状态：已与用户对齐 + 已过 spec 评审修订（v2）。
> 日期：2026-06-17

## 目标

同一个已发布小程序内，用运行时模式状态 `mode: 'user' | 'admin'` 区分用户端/管理端，而非靠微信发版渠道。所有浏览页面单一来源、两端共用，差异只在三处：tab 集、共享页管理按钮显隐、管理端独有页的可达性。安全由后端 888 校验兜底，本轮不改后端。

## 现状关键事实（评审已核）

- 自定义 tabbar（CUSTOM_TABBAR 策略）。`config.ts`：`nativeTabbarList`(2项) + `customTabbarList`(5项=地图/房源/工作台/销控/我的)；喂给 `pages.config.ts` 的原生 `tabBar.list` 实际是这 5 项。
- `tabbar/store.ts` 是**普通 reactive 单例（非 pinia）**，模块加载时一次性固化 `baseTabbarList`；`curIdx` 初值来自 storage `app-tabbar-index`。
- `pages/user/map/index.vue` 的 `onLoad` 有**独立硬守卫**（绕过拦截器）：未登录→跳 login(redirect=map)，非 888→`reLaunch('/login?denied=1')`。这是冷启动落地图时真正生效的门控。
- `community-properties/index.vue`：`canManage = computed(() => auth.isLogin)`；有 FAB（新增）、每条房源的编辑/状态/删除、状态筛选 chips。
- `property-list/index.vue`：顶部有"新增"按钮（admin-head 内），**无 FAB**；无 canManage 概念，管理元素恒显。
- `PageSlPropertyInput.status` 是**单个 number**，`getPropertyPage` 单字段透传 → 无法一次传 0 和 1。
- `dashboard/index.vue`、`property-list` 等 onLoad 也各有 isLogin 判断。
- `router/interceptor.ts` `PROTECTED_PATHS` 含 `/pages/admin/`、`/pages/user/map/index`(第14行) 等；拦截器 install 在 navigateTo/reLaunch/redirectTo/switchTab。

## 核心架构

### 1. 模式状态：独立 reactive 单例（避开 pinia/模块时序问题）

新建 `src/store/mode.ts`，**普通 reactive 单例**（参照 `tabbar/store.ts` 的写法，不依赖 pinia），这样 `tabbar/store.ts` 能直接 import 读取，无 pinia 实例时序问题。

```ts
// 伪代码要点
const APP_MODE_KEY = 'app-mode'
function readInitialMode(): 'user' | 'admin' {
  const saved = uni.getStorageSync(APP_MODE_KEY)
  // admin 模式前提：有 token + storage 里 accountType≥888（不依赖 pinia 已初始化）
  const token = uni.getStorageSync(SHENLE_TOKEN_KEY)
  const user = uni.getStorageSync(SHENLE_USER_KEY)
  const isAdmin = !!token && (user?.accountType || 0) >= 888
  return (saved === 'admin' && isAdmin) ? 'admin' : 'user'
}
export const modeStore = reactive({
  mode: readInitialMode(),
  setMode(m) { this.mode = m; uni.setStorageSync(APP_MODE_KEY, m) },
})
```

- **默认**：所有人 = `user`。
- **记忆**：888 的 `mode` 持久化；冷启动 `readInitialMode` 恢复（admin 仅当 storage=admin 且**有 token** 且 accountType≥888）。
- **非 888 / 登出纠正**：`readInitialMode` 以 **token 存在性**为前提 —— 401 路径（`request.ts` 已 `removeStorageSync(TOKEN)+removeStorageSync(USER)`）或 `signOut` 清掉 token 后，下次冷启动必回 user。`signOut` 中显式 `modeStore.setMode('user')` 双保险。

### 2. Tab 集（运行时裁剪，"我的"合一以满足原生 ≤5 限制）

**硬约束**：微信原生 `tabBar.list` 最多 5 项，且自定义 tabbar 的每个 tab 用 `switchTab` 跳转，目标必须在原生 list 内。若用户/管理各保留独立"我的"页，pagePath 并集 = 6（user/mine + admin/mine + 其余 4），**超 5 限制**。

**决议：把"我的"合并为一个随 mode 自适应的页面**，复用现有 `pages/admin/mine/index`（保持原生 list pagePath 不变、风险最小），内容按 `modeStore.mode` 分支：用户模式渲染用户向内容 + 888 显示"切换到管理端"；管理模式渲染管理入口 + "切换到用户端"。**删除 `pages/user/mine`**，其有用内容并入统一"我的"页。

`config.ts` 定义两套显示集（均指向原生 list 内的合法 pagePath）：
- `userTabbarList`：`地图(user/map) / 房源(admin/property-list) / 我的(admin/mine)`（3 项）
- `adminTabbarList`：`工作台(admin/dashboard) / 房源(admin/property-list) / 销控(admin/sales-control) / 地图(user/map) / 我的(admin/mine)`（5 项）

原生 `tabBar.list`（喂给 `pages.config.ts`）= **5 项并集：地图/房源/工作台/销控/我的(admin/mine)**，与现状完全一致，不增不减。运行时仅靠自定义 tabbar 组件按 mode 渲染 user-3 或 admin-5，不改 `pages.json` 原生 list。

`tabbar/store.ts`：`tabbarList` 改为 `computed(() => modeStore.mode === 'admin' ? adminList : userList)`（带 '/' 前缀归一）。切 mode 时 `setCurIdx(0)` 并写 `app-tabbar-index=0`，避免越界。`setAutoCurIdx`/`isPageTabbar` 基于当前 mode 的 list 计算。

### 3. 共享页 canManage 门控（语义统一）

统一计算属性：`canManage = computed(() => auth.isAdmin && modeStore.mode === 'admin')`（不再用 `auth.isLogin`）。

| 页面 | 用户模式 | 管理模式 |
|------|---------|---------|
| 地图 `user/map` | 楼盘卡仅"查看房源"；**删除 onLoad 自守卫**（见下） | 多"编辑楼盘" |
| 房源列表 `admin/property-list` | 隐藏顶部"新增"按钮；admin-head 整块文案改中性（标题"找房"、副标题去掉"管理楼盘房源"那句或改"按楼盘浏览可租房源"）；只读刷楼盘 | 新增按钮 + admin-head"房源管理 / 先筛选楼盘，再进入楼盘管理房源" |
| 楼盘房源 `community-properties` | `canManage=false`：隐藏 FAB/编辑/状态/删除/状态chips；**仅展示可租房源(status 0,1)**（见取数方案） | 全状态 + 管理操作 |
| 房源详情 `property-detail` | 隐藏编辑入口 | 显示编辑入口 |

### 4. 地图页冷启动自守卫处置（修复免登录阻塞）

`user/map/index.vue` 的 `onLoad` **删除 isLogin/isAdmin 跳转**，改为：任何人（含未登录）都能加载地图浏览。管理动作（编辑楼盘）由 `canManage` 控制显隐；点编辑时若 `!canManage` 不显示，不存在越权入口。`dashboard`/其它管理页的 onLoad 守卫保留（它们是管理页，仍要 888）。

### 5. community-properties 仅可租房源取数方案（无后端改动）

单个楼盘房源数量有限。用户模式：
- 不展示状态 chips；
- 调 `getPropertyPage` 循环拉全量（pageSize 100，`while(acc<total)`，参照地图页 loadCommunities 的循环），客户端过滤 `status===0 || status===1`，渲染扁平列表；
- 不走服务端分页/触底（用户模式数据量小，全量可接受）。
管理模式：保持现状（chips + 服务端分页 + 管理操作）。
用 `canManage` 在 onLoad 分流两条加载路径。

### 6. 路由门控调整（`interceptor.ts`）

**关键修正**：现 `PROTECTED_PATHS` 用 `/pages/admin/` 整段前缀保护，但合一后 `admin/mine`（我的）和 `admin/property-list`（房源）都是**两端共享、用户模式也要可达**的页 —— 整段前缀会把它们误拦。改为**显式列举管理独有页**，不再用 `/pages/admin/` 前缀：

```
PROTECTED_PATHS = [
  '/pages/admin/dashboard/index',      // 工作台（管理独有）
  '/pages/admin/sales-control/index',  // 销控（管理独有）
  '/pages/common/building-manage/index',
  '/pages/common/community-manage/index',
  '/pages/common/property-form/index',
  '/pages/common/region-manage/index',
  '/pages/common/tag-manage/index',
]
```

不受保护（用户模式可浏览）：`user/map`、`admin/property-list`、`admin/mine`、`common/community-properties`、`common/property-detail`。其管理动作由各页 `canManage` 控制显隐。

- 命中管理路径且 `!isLogin` → login；`isLogin && !isAdmin` → toast"仅管理员可使用管理端" + 留用户端（不踢死）。

### 7. 登录流程调整（`login/index.vue`）

- 去掉"整个 app 仅管理员、非 888 signOut 踢死"逻辑。
- 登录页定位为"进入管理端的授权"。`onLoad`：带 `redirect`（默认 dashboard）。
- 登录成功 `goAfterLogin`：
  - `isAdmin` → `setMode('admin')` + `reLaunch(redirect || dashboard)`；
  - **非 isAdmin** → toast"仅管理员可使用管理端"，**保留登录态**（不 signOut），`setMode('user')`，`reLaunch('/pages/user/map/index')`（回用户端，不带 redirect）。
- `denied=1` 分支：保留为"非管理员尝试进管理端"的提示态，但不再 signOut。

### 8. "我的"双向切换（统一页，按 mode 分支）

统一"我的"页 `pages/admin/mine/index` 按 `modeStore.mode` 渲染：
- **用户模式视图**：用户向内容（登录态/资料）。888 用户显示"切换到管理端"入口（非 888 不显示）。点击：未登录→login(redirect=dashboard)；已登录且 isAdmin→`setMode('admin')`+`setCurIdx(0)`+`reLaunch('/pages/admin/dashboard/index')`。
- **管理模式视图**：管理入口列表（现 admin/mine 内容）+ "切换到用户端"。点击：`setMode('user')`+`setCurIdx(0)`+`reLaunch('/pages/user/map/index')`。
- 切 mode → reLaunch 链路：set mode（同步）→ reset curIdx → reLaunch → 拦截器（目标在当前 mode 合法）→ 目标页 onLoad（admin 页守卫此时 isAdmin 通过；map 已无守卫）→ 正常落地。
- **登出落点**：统一"我的"页的"退出登录"= `signOut()` → `modeStore.setMode('user')` → `reLaunch('/pages/user/map/index')`（回用户端地图，**不去登录页**）。避免非 888 登出后被甩到"进管理端授权页"，与 section 7 语义一致。

## 影响文件清单

- 新增：`src/store/mode.ts`（reactive 单例 + 持久化 + 非888纠正）
- 修改：`src/tabbar/config.ts`（userTabbarList/adminTabbarList + 原生 list 并集）、`src/tabbar/store.ts`（mode 驱动 computed + 切换重置 curIdx）
- 修改：`src/router/interceptor.ts`（放开用户端、管理端门控、非888留用户端）
- 修改：`src/pages/common/login/index.vue`（授权进管理端、非888不踢死）
- 修改：`src/pages/user/map/index.vue`（删自守卫 + canManage 显隐编辑）
- 修改：`src/pages/admin/property-list/index.vue`（canManage 隐藏新增 + header 文案）
- 修改：`src/pages/common/community-properties/index.vue`（canManage 语义改 + 用户模式仅可租房源取数）
- 修改：`src/pages/common/property-detail/index.vue`（canManage 隐藏编辑入口）
- 修改：`src/pages/admin/mine/index.vue`（统一"我的"页：按 mode 渲染用户/管理两视图 + 双向切换入口）
- 删除：`src/pages/user/home/`（弃用找房页）、`src/pages/user/mine/`（并入统一"我的"）；全局搜索清理 `pages/user/home`、`pages/user/mine` 引用；删后 uni-pages 自动重生成 pages.json
- 启动页：地图保持 `type:'home'`，冷启动落地图（用户模式默认）。

## 不在本轮范围

- 用户端视觉打磨到生产级、管理端移入分包、后端改动、用户端业务（收藏/联系）——均延后。

## 验证策略（automator/CDP，注入点明确）

注入手段：`wx.setStorageSync('shenle_user', {...,accountType:N})` 改角色 + `wx.setStorageSync('app-mode', m)` + `cli auto` 重启后 reLaunch，再断言。

1. **非 888 + 免登录**：清空 token、伪造 accountType=1 → 冷启动落地图且**不被踢登录页**；tabbar=用户 3 项；房源 tab 无"新增"；进楼盘只见可租房源、无管理按钮；user/mine 无切换入口。
2. **888 切换**：伪造 accountType=888 → user/mine 有"切换到管理端"；切换后 tabbar=管理 5 项、出现新增/管理动作、可进工作台/销控；admin/mine 可切回用户端。
3. **mode 记忆**：888 切管理端后 `cli auto` 重启 → 冷启动落管理端；非 888 冷启动恒用户端。
4. **渲染层 hit-test** 复核关键管理按钮在用户模式确实不可见（沿用既有方法）。

## 风险与回滚

- 切 mode 必重置 curIdx（防越界）；原生 list 必含全部 tab pagePath（防 switchTab 失败）。
- 401 降权后的纠正有一帧窗口（下次进入纠正），可接受。
- 每任务一 git checkpoint，可回退（本项目允许自主提交回滚）。
