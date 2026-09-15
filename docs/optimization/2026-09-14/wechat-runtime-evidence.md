# 微信运行时证据

日期：2026-09-14

## 已确认

- 微信开发者工具进程存在，按项目规定通过 Explorer 快捷方式启动后，`127.0.0.1:9421` 已监听。
- CLI `open` 成功打开 `ShenLe_MiniApp_SourceContact`。
- CLI `auto --trust-project` 成功识别 AppID：`wxb3b545efe13da99b`。
- 小程序测试构建已完成，产物 API 指向 `https://shenzuyk.com/test-api`。
- 通过临时本地调试 skill 读取到地图页运行数据：当前页为 `pages/user/map/index`，真实加载 431 个地图点位；console 错误过滤为空。
- 运行态导航到 `pages/admin/data-change/index` 成功，测试 API 返回空记录时页面显示正常空态。
- 运行态导航到 `pages/admin/authorization/index` 成功，真实读取6个预置角色；导航到用户权限详情后真实渲染5个角色勾选框。
- 角色模板列表真实显示影响范围文案，例如“管理员 · 启用 · 0 个用户”。
- 临时调试 skill 已从测试构建产物清理，最终 `app.json` 不含 `agent` 调试字段。
- 清理后重新刷新模拟器成功，当前回到 `pages/user/map/index`，console 错误过滤为空。
- 继续巡检了地图、房源、工作台、我的、数据变更和角色权限入口；TabBar 页面使用 `switchTab` 后路由均匹配，管理端“我的”渲染10个菜单入口，console 错误过滤为空。
- 使用 `reLaunch` 顺序巡检19个可直接进入页面，18个路由精确匹配；“申请使用”按当前已登录/已准入状态被业务守卫重定向回地图，属于预期权限行为；其余页面均匹配，console 错误过滤为空。

## 未确认

- 当前没有截图和 iOS/安卓真机证据；模拟器运行态已通过 CLI automation 工具验证。
- 后续已通过 CLI 启动持久化 agent，9420 已监听；但原子工具要求项目 `app.json` 声明 `agent.skills`，当前项目没有该元数据，因此仍不能读取页面运行数据。未擅自向小程序配置加入未知字段。
- CLI 的 `engine build` 子命令请求当前 IDE 服务返回 `Cannot GET /engine/build`；这属于 CLI/IDE 接口不匹配，不能作为小程序源码编译失败证据。
- iOS/安卓真机、媒体弱网、扫码和弹层穿透仍需真实设备验收。
