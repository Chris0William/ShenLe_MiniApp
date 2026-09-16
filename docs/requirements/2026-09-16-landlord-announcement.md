# 需求：房东公告（富文本 + 图片 + 历史版本）

> 确认时间：2026-09-16。状态：实现中。**不发布不提交，等用户确认。**

## 需求（用户已确认）

1. 管理端"我的"新增"房东公告"栏（盘源对接人管理上面），仅超级管理员可见
2. 富文本编辑：颜色、字号、排版（加粗/换行等）都要
3. 支持插入图片
4. 历史公告列表：管理员可选择某一条作为当前显示版本
5. 房东端弹窗展示当前显示的公告，两个按钮："今日不再显示"、"关闭"
   - 触发时机：进入房东端/冷启动且 mode=landlord 时检查一次；**切换页面/tab 绝不弹**
   - "今日不再显示"：当天内不再弹（退出重进也不弹）
   - "关闭"：本次已读，重进/重登还会弹（直到点今日不再显示）
   - **新公告版本 > 本地已读版本 → 无视"今日不再显示"重新弹**

## 技术方案

### 存储

- 新表 `sl_landlord_announcement`：Id、Title(可选标题)、Content(LONGTEXT, HTML)、Version(int 自增语义)、IsDisplayed(bool 全局唯一)、ImageFileIds(JSON 数组，可选，图片内嵌于 Content 时可不需)、发布人/时间、软删除
- 迁移脚本：`scripts/migrations/20260916_landlord_announcement.sql`（幂等，登记生产 Runbook）
- "设为显示"：事务内先把所有记录 IsDisplayed=false，再把目标设 true

### 后端服务 `SlLandlordAnnouncementService`

- `POST /api/slLandlordAnnouncement/save`：新增/编辑（超管）；新记录 Version=Max+1，保存后自动设为显示（可在入参关闭该行为）
- `POST /api/slLandlordAnnouncement/list`：历史列表（超管，含未显示的）
- `POST /api/slLandlordAnnouncement/setDisplayed`：指定 Id 设为当前显示（超管）
- `GET  /api/slLandlordAnnouncement/displayed`：房东端拉当前显示公告（登录即可；返回 Content HTML + Version）
- 图片：复用现有 `/api/sysFile/uploadFile`（fileType=landlord_announcement），Content 里存 COS URL；媒体守卫按归属放行房东端

### 前端编辑器（超管页 `pages/admin/landlord-announcement/index`）

- 基座：`wd-textarea` 编辑 HTML 源码太反人类 → 采用**分段段落编辑器**：
  - 内容为段落数组，每段 = { type: 'text'|'image', text?, style? , fileId? }
  - 文本段：textarea + 该段独立样式（字号 S/M/L/XL、颜色板 8 色品牌色系、加粗/斜体、对齐）
  - 图片段：调 `uploadMediaFile` 上传后存 URL，宽度全宽
  - 上移/下移/删除段落按钮
  - 预览按钮 → rich-text 渲染所见即所得
- 渲染：段落数组 → HTML 段串（span style 内联），存库；历史记录保留段落 JSON（重编辑不丢结构）
- 历史列表页/弹层：标题+时间+版本+是否显示中，点击"设为显示"

### 前端弹窗（房东端 mine 页 onShow 检查一次/会话）

- store：`landlord-announcement.ts`（当前公告、displayedVersion、dismissedUntil(日期)、readVersion、sessionShown）
- 弹窗：wd-popup center，`<rich-text :nodes>` 渲染，图片点击可预览
- 按钮：今日不再显示（记 dismissedUntil=今天+readVersion=Version）/ 关闭（仅记 readVersion）
- 显示条件：mode=landlord && 有 displayed 公告 && Version > readVersion && !(dismissedUntil == today && Version <= readVersion) && !sessionShown

## 涉及文件

- 后端：Entity/SlLandlordAnnouncement.cs、Service/SlLandlordAnnouncement/、scripts/migrations/20260916_landlord_announcement.sql
- 前端：src/pages/admin/landlord-announcement/、src/store/landlord-announcement.ts、src/api/landlord-announcement.ts、mine 页两处改动
- Runbook 登记 + 测试库执行
