# 待办清单（Backlog）

> 2026-06-10 第一轮管理端修复时与用户确认后挂起的事项。

## 1. 下拉刷新统一方案（用户已确认：保留但换实现，统一设计后修）

现状：以下 10 个页面开启了原生 `enablePullDownRefresh`，配合自定义导航栏时，下拉会在顶部空白区出现原生刷新动画（视觉割裂，地图页还与拖图手势冲突）：

- pages/user/map/index（与地图拖动手势冲突，优先级最高）
- pages/admin/dashboard/index
- pages/admin/property-list/index
- pages/admin/sales-control/index
- pages/common/building-manage/index
- pages/common/community-manage/index
- pages/common/community-properties/index
- pages/common/region-manage/index
- pages/common/tag-manage/index
- pages/user/home/index（用户端，暂搁置）

方案方向：列表页迁移到 z-paging（项目已配置 easycom），刷新动画在内容区内；地图/销控等非列表页直接关闭原生下拉，保留页内刷新按钮。涉及 onPullDownRefresh → z-paging @onRefresh 的逐页改造与回归。

## 2. 用户端独立小程序（用户已确认方向）

- 双端拆分为两个小程序（管理端/用户端），管理端已按"仅 888 可用"收敛。
- 用户端建议同仓双构建：uni-app 条件编译 + 独立 pages.config/manifest（独立 AppID），复用 api/components/utils。
- 现存的 `src/pages/user/home`、`src/pages/user/mine` 为孤岛占位页（无入口），待用户端立项时迁移改造。

## 3. 布局打磨清单

- 弹层滚动穿透统一治理：筛选组件（sheet/下拉/遮罩）已加 catchtouchmove（2026-06-12），其余弹层（视频预览、楼盘/房源表单 sheet、媒体池选择器等）待逐个补齐同样处理。

- 空态/加载态/失败重试样式统一成组件（目前各页自写）。
- 列表页骨架屏。
- 销控表 legend 与楼栋卡片在小屏下的换行优化。
- 楼盘卡片图片懒加载与占位渐变。

## 4. 数据备注

- 合水口（99）、西田（7）、李松蓢（4）共 110 个楼盘只有楼盘壳，无楼栋/房源数据（用户确认：该批本来就没有房源数据），销控表对应区域显示 0 为正常现象。
- 全库 489 楼盘中 312 个有真实坐标；其余 177 个无坐标楼盘不再上图（旧后端曾用"用户位置"伪造坐标，已在距离排序重构中修正）。
