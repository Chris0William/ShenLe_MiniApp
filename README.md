# ShenLe MiniApp Next

深乐租小程序重构版，基于 `unibest + uni-app + wot-design-uni`。

这份 README 主要给前端开发接手使用，重点说明当前项目状态、目录结构、启动方式和接手建议。

## 1. 项目定位

- 当前目录：`ShenLe_MiniApp_Next`
- 当前分支：`refactor/unibest-wot-next`
- 旧版参考项目：同级目录 `ShenLe_MiniApp`
- 后端项目：同级目录 `ShenLe`
- 小程序目标：先完成管理端重构，再逐步补齐用户端

当前重构方向：

- 保留真实后端接口，不走纯静态假数据
- UI 基于 `wot-design-uni`，但业务页面允许自定义样式封装
- 登录只保留微信授权登录，不做账号密码登录
- 筛选、地图、销控、房源表单等核心能力优先按旧版行为对齐

## 2. 当前完成度

目前已经完成或已具备基础能力的部分：

- 微信授权登录主链路已接入
- 管理端工作台、房源列表、销控台、楼盘/楼栋/区域/标签管理已有重构骨架
- 管理端房源列表已接入新版筛选栏：
  - `位置`
  - `户型`
  - `租金`
  - 右侧搜索入口可打开完整筛选面板
- 房源筛选支持真实 API 联动，已验证筛选后列表数量和结果变化
- 地图相关基础页面和楼盘选点能力已接入一部分

最近一个和筛选相关的提交：

- `6a7f7db feat(miniapp): align admin property filter bar`

## 3. 启动方式

建议使用：

- Node.js `>= 20`
- `pnpm >= 9`

安装依赖：

```bash
pnpm install
```

常用命令：

```bash
pnpm dev:mp-weixin
pnpm build:mp-weixin
pnpm type-check
pnpm lint src
```

微信开发者工具配置：

- 项目根目录直接打开当前目录
- `project.config.json` 已存在
- `miniprogramRoot` 指向 `dist/dev/mp-weixin/`
- 开发时先跑 `pnpm dev:mp-weixin`，再用微信开发者工具查看实时产物

## 4. 环境与接口

当前接口基础地址：

- `https://fmcs.deerservice.com/api/sl/`

说明：

- 前端请求里保留完整业务路由，如 `/api/slProperty/page`
- baseURL 只负责域名和 `/api/sl/` 前缀
- 接口封装主要在 `src/api`

环境变量相关目录：

- `env/`

如果后续要切换测试、生产环境，优先从 `env` 和 Vite 配置入手。

## 5. 目录说明

### 核心源码

- `src/`：主源码目录，前端日常开发核心区域
- `src/pages/`：页面目录，管理端和用户端页面都在这里
- `src/components/`：业务复用组件
- `src/api/`：接口请求封装
- `src/store/`：全局状态，如登录态、用户信息
- `src/constants/`：静态常量、筛选项、枚举
- `src/types/`：TypeScript 类型定义
- `src/style/`：全局样式和主题变量
- `src/tabbar/`：自定义 tabBar 逻辑

### 配置与构建

- `pages.config.ts`：页面路由、tabBar 配置源
- `manifest.config.ts`：应用清单配置
- `vite.config.ts`：Vite 主配置
- `vite-plugins/`：自定义 Vite 插件或构建扩展
- `project.config.json`：微信开发者工具配置
- `package.json`：依赖和脚本入口

### 工程辅助

- `scripts/`：项目脚本
- `.husky/`：Git hooks
- `.changeset/`：版本变更记录

### 运行产物与非业务目录

- `dist/`：编译产物，微信开发者工具运行的主要是这里
- `miniprogram_npm/`：小程序 npm 构建结果
- `node_modules/`：依赖目录，不手改
- `screenshots/`：调试截图产物
- `design/`：本地设计稿/参考图，目前未纳入 Git

## 6. 重点页面

管理端优先关注这些页面：

- `src/pages/admin/dashboard/index.vue`
- `src/pages/admin/property-list/index.vue`
- `src/pages/admin/sales-control/index.vue`
- `src/pages/common/property-form/index.vue`
- `src/pages/common/community-manage/index.vue`
- `src/pages/common/building-manage/index.vue`
- `src/pages/common/region-manage/index.vue`
- `src/pages/common/tag-manage/index.vue`

用户端当前主要相关页面：

- `src/pages/user/home/index.vue`
- `src/pages/user/map/index.vue`
- `src/pages/user/mine/index.vue`

## 7. 当前筛选实现说明

管理端房源列表已换成新版筛选组件：

- 组件位置：`src/components/sl-property-filter-bar/sl-property-filter-bar.vue`
- 页面接入：`src/pages/admin/property-list/index.vue`

当前支持的筛选项：

- 位置：区域 + 附近距离
- 户型
- 租金范围
- 搜索面板中的楼盘名称关键词

补充说明：

- `位置` 下拉是两栏区域结构
- `租金` 用的是双滑块
- 搜索图标打开完整筛选抽屉
- 筛选值最终会映射到 `PropertyFilterState` 和接口查询参数

相关类型和工具：

- `src/types/shenle.ts`
- `src/utils/property-filter.ts`
- `src/constants/shenle.ts`

## 8. 登录与权限

登录入口：

- `src/pages/common/login/index.vue`

当前规则：

- 仅支持微信授权登录
- 管理端受路由守卫保护
- 未登录访问管理页面会跳到登录页
- 登录态和用户信息存放在 `src/store/auth.ts`

相关文件：

- `src/store/auth.ts`
- `src/router/interceptor.ts`
- `src/api/auth.ts`

## 9. 接手建议

建议前端接手时优先按下面顺序推进：

1. 先熟悉 `src/pages/admin` 和 `src/pages/common`
2. 先跑通 `pnpm dev:mp-weixin` + 微信开发者工具
3. 先理解 `src/api`、`src/types`、`src/store/auth.ts`
4. 优先参考旧版 `ShenLe_MiniApp` 对齐交互，尤其是筛选和地图
5. 新增业务逻辑时尽量复用现有组件，不要重新散写筛选逻辑

## 10. 已知注意点

- 微信开发者工具里，`tabBar` 页面调试时优先使用 `switchTab`，不要误用 `reLaunch`
- 小程序运行态有时会出现逻辑层和视图层不同步，遇到异常优先重新 `compile`
- `dist/dev/mp-weixin` 是开发态主要产物，开发者工具看不到最新页面时先确认 watcher 是否更新到这里
- `design/` 是本地参考目录，不默认提交
- 旧项目 `ShenLe_MiniApp` 是交互参考，不建议直接复制整页代码覆盖

## 11. 给接手同学的结论

如果你是继续开发这套小程序，建议把它理解成：

- 一个已经接上真实后端 API 的重构中项目
- 管理端是当前主战场
- 页面骨架和若干主链路已经具备
- 接下来最重要的是继续做交互细节、筛选对齐、地图联动、表单闭环和样式统一

如果需要快速找入口，先从下面几个文件开始读：

- `src/pages/admin/property-list/index.vue`
- `src/components/sl-property-filter-bar/sl-property-filter-bar.vue`
- `src/pages/common/login/index.vue`
- `src/store/auth.ts`
- `src/api/property.ts`
- `src/types/shenle.ts`
