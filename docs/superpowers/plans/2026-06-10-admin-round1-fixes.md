# 管理端第一轮修复实施计划（Round 1）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理端小程序定位为"仅 888 权限可用"，地图成为首 tab 与启动页；修复距离排序（后端下推）、地图自动定位、marker 气泡聚合、顶部安全区遮挡。

**Architecture:** 前端保持现有自定义 tabBar 策略（CUSTOM_TABBAR，改 `customTabbarList`，勿动 `nativeTabbarList`），重排为地图优先；入口页删除，地图 tab 即启动页；路由守卫加 888 校验。后端 `slCommunity/page` 改为"轻量查询全量坐标 → 内存算距离排序/过滤 → 按页取详情"三段式，修复分页。地图聚合用自研屏幕像素网格聚合（不依赖原生 cluster）。

**Tech Stack:** uni-app/unibest + Vue3 + wot-design-uni；后端 Admin.NET/Furion/SqlSugar (.NET 8)。

**验证方式说明:** 本仓库无单测设施（小程序 UI 项目），按 CLAUDE.md 验证规范执行：`pnpm type-check` + `pnpm lint` + 微信开发者工具编译 + automator/CDP 运行时断言（路由、元素、数据、接口返回）。后端用 `dotnet build` + curl 真实接口验证。

---

## File Structure

**前端（ShenLe_MiniApp_Next）：**
- Modify: `src/tabbar/config.ts` — tab 顺序重排（地图首位）
- Delete: `src/pages/index/` — 旧统计首页
- Modify: `src/pages/user/map/index.vue` — type:'home' 入口、自动定位、聚合、底部卡片、安全区
- Modify: `src/router/interceptor.ts` — 888 准入守卫
- Modify: `src/pages/common/login/index.vue` — 默认 redirect 改地图、非 888 拦截态
- Create: `src/utils/safe-area.ts` — 状态栏+胶囊安全区计算（含 useSafeTop）
- Create: `src/utils/map-cluster.ts` — 网格聚合纯函数（可独立验证）
- Modify: `src/pages/admin/dashboard/index.vue`、`src/pages/admin/property-list/index.vue`、`src/pages/admin/sales-control/index.vue` — 安全区+页头压扁
- Modify: `src/pages/admin/property-list/index.vue` — 删除客户端距离兜底路径
- Modify: `src/utils/property-filter.ts` — 清理 `filterCommunitiesByClientDistance`
- Create: `docs/superpowers/backlog.md` — 待办（下拉刷新统一、用户端小程序、布局清单）

**后端（ShenLe，等待用户 Git 指令，不自动提交）：**
- Modify: `Api/ShenLe.Application/Service/SlCommunity/SlCommunityService.cs` — Page 距离排序三段式重写

---

### Task 1: tab 重排 + 地图设为启动页 + 删除旧首页

- [ ] `src/tabbar/config.ts`：customTabbarList 重排为 地图(i-carbon-location) / 房源 / 工作台 / 销控 / 我的
- [ ] `src/pages/user/map/index.vue`：definePage 加 `type: 'home'`
- [ ] 删除 `src/pages/index/` 目录；全局搜索 `pages/index/index` 引用并清理（login redirect、App.ku、interceptor 等）
- [ ] `src/pages/common/login/index.vue`：默认 redirect 改为 `/pages/user/map/index`（reLaunch）
- [ ] 检查 `tabbarStore` 持久化 idx：旧存储值语义已变，启动时若超界/不匹配按 path 重算
- [ ] Verify: `pnpm type-check` 通过；编译通过；automator 验证 `mini.reLaunch('/pages/user/map/index')` 后 FgTabbar 激活项为"地图"（element class 断言）；冷启动入口 = 地图页（dist app.json pages[0]）
- [ ] Commit: `feat: make map the entry tab and remove legacy home page`

### Task 2: 888 准入守卫

- [ ] `src/router/interceptor.ts`：PROTECTED_PATHS 命中时，已登录但 `!auth.isAdmin` → `uni.showToast('仅管理员可使用')` + return false
- [ ] `src/pages/common/login/index.vue`：登录成功后校验 accountType，`< 888` 显示"仅管理员可使用本小程序"并 signOut，不跳转
- [ ] App 冷启动落在地图 tab（拦截器不覆盖冷启动）：地图页 onLoad 若未登录跳 login（带 redirect）；若已登录非 888 同样拦截
- [ ] Verify: automator 注入 `wx.setStorageSync` 伪造 accountType=1 用户 → reLaunch 地图 → 断言被拦；恢复真实 888 登录态 → 正常进入
- [ ] Commit: `feat: restrict mini program to admin (888) accounts`

### Task 3: 顶部安全区 + 页头压扁

- [ ] Create `src/utils/safe-area.ts`：`getSafeTopPx()` = `menuButtonRect.bottom + 8`（fallback statusBarHeight+44）；导出 `useSafeTop()` 返回 style 字符串
- [ ] 四个自定义导航页（map/dashboard/property-list/sales-control）根节点绑定 paddingTop；页头压扁：标题单行、副标题减小或移除、操作按钮收进标题行
- [ ] Verify: automator `element_info` 断言各页标题元素 `top >= menuButton.bottom`；type-check + 编译
- [ ] Commit: `fix: respect status bar and capsule safe area on custom nav pages`

### Task 4: 地图自动定位

- [ ] 删除 `isDevToolsRuntime()` 跳过逻辑，onLoad 始终 `getLocation(false)`；失败保持默认中心
- [ ] Verify: reLaunch 地图页 → automator 断言 `locationLabel` 元素文本为"当前位置"（devtools 模拟定位）或失败 fallback"点击选择位置"
- [ ] Commit: `fix: auto locate on map page entry`

### Task 5: 后端距离排序三段式（ShenLe 仓库，不自动提交）

- [ ] `SlCommunityService.Page` 重写：
  1. 基础过滤查询（含房源级子查询过滤）只取 `{Id, Lat, Lng, OrderNo}` 全量
  2. 内存：hasLocation → CalcDistanceKm 算距离；DistanceKm 过滤；排序 = hasLocation ? 距离升序(无坐标最后) : OrderNo/Id
  3. 取当页 Id 切片 → 完整 Select 查询 `Where(ids.Contains)` → 按切片顺序重排 → 回填 Distance → **对当页 items 调用 `FillPropertyStatsAsync(items, input)` 回填 PropertyCount/MinRentPrice/MaxRentPrice/户型**（Task 7 气泡租金依赖此字段，遗漏即静默回归）→ 构造正确 Total 的 SqlSugarPagedList
- [ ] `dotnet build ShenLe.sln` 通过
- [ ] **检查点：请求用户确认部署生产**（文档化 scp 流程）。**若用户暂缓部署：Task 6/7 的运行时验证前置条件不满足，暂停于此等待指令（或经用户同意后本地 `dotnet run` 起后端 + 前端临时切 `VITE_SERVER_BASEURL=http://localhost:5566` 验证，验证完恢复 env）**
- [ ] Verify（部署后）: curl 带 `Authorization: Bearer <token>` 调 `/api/slCommunity/page`（token 从模拟器 `wx.getStorageSync('shenle_token')` 取，已验证可用），断言 items 距离单调递增、Total 与 DistanceKm 过滤一致
- [ ] 不提交 git，等用户指令

### Task 6: 前端对接服务端距离排序

- [ ] `src/pages/admin/property-list/index.vue`：删除 `fetchAllCandidateCommunities` + `filteredItems` 路径，统一走服务端分页
- [ ] `src/pages/user/map/index.vue`：`buildQuery` 直接带 distanceKm（服务端过滤），移除 `filterCommunitiesByClientDistance` 调用
- [ ] `src/utils/property-filter.ts`：删除 `filterCommunitiesByClientDistance`（确认无引用）；同时检查 `buildCommunityCandidateFilterQuery` 是否也失去全部引用，一并清理
- [ ] Verify: type-check；automator 房源列表设定位后断言卡片距离标签升序；翻页正确
- [ ] Commit: `feat: rely on server-side distance sorting`

### Task 7: 地图气泡聚合 + 底部楼盘卡片

- [ ] Create `src/utils/map-cluster.ts`：纯函数 `clusterCommunities(items, region, windowWidthPx, thresholdPx=60)` → `{ singles: [...], clusters: [{ lat, lng(质心), items }] }`；网格法：degPerPx=(ne.lng-sw.lng)/width，cell=threshold*degPerPx，按 cell 分桶+相邻桶合并
- [ ] 地图页：`regionchange`(type=end, 防抖 300ms) + 数据加载后重算 markers：
  - 单楼盘：红点 + callout ALWAYS `名称\n¥min-max`（无租金显示楼盘名）
  - 聚合：稍大圆点 + callout ALWAYS `A、B等n个楼盘`（前2名）
- [ ] 点击聚合 marker/callout → `mapContext.includePoints(points, padding)`；若聚合内所有点坐标几乎相同（拆不开）→ 弹出楼盘选择列表（wd-action-sheet）
- [ ] 点击单楼盘 marker/callout → 底部卡片（名称/区域/房源数/租金区间）+ 按钮「编辑楼盘」「查看房源」；编辑跳 community-manage（确认其编辑入口参数，若无则补）；查看房源跳 community-properties
- [ ] Verify（确定性优先）: automator `evaluate` 用构造的密集坐标数据直接调 `clusterCommunities` 断言聚合/拆分结果正确（不依赖生产数据分布）；再做软检查：真实数据下初始 markers 数 < 楼盘数、includePoints 后拆分；tap 单点 → 底部卡片元素出现且文本=楼盘名；点「查看房源」路由跳转正确
- [ ] Commit: `feat: cluster map markers with always-on callouts and community card`

### Task 8: 待办文档

- [ ] Create `docs/superpowers/backlog.md`：①下拉刷新统一 z-paging 方案（10 页面清单）②用户端独立小程序（uni-app 单仓双构建）③布局打磨清单（空态/骨架屏/动效）
- [ ] Commit: `docs: add backlog for deferred work`

### Task 9: 回归巡检

- [ ] 依次 navigate 全部管理端页面，page_data/路由断言无异常；`pnpm type-check && pnpm lint` 全绿
- [ ] 汇报：变更摘要 + 验证证据 + 风险点（后端部署状态）
