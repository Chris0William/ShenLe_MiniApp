# 会话交接摘要（2026-09-16 压缩前存档）

> 本文件是当前会话压缩前的完整状态存档。新会话接手时先读本文件 + AGENTS.md + 需求文档目录。

## 仓库状态（全部已提交已推送，工作区干净）

| 仓库 | dev 最新 | 内容 |
|---|---|---|
| 后端 `ShenLe_SourceContact` | `718f79d` | 九条整改 + 公告服务 + 佣金排序 + 经营标签回退（推广页房源级为唯一真源） |
| 前端 `ShenLe_MiniApp_SourceContact` | `d007487` | 同上对应前端 + 公告改版（不再提醒+地图按钮） |

- 分支模型：dev 开发 / master 生产基线 / release/0.4.52 存档（详见 AGENTS.md）
- 体验版：0.5.3 已上传（含九条整改+公告改版，**不含**已回退的楼盘级三开关实验）；0.5.2/0.5.1/0.5.0 历史
- 测试后端 `shenle-test-app`：已部署 718f79d 对应 DLL，`adminet_test` 库，Shadow 模式，健康

## 关键决策记录（本轮会话）

1. **经营标签（可押一付一/可短租/可日租）真源 = 房东端"推广"页（房源级 SlPropertyOperationConfig）**。曾在费用设置页做过楼盘级版本，用户判定重复后已全部回退；楼盘级迁移脚本已废弃不执行，测试库残留三列无副作用。
2. 佣金排序：`sortBy=commissionDesc` 取半年/一年佣金**最高值**排序；该排序已排除出数据库分页路径（走内存排序）。
3. 房东公告："不再提醒"= 永久忽略该版本（新版本重弹）；"关闭"= 本次收起；地图页头部（刷新左侧）有带"公告"文字的按钮可随时打开；关闭时弹窗缩回按钮位置（收束动画）。
4. 公告管理：仅超管，CRUD+设为显示（`/pages/admin/landlord-announcement`，管理端我的入口）。
5. 入驻码：管理端+超管双条件可见。
6. 户型筛选：预设（单间/一室一厅/两室一厅/三室一厅）+ 其他自由组合，`layoutCombinations`（"室,厅,卫"，* 不限）跨段 OR；实现为逐组合 EXISTS + Id 并集（SqlSugar 表达式树/Any 翻译不可靠，勿回退成表达式树方案）。
7. 地图穿透：filter-bar `panel-change` 事件 → 地图 `overlayActive` → 藏 cover-view 徽标+清空 markers。
8. 筛选贯通房源：地图卡片进房源列表携带 `filterContext`（JSON）。
9. 楼盘地图卡片：`sl-unified-community-card` 统一组件（房东端样式基准）；`landlordSelectedAsCommunity` 适配层在地图页。

## 微信开发者工具调试（重要经验）

- **稳定上传通道**：`cli.bat` 在 bash→cmd 链路会 `chcp 65001` 触发 setlocal 递归爆栈；用直调 exe 的 bootstrap 命令（见 `WECHAT_UPLOAD_RUNBOOK.md` "稳定命令"节）。仅一次尝试+一次诊断，再失败停。
- **wechatide skill-cli（Codex 同款，已授权 ZCode 客户端）**：`skill-index.js -c ZCode automation_evaluate/element_action/navigate/page_action`。授权页元素选择器验证通过；**但 sales-control（tab 页+自定义组件）选择器 no-such-element 问题未解决**——需下会话继续排查（怀疑 tab 页上下文或 shadow-root 深层问题）。
- 模拟器被自动化通道占用时用户点不动——自动化操作完必须断开/告知。
- automator（npm miniprogram-automator）对 uni-app 编译产物组件选择器不可达，勿再用。

## 待办 / 未完事项

1. **三开关 UI 真机验证**：费用设置弹层（已回退删除，无需再验）；但**推广页三开关 + 房源标签显示**值得真机过一遍（0.5.3 体验版可验）。
2. sales-control 页 wechatide element_action 选择器问题（见上）。
3. 体验版 0.5.3 待用户公众平台设为体验版验收。
4. 生产发布 0.5.x 批次：按 `PRODUCTION_DEPLOY_RUNBOOK_0.5.0.md`（注意其中楼盘级迁移已标废弃不执行）。
5. 用户预告：**还有新需求**（压缩后新会话接）。

## 红线（不变）

生产 `adminnet` 不碰；测试全走 `adminet_test`；发布/提交/推送等用户指令；上传走 Runbook 稳定通道；台账即时更新；AGENTS.md 优先。
