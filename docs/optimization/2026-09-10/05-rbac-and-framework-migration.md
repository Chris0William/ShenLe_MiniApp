# RBAC权限模型与小程序框架迁移评估

日期：2026-09-10。状态：方案设计，尚未建表、切换权限或迁移框架。

## 1. 与昨天计划的关系

昨天的总体顺序是：

```text
日志与数据边界
  -> 媒体索引与查询性能
  -> 地图轻量接口与列表分页
  -> 前端请求、缓存、局部刷新
  -> 页面拆分和视觉统一
  -> 媒体后台任务与数据版本恢复
```

今天新增的权限和框架工作属于其中的“数据边界”和“前端结构”两条基础线，应该在大规模性能优化及页面重做前先定下来。否则会出现同一页面重写两次、每个接口自己判断角色、前端隐藏按钮但后端仍然放行的情况。

## 2. 当前权限实现的真实形态

当前后端不是标准RBAC，而是三种规则叠加：

1. `AccountType` 数字等级：666游客、777已准入、888管理员、999超级管理员。
2. `SlCapability` 硬编码能力枚举：`CreateCommunity`、`WriteAllSupply`、`ManageUsers`、`EnterLandlordPortal` 等。
3. 关系表与数据字段：房东名下楼盘、维护人受托楼盘、旧盘源对接人 `OwnerId`、创建人 `CreateUserId`。

`SlAuthorizationPolicy.Create` 根据账号等级和身份关系组装 `SlAccessContext`，`SlAuthorizationService` 再提供 `RequireAsync`、`RequireCommunityWriteAsync` 和删除校验。授权快照通过 `ISlAuthorizationCache` 缓存15分钟，当前配置是进程内 Memory，虽然Redis容器正在运行。

这个结构有优点：权限集中、有现成测试、数据关系没有塞进框架 `SysRole`。问题是：

- 每增加一个菜单、按钮或业务能力都要改枚举、Policy、前端判断和测试。
- 888/999是等级，不是清晰可维护的角色模板。
- 角色权限、数据范围、业务身份、进入哪个端混在同一个快照里。
- 用户被赋予角色后，没有统一的“这个用户单独增加/撤销某项权限”模型。
- 数据范围不能用角色菜单解决；`OwnerId`、维护关系、创建人仍需业务查询条件。
- 前端有 `auth.isAdmin`、`canEnterAdmin`、`isLandlord` 等多处判断，容易产生界面与后端不一致。

## 3. 推荐模型：RBAC + 用户覆盖 + 数据范围策略

纯RBAC不够，建议采用：

```text
RBAC角色模板
       + 用户角色
       + 用户级权限覆盖
       + 数据范围策略
       + 业务关系约束
       = 最终有效授权
```

这是标准RBAC的扩展，不需要引入一个完全不同的权限框架。菜单、按钮、API动作适合RBAC；“只能看自己创建的”“只能看分配给自己的楼盘”属于数据范围和关系授权；“房东只能进房东端、管理员兼具房东身份可以多端”属于端入口策略。

### 3.1 权限的四个层次

| 层次 | 示例 | 作用 |
|---|---|---|
| 菜单权限 | `admin.community`、`admin.user` | 控制管理端菜单是否显示 |
| 按钮/动作权限 | `community.create`、`property.batchEdit`、`landlord.review` | 控制按钮和交互入口 |
| API能力权限 | `slCommunity:add`、`slProperty:batchUpdate` | 后端最终授权，不能依赖前端 |
| 数据范围 | `community:assigned`、`property:createdByMe` | 限定查询、更新、删除的数据集合 |

菜单和按钮只是用户体验层；API能力和数据范围必须由后端执行。一个按钮被隐藏不代表接口安全。

### 3.2 角色建议

角色是模板，不等于业务身份。建议先建立内置角色：

| 角色编码 | 用途 | 说明 |
|---|---|---|
| `guest` | 游客 | 公共脱敏预览和申请入口 |
| `sales` | 业务员 | 已审核真实查看和联系能力 |
| `landlord` | 房东 | 房东端经营能力和本人楼盘范围 |
| `maintainer` | 维护人 | 受托维护范围和受限管理端 |
| `admin` | 管理员 | 管理权限及全盘源写入；删除规则仍单独判断 |
| `super_admin` | 超级管理员 | 用户、角色、权限、审批和全量管理 |

“盘源对接人”如果未来仍与“房东”并存，应作为独立业务关系或独立角色编码确认。当前代码里的旧 `SlLandlord` 不能直接当成新房东角色，避免历史数据误升级。

账号等级可以暂时映射到内置角色：

```text
666 -> guest
777 -> sales
888 -> admin
999 -> super_admin
```

房东和维护人通过额外角色或业务关系加入。迁移阶段保留 `AccountType` 作为旧客户端兼容输入，最终由授权适配层转换为新模型，业务服务不再直接比较888/999。

### 3.3 用户级权限覆盖

用户选择角色后，在用户详情中增加“权限调整”：

| 状态 | 含义 |
|---|---|
| 继承 | 使用角色模板结果 |
| 允许 | 在角色没有允许时单独授予 |
| 禁止 | 即使角色允许也单独撤销 |

计算规则建议：

```text
默认拒绝
角色允许集合 = 所有用户角色允许项的并集
用户禁止覆盖角色允许
用户允许补充角色权限
超级管理员保护权限不能被普通用户通过覆盖规则授予或撤销
```

用户级覆盖必须记录操作者、原因、时间和生效版本。超级管理员修改自己的高危权限时也要阻止锁死系统的操作，保留一个受保护的系统根账号或恢复入口。

不要把一个用户的全部权限复制成一行JSON。这样无法查询“谁拥有权限”、无法审计、无法做菜单差异比较，也容易在角色变化后留下旧快照。

### 3.4 数据范围不是角色菜单

推荐固定的数据范围类型：

| 范围 | 适用 |
|---|---|
| `none` | 无数据 |
| `self` | 当前用户自己的资料/申请 |
| `created_by_me` | 管理员删除自己创建的数据 |
| `assigned_community` | 房东本人名下楼盘 |
| `maintained_community` | 维护人受托楼盘 |
| `source_contact_community` | 旧盘源对接人名下楼盘 |
| `all` | 管理员查询全盘源 |
| `selected` | 超管明确指定的楼盘集合 |

角色可以提供默认范围，但最终范围由关系表和用户覆盖共同决定：

- 房东范围来自 `SlLandlordCommunity`。
- 维护人范围来自 `SlLandlordMaintainer` + 楼盘关系。
- 旧盘源对接人范围来自 `SlCommunity.OwnerId`。
- 创建人删除规则仍读取 `CreateUserId`，不能简化成角色的 `all`。

查询服务应该获取 `AuthorizationScope`，然后把范围条件下推到SQL。避免先查询全量Id再在内存过滤；若范围是 `all`，直接走全量条件，若是关系范围，使用JOIN/EXISTS或有索引的关联表。

## 4. 建议的数据表

表名使用独立业务前缀，避免 `sys_role`、`sys_log_op` 和框架耦合。

### 4.1 权限和角色

```text
sl_authorization_permission
- Id, PermissionKey, Name, PermissionType(menu/button/api), Route, ParentId
- Status, Sort, Description, IsSystem, CreateTime, UpdateTime

sl_authorization_role
- Id, RoleCode, RoleName, Description, IsSystem, Status

sl_authorization_role_permission
- RoleId, PermissionId, Effect(allow), CreateTime

sl_authorization_user_role
- UserId, RoleId, Source(manual/legacy/system), CreateTime, CreateUserId

sl_authorization_user_permission
- UserId, PermissionId, Effect(allow/deny), Reason, ExpireTime
- CreateTime, CreateUserId, UpdateTime, UpdateUserId
```

唯一键：角色编码唯一、权限键唯一、角色权限组合唯一、用户角色组合唯一、用户权限覆盖组合唯一。

### 4.2 数据范围

```text
sl_authorization_role_scope
- RoleId, ResourceKey, ScopeType, Description

sl_authorization_user_scope
- UserId, ResourceKey, ScopeType, Effect, Reason, CreateTime, CreateUserId

sl_authorization_user_community_scope
- UserId, ResourceKey, CommunityId, Effect, CreateTime, CreateUserId
```

对已有业务关系，不复制到这张表。`selected`只用于真正的人工例外；房东、维护人、盘源对接人的关系数据继续由各自业务表维护。

### 4.3 审计和版本

```text
sl_authorization_change_log
- OperatorUserId, TargetUserId, RoleId, PermissionId, ScopeKey
- BeforeValue, AfterValue, Reason, BatchId, CreateTime

sl_authorization_version
- VersionKey, VersionNumber, UpdateTime
```

这是一套独立授权审计，不复用框架系统操作日志。值较大时把差异存为结构化JSON，但不存密码、Token、手机号授权Code或证明材料原文。

## 5. 服务设计

将现有 `SlAuthorizationService` 保留为唯一业务入口，内部改成以下流程：

```text
GetCurrentAsync
  -> 读取用户状态和角色
  -> 合并角色权限
  -> 应用用户允许/禁止覆盖
  -> 解析端入口权限
  -> 解析数据范围策略
  -> 返回 AuthorizationSnapshot
```

### 5.1 公开给业务服务的接口

```csharp
Task<SlAuthorizationSnapshot> GetCurrentAsync();
Task RequireAsync(string permissionKey);
Task<AuthorizationScope> GetScopeAsync(string resourceKey, ScopeOperation operation);
Task RequireDataAccessAsync(string resourceKey, long entityId, ScopeOperation operation);
void Invalidate(long userId);
```

`SlCapability` 暂时作为兼容适配层：

```text
RequireCreateCommunityAsync()
    -> RequireAsync("community.create")
```

新代码不再写 `accountType >= 888`。旧服务逐步迁移，等行为对照稳定后再删除旧硬编码。

### 5.2 缓存

当前15分钟 Memory缓存先保留兼容路径，但标准RBAC上线后建议使用Redis做共享授权快照：

```text
sl:authorization:v1:user:{userId}:version:{version}
```

失效方式：角色修改、用户覆盖修改、数据范围变化、账号停用、房东/维护关系变化均递增用户授权版本并删除缓存。前端退出登录只清本地会话，不能承担服务端权限失效职责。

迁移到Redis前要完成：序列化契约、缓存不可用时默认拒绝/短期回退、跨实例失效、Redis故障测试。不能在还未完成这些测试前单纯把 `CacheType` 改成Redis。

## 6. 管理端权限设置界面

### 6.1 角色管理

```text
角色列表                         新增角色
角色名 | 编码 | 用户数 | 状态 | 操作
-----------------------------------------
角色详情
  基本信息
  菜单权限树
  按钮/动作权限树
  数据范围模板
  权限影响预览
```

菜单树与按钮树按业务模块分组；默认折叠，提供“仅看已选”。每个权限显示描述和危险等级，不用让用户猜 `slProperty:batchUpdate` 的含义。

### 6.2 用户权限

```text
用户详情
  基础信息 / 当前身份
  角色：业务员、维护人、房东、管理员...
  继承权限（只读）
  用户单独调整
      继承 / 允许 / 禁止
  数据范围
      角色默认范围
      额外楼盘 / 移除楼盘
  最终权限预览
```

最终权限预览必须显示“来源”：角色、用户允许、用户禁止、业务关系。保存前显示影响范围和生效对象。修改完成后立即刷新授权版本，不要求用户重新登录。

### 6.3 超级管理员保护

- 只有超级管理员能管理角色模板、用户权限覆盖和数据范围例外。
- 不允许把最后一个可管理权限的超级管理员降级或禁止全部系统权限。
- 高危动作二次确认，并要求填写原因。
- 角色删除前显示受影响用户；系统角色只能停用，不能物理删除。
- 审计记录可查询，但不把完整Token或材料展示给普通管理员。

## 7. 迁移步骤

### 阶段A：兼容层，不改变现有行为

1. 建立权限键字典和当前 `SlCapability` 到权限键的映射。
2. 建表、种子内置角色和权限，但只读 shadow 计算，不影响请求。
3. 把当前等级映射到系统角色，把房东/维护人关系映射为数据范围来源。
4. 输出 old/new 权限差异统计，逐条修正，不把差异默认当成“权限放大”。

### 阶段B：读取双算

1. 真实请求仍用旧规则，后台计算新快照。
2. 只记录差异的 permission key、resource key、scope type 和用户匿名化Id，不记录敏感数据。
3. 覆盖游客、业务员、房东、维护人、管理员、超管及身份叠加。
4. 验证菜单、按钮、API和SQL范围四层一致。

### 阶段C：先切低风险读接口

1. 菜单/按钮先接新快照。
2. 只读字典、列表、统计逐模块切换。
3. 写入、删除、批量、媒体和审批保留旧规则作为兼容保护，等双算稳定再切。

### 阶段D：开放管理界面

1. 超管先使用角色模板。
2. 用户级覆盖先只开放“撤销/补充一个权限”，不开放任意JSON。
3. 数据范围例外最后开放，并要求明确楼盘集合和原因。
4. 完成旧字段清理计划后，再考虑移除直接使用 `AccountType` 的业务代码。

## 8. RBAC还是换模型

推荐 **RBAC + 数据范围 + 关系授权**，不推荐纯RBAC，也不建议现在改成完整ABAC。

- 纯RBAC能解决菜单、按钮、API模板，解决不了房东楼盘、维护人受托楼盘和创建人删除。
- 纯ABAC规则弹性大，但政策表达、调试和管理员操作门槛会明显升高，当前团队维护成本不划算。
- 关系授权适合“用户维护某位房东的楼盘”这类关系，作为数据范围来源嵌入授权服务即可，不必引入完整图数据库。
- RBAC模板 + 用户覆盖满足“角色默认权限，单个用户例外”的要求，并且能审计。

## 9. 框架候选与官方依据

本轮通过官方页面状态核对：

- [微信小程序开发指南](https://developers.weixin.qq.com/miniprogram/dev/framework/)：官方原生框架。
- [uni-app官网](https://uniapp.dcloud.net.cn/)：Vue跨端框架。
- [Taro文档](https://docs.taro.zone/docs/)：跨端跨框架方案。
- [Taro GitHub](https://github.com/NervJS/taro)：支持React/Vue等框架及多个小程序端。
- [uni-app GitHub](https://github.com/dcloudio/uni-app)：当前使用的框架实现。

### 9.1 微信原生

WXML/WXSS/原生TS，微信能力和原生组件路径最直接。优点是平台行为最可预测、调试资料最接近官方；缺点是当前Vue页面、Pinia、Wot、自动路由、组件和测试几乎需要重写。地图、媒体、权限弹层、长列表和三端模式要重新建立，不适合作为当前阶段的快速止痛方案。

### 9.2 Taro

适合已有React团队或明确要同时覆盖多个小程序/React Native/H5的场景。它可以统一跨端代码，但微信原生能力仍需平台分支；当前Wot Design Uni、uni-app页面、custom tabbar、已有媒体/地图代码不能直接复用。迁移成本集中在组件、生命周期、页面配置、上传下载、地图和原生弹窗。

### 9.3 继续使用uni-app + Vue

当前项目已经在使用，这是最合适的近期路线：工具链、生产构建、体验版上传、地图、微信媒体和既有页面都已验证。`unibest`是项目脚手架，不能被当成运行时框架问题；大型页面、权限分支和状态管理可以在现有框架内模块化治理。

当前项目的依赖已经是 Vue 3、uni-app、Pinia、Wot、Alova、UnoCSS、z-paging 和 uni-ku。也就是说，项目并不是“没有标准框架”，而是已有标准跨端栈上叠加了较多业务代码。近期较稳的做法是按 Wot Starter/Vitesse 的目录与边界逐步整理，而不是创建第二套项目。

Wot Starter 是值得参考的**脚手架**，不是必须迁移的运行时框架。官方 Starter 当前 v2 路线采用 Wot UI V2、`@wot-ui/router`、Pinia、Vite 和 uni-app；本项目仍是 Wot 1.x 依赖。若直接整包迁移，会同时引入组件API、主题、路由和页面配置变化，必须先做组件兼容矩阵。

### 9.4 推荐结论

**暂不迁移框架。** 先在现有uni-app上完成：

1. RBAC授权快照和领域模块边界。
2. `PageShell / QueryState / Filter / Media / Overlay / SelectionToolbar`共用组件。
3. 地图轻点、列表查询、缓存和权限范围优化。
4. 把地图、批量房源、楼盘表单拆成页面编排 + composable + 领域组件。

### 9.5 候选框架对比

| 方案 | 标准化程度 | 当前代码复用 | 微信能力 | 迁移风险 | 结论 |
|---|---|---:|---|---:|---|
| 当前 uni-app + Vue | 高，已在生产链路验证 | 最高 | 通过uni适配，已有真实验证 | 低 | 近期首选 |
| Wot Starter v2 | 高，提供更干净的uni脚手架 | 中高，但Wot 1→2需适配 | 与当前同属uni-app | 中 | 作为目录/脚手架参考；先做组件兼容，不整包覆盖 |
| Vitesse uni-app | 高，偏基础模板 | 中 | 同上 | 中 | 适合新项目，不能解决现有业务复杂度 |
| Taro 4 + Vue3 | 高，多端跨框架 | 低 | 编译适配层，原生能力需逐项验证 | 高 | 只有多端/React团队是硬需求才做POC |
| 微信原生 WXML/WXSS/TS | 微信平台最高 | 很低 | 最直接 | 很高 | 只有确定只做微信并接受重写才选 |
| TDesign MiniProgram | 原生组件体系成熟 | 低 | 原生微信组件 | 高 | 可作为原生迁移的UI组件候选，不是当前uni-app的直接替换 |
| uni-app x | 新一代uni路线 | 低到中 | 需逐项核实微信端组件/插件 | 高 | 当前业务不作为第一迁移目标 |

官方资料确认了 Taro Vue3 的支持，但文档同时存在小程序组件和样式限制，需要对当前大量Wot/uni组件逐项替换；这不是无痛迁移。Wot Starter v2 的官方仓库仍在维护，且有明确的 v1/v2 依赖差异，因此更适合建立一个很小的兼容POC，而不是直接把生产分支切换过去。

如果未来明确要React团队接管或多端输出成为硬要求，再做Taro POC。如果明确只做微信并愿意承受40–70个工作日级别的重写，再评估原生。这个估算包括主链路、媒体、权限、地图、三端和真机回归，不是只把Vue模板翻译成WXML。

## 10. 框架迁移POC的最小范围

当业务确认要比较时，建独立目录/分支，只做同一页的对比：

- 微信登录与手机号授权。
- 地图一个marker和楼盘摘要。
- 房源分页筛选。
- 选择两个视频、上传封面、预览和保存相册。
- 角色/用户覆盖权限渲染。
- 生产相同API、测试同样的错误和刷新流程。

比较指标：冷启动包体、首屏可用时间、地图交互、媒体成功率、浮层滚动、真机错误率、开发体验、测试量、上线流程。POC通过这些指标前不能宣布迁移。

POC建议优先比较 **当前栈整理版 vs Wot Starter v2 新壳**，两者都使用uni-app；只有这项比较无法满足维护需求，再比较 Taro Vue3。这样能先回答“脚手架/架构是否导致问题”，避免把业务缺陷误归因于uni-app。

## 11. 最终建议

现在先做权限，不先换框架：

```text
定义权限键和数据范围
 -> RBAC兼容层/双算
 -> 超管角色与用户覆盖界面
 -> API和SQL数据范围切换
 -> uni-app页面模块化
 -> 性能P0/P1
 -> 有明确跨端需求时再做Taro/原生POC
```

这个顺序能保留当前已验证的发布能力，同时把以后迁移最需要的业务权限、接口契约和组件边界先稳定下来。

## 12. 技能检索与使用建议

### 12.1 当前已经可用的技能

| 技能 | 适用工作 | 使用方式 |
|---|---|---|
| `ui-ux-pro-max` | 信息架构、移动端交互、密度、无障碍、组件状态和设计检索 | 每次页面/组件改动前做针对性查询 |
| `wechat-miniprogram-ui-ux` | 微信小程序页面结构、rpx、安全区、原生控件、浮层和状态设计 | 小程序页面及交互设计的第一约束 |
| `miniprogram-development` | 微信开发者工具、构建、预览、体验版上传和发布 | 所有构建/上传/真机调试任务 |
| `uni-app` / `uniapp-project` | uni-app API、页面、组件和平台差异 | 处理跨端和微信兼容问题 |
| `design-system` | Primitive → Semantic → Component 三层Token和组件规格 | 建立绿色品牌的统一Token |
| `frontend-design` | 视觉方向、排版、自我审查和避免模板感 | 页面整体方向或较大重做 |
| `playwright` | H5/Web页面交互和响应式检查 | Web后台和H5辅助验收，不能替代微信真机 |
| `wechat-devtools` | 编译、页面数据、自动化交互、截图和CDP日志 | 微信运行时证据 |
| `zcode-delegate` | 独立的前端方案/代码第二意见 | 只委托隔离、边界清楚的任务；不并行写当前工作树 |

### 12.2 外部技能搜索结果

本轮先执行 `npx skills find`，但本机 npm 缓存返回 `EEXIST/EBADF` 重命名错误；为避免无效重试，改用 `skills.sh/api/search` 只读检索，没有安装任何外部技能。

检索结果中与本项目最相关的是：

- `uni-helper/skills@uni-app`：与当前本地 `uni-app` 技能方向重复，不能解决现有业务代码问题。
- `partme-ai/full-stack-skills@uniapp-project`：可作为API参考补充，但当前已有 `uniapp-project`。
- `gourdbaby/wechat-miniprogram-skill` 与 `joneqian/claude-skills-suite@wechat-miniprogram`：主题相关，但当前已有微信小程序开发和UI专项技能，暂不叠加。
- `wechat-miniprogram/skyline-skills@skyline-components`、`skyline-worklet`、`skyline-route`：只适合明确迁移微信 Skyline 渲染体系的阶段；当前没有迁移条件，也不能直接解决业务权限、媒体和数据范围问题。
- `anthropics/skills@frontend-design`：高使用量通用视觉技能，当前已有本地 `frontend-design`，不重复安装。
- `leonxlnx/taste-skill@design-taste-frontend`：可作为第二视觉审查意见，适合在页面初稿完成后做批评；不承担微信原生交互验证。
- `vercel-labs/agent-skills@vercel-react-best-practices`：面向React/Next.js，不适合当前uni-app主链路。
- `full-stack-skills/testing-skills@playwright`：可辅助Web测试，当前已有本地Playwright技能。
- `media-upload`、`database-performance` 等搜索结果使用量低且没有本项目上下文，不作为核心依据。

### 12.3 推荐组合

```text
权限/后端设计：本项目架构方案 + design-system 的结构化Token思路
小程序界面：wechat-miniprogram-ui-ux + ui-ux-pro-max
小程序开发/发布：miniprogram-development + wechat-devtools
uni-app API：uni-app + uniapp-project
Web后台：ui-ux-pro-max + frontend-design + playwright
第二意见：必要时隔离委托 zcode，不并发改同一工作树
```

当前不建议继续堆叠技能。技能能提高检查和实现质量，不能替代权限模型、数据范围和页面状态设计；本项目的主要风险仍在这些业务边界。
