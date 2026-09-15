# 0.4.46 实施进度与验收索引

用户目标：根据架构/RBAC方案实施，最终提供验收清单。当前状态：进行中。

最新本地验证与缺口见本文末尾“授权失效与Shadow续作”，以及 RBAC_MUTATION_AND_SHADOW_EVIDENCE.md。旧段落中的测试数量、DLL哈希均是当时记录，不能视为当前服务复核结果。

2026-09-11 16:32最新状态：后端460项通过、2既有跳过；账号状态读取与媒体范围守卫已部署测试服务。独立合成账号的19项Enforced真实HTTP验证通过，之后已恢复Shadow并清理数据。报告为rbac-http-report-v4.json，详情以DEPLOYMENT_LOG.md末尾记录为准。

## 工作边界

- 前后端工作树均在 `release/0.4.46`。
- 生产服务、数据库、当前小程序版本不在本次直接变更范围。联调使用 `adminet_test`。
- 所有改动必须与旧接口兼容；不覆盖其他会话改动，不自动合并到master或推送。
- Wot V2技能已安装，但当前项目仍用Wot 1.x；先使用现有稳定组件，不直接升级依赖。
- 管理员/超管即使兼有房东身份，也可进入管理端、业务员端和房东端；普通房东只能进入房东端。

## 关键实现决定

1. 数据范围按动作键区分，例如 `supply.read`、`supply.write`、`supply.delete`，不能把读取范围复用于写入。
2. 用户权限有继承/允许/禁止；用户范围覆盖替换该动作的角色默认范围，指定楼盘禁止优先。
3. 使用独立 `SlAuthorizationUserProfile.IsManaged` 区分未迁移和主动清空角色，避免空角色回退旧权限。
4. 权限配置关闭时走现有逻辑；开启后未迁移用户继续旧模型，已迁移用户的新模型失败必须报错，不能吞异常回退扩大权限。
5. 系统超管管理权限受保护，角色/权限配置管理不得由普通用户自行提升。
6. 本轮不会为身份/权限改动写入整套 `SysUser` 配置；旧业务身份关系和新角色模板分离。

## 进度

| 工作 | 状态 |
|---|---|
| 已安装技能检查 | 已完成 |
| 权限/角色/用户覆盖/范围/审计实体 | 已编译；测试库建表完成 |
| 权限键目录和纯合并规则 | 8项行为测试通过 |
| 数据库迁移、内置角色种子 | adminet_test连续执行两次通过：6角色/20权限/49关系/11范围，0接管用户 |
| 授权快照加载、兼容接入、缓存失效 | 模式/共享版本/到期与业务变更通知已接入；账号最小字段使用独立连接核查，框架入口停用/注销/清手机号后旧Token真实HTTP401。真实多实例HTTP仍待补齐 |
| 后端角色/用户权限管理接口 | 已编译并部署测试服务；超管目录/角色 CRUD、乐观锁和保护权限真实 API 回归通过 |
| 小程序角色与个人权限管理界面 | 页面/API/超管入口已写入，类型检查与定向ESLint通过；尚无运行时视觉验证 |
| 读取/修改/删除范围接入现有API | 楼盘/楼栋/房源列表与详情、批量快照、字典写入、媒体修改及目标创建人判断已接入；统计嵌套、经营端、批量写全链路仍需接口级负向验证 |
| 经营端与嵌套统计补充 | 本地已分离端入口/读取/修改；同步全房源先做范围预检；楼栋/区域统计与佣金计算加入读取范围，电话按能力输出。尚未部署，负向HTTP回归未完成 |
| 公共坐标边界 | 本地已移除楼盘坐标均值回退，仅用区域/上级配置；无点位区域保留列表。新地图显式请求无点位区域并过滤无效点，兼容旧地图调用不返回0,0 |
| 测试环境全链路与权限负向验证 | Enforced合成账号19项HTTP通过，含Selected楼盘隔离、非创建人删除、媒体元数据/预览/复制来源、停用/注销/手机号与撤权。当前已恢复Shadow；其余业务接口和APP真机待继续 |
| 最终验收清单 | ACCEPTANCE_CHECKLIST.md已建立全范围验收草稿，逐项待补证据；不是验收通过说明 |
| 后续性能与UI标准化阶段 | 尚未开始，保留原方案范围 |

## 后端已新增文件

- `Api/ShenLe.Application/Entity/SlAuthorization*.cs`
- `Api/ShenLe.Application/Enum/SlAuthorizationEnums.cs`
- `Api/ShenLe.Application/Service/SlRbac/SlPermissionCatalog.cs`
- `Api/ShenLe.Application/Service/SlRbac/SlRbacPolicy.cs`
- `Api/ShenLe.Application/Service/SlRbac/SlRbacStore.cs`、`SlRbacManagementService.cs`、`SlRbacSnapshot.cs`、`Dto/SlRbacDto.cs`
- `scripts/migrations/20260911_rbac.sql`（已在测试库验证）

## 继续实施注意

- 当前SourceContact工作树包含未提交的新文件和修改，不得覆盖或清除。
- SlAuthorizationService默认Legacy；测试服务已配置Shadow，尚未切Enforced。
- 不引入第二个含义重复的`supply.write-all`权限。兼容WriteAllSupply能力应从supply.write的All范围派生，且不能绕过明确排除的楼盘。
- Shadow仅计算不授权已接入但仍需真实用户对照；后续必须验证Enforced才接管；数据库异常不得回退旧权限；缓存过期/权限版本/撤销角色要闭环。
- 测试已经覆盖合并规则、缓存并发、SQLite版本提交/回滚和七种数据范围，但仍不代表所有MySQL业务接口或前端真机已验收。
- 最新后端全量测试391通过、2跳过，含经营端入口/别名、SQL读写范围、公共预览真实SQLite调用；解决方案构建通过。小程序267项测试、类型检查、定向ESLint通过。本轮最新公开坐标前端改动尚未重新生成小程序产物或真机验证；不能复用旧构建结果作为新代码运行证明。
- 已新增小程序 `src/api/rbac.ts`、`src/pages/admin/authorization/index.vue`；MyAccessOutput增加rbacEnabled/isRbacManaged/permissionKeys/roleCodes。
- 新增src/utils/authorization.ts：已接管用户以permissionKeys为准，空集合不回退；auth/mode、保护路由、区域标签入口、房源修改与删除入口已部分接入。用户管理页面、地图榜单、更多管理按钮仍需继续清查。
- isAdmin表示管理员身份，不能直接等同portal.admin。受托维护人/自定义角色可获端入口，而具体动作要独立校验；普通房东限制仍保留。此处与后端端入口约束还需统一验证。
- 角色/用户保存已改为同事务递增sl_authorization_version；缓存命中读取一个共享版本，重算前后校验，独立读连接隔离写事务，可避免提交前回填。旧Invalidate用于身份关系、停用和登录的链路尚未接版本递增，仍有跨实例/并发失效风险。
- 未增加批量接管全部用户入口；SaveUser显式设置IsManaged，避免在无双算证据时迁移所有用户。
- `pnpm exec wot`不可用：安装的是技能文件，CLI工具本身尚未安装；UI保持当前Wot 1.x组件，不能假称V2接口已验证。

继续工作时先读本记录和实际 git diff，勿把实体已写入等同于RBAC已落地。

## 当前测试服务实况

- 2026-09-11 11:29部署到https://shenzuyk.com/test-api，数据库adminet_test，容器shenle-test-app。默认源码配置Legacy；测试覆盖配置Shadow。
- 12:59测试当前DLL：007b9549cb3d2746a7bfb27d93c80b2e853899af142f81a08d52b4e5df194b7d。最近回滚点/home/ubuntu/shenle-test/backups/rbac-scope-public-20260911-124500，详情在后端DEPLOYMENT_LOG.md。
- 新增共享版本表已迁移。数据库接管用户仍为0，不得启用Enforced。RbacShadow字段及计算已补充部署；尚缺未迁移用户映射及差异报告，不能把字段存在称为完整Shadow。
- 真实接口：公共regionMap 200/17区域；普通管理员catalog/roles 400；超管catalog 200/20项、初始roles 200/6项；匿名catalog 401；旧用户myStatus为rbacEnabled=true且isRbacManaged=false；楼盘page 200。
- 测试角色847595165147269，roleCode=verification_20260911；创建、详情、清空权限、停用、乐观锁冲突和根权限保护均验证。验证后角色和空关系已清理，保留审计；从未分配给用户。11:43部署后HTTP回读角色数6，验证角色数0。
- 生产服务、adminnet和生产媒体未修改；未上传小程序体验版、未提交或推送。临时SQLite失败构造产生的13个文件已清理。
- 变更文件检查：后端37个、前端24个新增/修改文件均无UTF-8 BOM，git diff --check通过。当前工具集合没有WeChat MCP；本轮未启动或重启开发者工具，未进行微信运行时视觉验收。

## 下一阶段明确缺口

1. Shadow未迁移用户映射和脱敏差异日志已在本地实现；待测试服务回放、差异分类和SQL记录级对照，不能直接打开Enforced。
2. 房东/维护关系、业务账号等级/注销、手机号更新已与事务版本联动；账号主键字段实时核查覆盖框架写入入口。需继续验证多实例HTTP与命中路径两次主键读取的性能。
3. 所有嵌套统计/佣金、经营端、媒体读取与挂载、批量操作、联系人电话及端入口继续审计并验证；不要只凭WithinReadScope搜索结果宣布完整覆盖。
4. 角色/用户界面补保存前权限预览、到期覆盖编辑、错误/空态；补用户保存的真实API回归。
5. 授权入口和按钮全量接入、前后端端入口规则一致；当前没有微信运行时/截图/真机验证证据。
6. 继续原方案中性能、日志、媒体索引、地图/列表、缓存局部刷新、页面组件、视觉和媒体任务/恢复阶段，最终统一输出验收清单；不得只把RBAC基础当作完整目标。

## 后续补充证据与约束

- 经营端入口集中到SlAuthorizationService.RequirePortalAsync；SQL关系与动作范围集中到SlRbacQueries.PortalReadScope/PortalWriteScope，未另保留独立授权服务。
- 经营端公开配置读取不要求写能力；保存楼盘配置使用写范围；批量佣金/多套推广要求BatchWriteSupply；ApplyToProperties在楼盘写入前预检所有房源，不能先写楼盘再发现子房源无权。
- 定向策略/SQL/接口结构测试40通过。新的服务级拒绝测试未纳入通过证据：测试工程包含Furion及Furion.Pure，缺真实宿主时友好异常初始化失败，已清理尝试用的测试文件与依赖变更。不能用纯策略测试替代后续负向HTTP验收。
- 公共坐标纯策略4通过，SlPublicService真实SQLite方法调用通过：保留全部区域、区域筛选仍可取上级中心、孤立单楼盘坐标不出现在返回值；旧Map默认排除无点位，RegionPage保留全部。
- 日志只读发现：Application/Configuration/Logging.json仍开启全局Monitor和全返回值；Core/Logging/LoggingSetup.cs将IgnorePropertyNames覆盖为Byte，数据库写入器读取认证声明/参数/返回值。仅改IgnorePropertyNames JSON不足以证明安全，不修改Core，待业务扩展点与运行验证一起完成。
- 经营端、统计及公共坐标更新已部署测试服务，保持Shadow；新版公共map/page均返回29区域（map显式请求无坐标项时19项无坐标）。普通管理员楼盘page、楼栋stats/list均200。当前接管用户仍为0，后续只用独立合成测试账号。
- 范围审计仍未完：通用楼盘Page筛选子查询、列表BuildingCount、活动/榜单、媒体签发与挂载等还需核对；经营端负向HTTP验证尚缺。当前不能开启Enforced或宣称权限已整体完成。
- 本轮最终文件门禁：后端47个改动/新增文件、前端28个改动/新增文件BOM扫描通过，git diff --check通过。新触及的SlPublicDto.cs及SlPublicService.cs原有BOM已去除，无其他业务内容改写。
- P0日志：业务层精简请求诊断已部署测试服务，诱饵头/票据/正文/返回值0命中，TraceId可回读；原系统历史日志未删，24小时增量与生产验证仍待完成。

## 当前收尾状态

- 最新测试服务DLL：8250dc5cfbda39a73ba424327a2b8634d257bf878a7e6166426f8d37c9211ad6，回滚点/home/ubuntu/shenle-test/backups/safe-diagnostics-20260911-143000，仍为Shadow。后加的日志提供器失败保护只在本地测试，未再次部署。
- 最新自动化：后端410通过、2既有跳过；前端300通过；类型检查、定向ESLint、测试小程序构建和BOM/diff检查通过。继承的Startup.cs BOM已清理。
- 精简请求日志只保留MVC路由模板、状态、耗时、声明ContentLength、TraceId、异常类型/方法栈；不读取原始请求或响应正文。ContentLength未提供时保持空，不冒充已测字节数。
- 技术日志仍缺SQL计数/耗时、实际响应字节、MVC之前401/404等全链路观测、旧SysLogOp/SysLogEx查看界面兼容、24小时增长和轮转验证。日志体系未整体完成，不据此发布生产。
- 缓存边界区分登录代号和权限代号，避免后台权限刷新使用户的主动退出失效。43项相关测试覆盖Token不变重新登录、权限版本变化和并发退出；普通昵称变化不清数据缓存。
- 查询回放基线已从临时目录归档为本目录community-paging-baseline.json，仅含场景、总数和摘要哈希，可用后端Test-CommunityPaging.ps1复核；无Token、媒体URL或账号资料。
- 运行工具现有9421/9420端口可见，本轮只读CLI帮助，未重启、未改登录、未上传；微信视觉和真机验收仍待完成。
- 一次配置路径误写产生的文件已删除；E:/WorkSpace/WorkSpace-MiniApp/ShenLe_SourceContact下只剩空目录，空目录删除被工具策略阻止，未绕过。
- P1-A媒体索引：仅在adminet_test新增idx_sysfile_belong_filetype_20260911，997行扫描变为1行索引查找，结果哈希一致，重复执行与等价索引检测已实现。完整媒体写回归及生产批准仍待完成，详见后端部署记录。
- P1-A补充：临时表复制/挂载/解除/删除验证通过，真实文件表数量未变；现有媒体挂载/房源批处理自动化97项通过，未进行生产媒体写入。
- P1-B数据库分页已部署测试服务：当前DLL为001b288a1f7f0b79529c40d8f53532b3483e6234a35e7475fa2f5e8000c17fc6，DatabaseCommunityPaging=true。旧接口14组摘要与新接口连续两次完全一致。回放脚本和回滚路径见后端部署日志。生产未部署。
- P1-C会话边界：request层token+revision校验、当前401清理、旧响应/失败丢弃、房东store按会话/端/generation去重已实现；新增28项回归通过，类型检查和定向ESLint通过。微信真机和所有页面请求键仍待验收。
- P1-C媒体临时缓存：按API环境/会话revision/文件Id隔离，最多64个路径引用、5分钟TTL、原生文件存在性检查、在途去重和会话清空；新增12项回归通过。媒体预览真机弱网仍待验收。
- 授权版本已加入MyAccessOutput并参与前端授权签名；权限版本变化即使Token不变也会清理在途/媒体/经营缓存，昵称变化或权限键重排不会误清理。新增42项相关回归通过；后端该字段尚未重新部署测试服务。
- 测试产物：pnpm build:mp:test成功，dist/dev/mp-weixin包含测试API地址；未上传体验版、未启动/重启开发者工具，未做真机运行证据。

## 2026-09-14 当前继续实施

- 关键数据版本：`sl_data_change_log` 已在 `adminet_test` 建表并通过独立SSH回读；不记录Token、密码或证明材料正文。
- 变更写入：楼盘、楼栋、房源的单条新增/编辑/删除/状态修改，以及房源批量新增/编辑/删除/状态/混合保存均已接入前后快照；楼盘归属、火热等级、楼盘经营配置、房源经营配置和批量经营同步也已纳入审计。
- 版本恢复：仅超级管理员可操作；恢复前使用当前快照与历史修改后快照做结构比较并加行锁，后续已修改时拒绝覆盖；恢复动作会产生新的审计记录并保存恢复原因。
- 管理入口：小程序管理端“我的”新增“数据变更记录”，支持对象/动作筛选、前后字段差异、操作原因和恢复确认。
- 真实测试：测试服务 `shenle-test-app` 已更新到本轮后端；`Test-DataChangeHttp.ps1` 在 `adminet_test` 创建并清理合成数据，最终回归8/8通过，包含乐观并发拒绝。报告：`docs/optimization/2026-09-14/data-change-http-report-v4.json`。
- 性能样本：测试API只读区域聚合20次顺序请求，0错误，P50约69.54ms、P95约509.76ms；报告：`docs/optimization/2026-09-14/performance-baseline-v1.json`。该样本不是压力测试，也不代替移动网络真机数据。
- 配置边界：源码开发授权模式统一为 `Shadow`，测试服务仍为 `Shadow`；未启用 `Enforced`，未部署生产。
- 已知测试服务日志：容器停止阶段出现既有 Furion Schedule `ObjectDisposedException`，随后新进程正常启动；尚未修改框架核心或用全局忽略掩盖该问题。

## 授权失效与Shadow续作（2026-09-11）

- 本轮只改本地后端及本目录文档；两工作树仍为release/0.4.46，不提交、不推送，不部署测试或生产，不上传小程序。
- InvalidateAsync将业务身份/关系/等级/注销/手机号变更接入原事务内的共享版本。维护人列表、房东批量设定和多楼盘归属通知合并；普通手机号未变化的登录保留本地缓存清除，不触发全局版本写入。
- SlUserManage的Approve/SetRole/DeleteUser补UnitOfWork，避免账号变化、申请记录、授权版本部分成功。Legacy仍不访问RBAC表，完整跨实例保证限Shadow/Enforced。
- Shadow对未迁移用户只读加载内置角色模板，不创建用户配置或分配记录；已接管空角色不会回退。旧SlLandlord只表示旧对接人，不能映射房东；普通房东不额外叠加sales。
- 一致快照首次加载后记录RBAC_SHADOW差异，缓存命中不重复。内容仅为进程内HMAC匿名标识、共享版本、接管状态、权限键、范围类型和例外数量，不序列化姓名/手机号/原始用户Id/楼盘Id。
- 最新后端全量：433通过、2个既有交互测试跳过；前端41文件/300测试通过，type-check通过，所有本轮工作树变更TS/Vue文件定向ESLint通过。全仓pnpm lint失败：1022错误，涉及旧设计稿/官网等范围外文件，未运行自动修复。
- 依赖检查仍有AngleSharp/log4net/MailKit既有NU1902告警及漏洞源NU1900；本轮未升级依赖，不能据此宣称依赖安全验收完成。
- 仍未完成：框架SysUser修改/停用/BaseInfo等入口、真实Enforced负向HTTP、媒体授权审计、Shadow线上日志证据与实际记录集合差异、微信运行时/真机、后续性能/UI阶段。
- 详细新测试与后续顺序见RBAC_MUTATION_AND_SHADOW_EVIDENCE.md。此记录不是整体验收通过说明。

## 账号状态及媒体接口续作（2026-09-11 16:32）

- SlAuthorizationAccountReader每请求一次最小账号状态查询，缓存重算前后均校验；停用/删除不返回状态，手机号/等级/昵称变化不沿用旧快照。权限和关系仍缓存，未改框架事件或Core。
- 媒体过滤器保留现有SysFile路由和传输实现：APP用户及Enforced已接管PC用户在业务范围校验后才能读取；框架未接管PC沿用原规则。业务文件IsPublic不越过实体范围，视频封面继承原视频，申请材料按申请人隔离。
- 跨对象复制新增来源读取预检；已接管自定义角色可进入范围预检，不再仅靠888数字等级决定，目标写权限仍由业务服务预检。
- 460项后端测试/2跳过；真实HTTP19项通过。测试库合成文件必须包含真实上传AOP会写入的TenantId/OrgId，首次404及漏字段失败过程已归档到RBAC_HTTP_ATTEMPTS.md，不作为业务缺陷或成功证据。
- 已部署至shenle-test-app，DLL cd581a9df942c70231ab381ef1fd62fab104646f098af1f1927ef1cd95f6d49e。临时Enforced验证后恢复Shadow；独立SSH核查合成账号、楼盘、媒体、角色、范围记录全部清理、接管用户0。
- 仍待：全部楼栋/房源/经营/统计/批量HTTP、微信APP/真机、真实COS下载成功链路、媒体元数据集合查询性能、后续地图/列表/UI及原方案剩余阶段。本轮没有小程序上传或Git提交推送。

## 2026-09-14 继续实施记录

- 用户权限管理界面已接通：用户列表显示独立RBAC接管状态和业务角色名称；已接管用户隐藏旧账号等级切换，保留“权限设置”；超级管理员可从“我的”进入“角色与权限”及“用户管理”。
- 后端用户列表和权限详情新增角色名称输出；测试接口真实回读成功，用户列表字段包含 `isRbacManaged`、`rbacRoleNames`，角色接口返回6个角色。
- 地图性能改造已完成第一版：新增 `/api/slCommunity/mapPoints` 轻量点位接口，地图不再循环请求完整楼盘分页；点选楼盘后按需请求详情，旧 `/page` 接口保留。
- 测试服务已更新到本轮地图点位代码，仍为 `Shadow`、`adminet_test`；接口真实回读返回551个点位，包含无房源统计的楼盘，结果口径与旧地图一致。
- 本地验证：后端 `dotnet test` 为460通过、2既有跳过；后端Release/net8.0 publish成功；前端全量42个测试文件、309项通过，type-check、定向ESLint、测试环境小程序构建通过。
- 生产边界：本轮未部署生产、未访问或修改 `adminnet`、生产媒体和生产配置；未上传体验版、未提交或推送。
- 仍待：地图与列表微信运行时和iOS/安卓真机耗时验证、剩余楼栋/房源/经营/统计/批量HTTP回归、权限入口真机验收、日志轮转与压力测试、页面组件拆分及版本恢复功能。

## 2026-09-14 继续实施补充

- 权限管理：用户列表已显示旧账号等级与独立RBAC业务角色；RBAC接管用户隐藏旧等级切换；“权限管理/权限设置”入口对超级管理员可见；用户权限覆盖支持设置或清除到期日。
- 地图性能：管理/业务地图使用轻量 `mapPoints`，保留全部筛选结果；点选后单独读取详情；地图和楼盘列表首次自动定位在无距离条件时不重复请求；楼盘列表首屏从200条收敛为20条，继续通过分页加载。
- 日志治理：测试服务已关闭框架完整返回值监控，精简诊断保留路由、状态、业务码、耗时和TraceId；测试容器实际启用 `json-file` 轮转 `50MB × 3`。生产配置仅在本地权威文件准备，未部署。
- 新增地图等价回放脚本：`scripts/verification/Test-CommunityMapPoints.ps1`；测试环境10/10场景与旧分页楼盘ID集合和数量一致，报告在前端 `docs/optimization/2026-09-11/community-map-points-report-v1.json`。
- 当前验证：后端全量460通过、2既有跳过；前端全量309通过；后端Release发布及测试服务部署成功；前端测试环境小程序构建成功并指向 `https://shenzuyk.com/test-api`。
- 仍待：真实微信开发者工具运行态、iOS/安卓真机卡顿对比、剩余业务接口负向回归、日志24小时增长统计、压力测试、页面组件拆分、关键数据版本恢复和最终分阶段提交。

## 2026-09-14 最终继续实施记录

- 数据版本保护：快照写入覆盖楼盘/楼栋/房源主数据及经营配置、归属、火热等级、批量同步和级联删除；房源快照不保存联系人电话。
- 恢复保护：超级管理员恢复前校验当前版本、封面媒体归属和房源楼盘/楼栋关系；冲突或关联失效时拒绝恢复，并记录恢复原因。
- 测试服务最终程序集已更新到数据版本保护代码；`adminet_test` 未残留合成数据；`Test-DataChangeHttp.ps1` 最终回归7/7通过，报告为 `docs/optimization/2026-09-14/data-change-http-report-v3.json`。
- 最新门禁：后端全量 `464` 通过、`2` 个既有交互测试跳过；前端全量 `43` 个测试文件、`311` 项通过；类型检查、测试构建、定向ESLint、git diff检查通过。
- 前端全量测试改为文件串行执行，修复了 Pinia/uni mock 和 fake timer 的跨文件污染；串行全量 43/43 文件、311/311 项稳定通过。
- 查询性能补充：在 `adminet_test` 验证并幂等保留房源筛选索引与活动明细索引；代表 `EXPLAIN` 行数约44降至2，活动明细移除 `filesort`。报告与迁移记录见后端 `DEPLOYMENT_LOG.md`。
- 受限负载样本：测试 API 区域聚合 5 并发/50 次只读请求，0 错误，P50 约104.34ms、P95 约352.03ms、P99 约390.31ms；测试容器当时约297.7MiB、CPU约0.06%。报告：`docs/optimization/2026-09-14/performance-load-v1.json`。
- 仍未完成：iOS/安卓真机视觉与弱网验收、完整Enforced负向接口矩阵、日志24小时增长样本、业务确认的保留期和批量恢复上限。模拟器运行态已验证地图、数据变更、角色权限页面及console无error；生产环境未操作、未提交或推送。
- RBAC真实HTTP复核：19/19通过，覆盖楼盘范围、媒体读取/预览/关联、创建人删除、撤权和账号状态失效；报告 `docs/optimization/2026-09-14/rbac-http-report-v6.json`，合成数据已清理。
- RBAC嵌套资源扩展复核：30/30通过，新增楼栋/房源/统计/批量列表/地图点位的 Selected 范围正负向HTTP验证；报告 `docs/optimization/2026-09-14/rbac-http-report-v7.json`。
