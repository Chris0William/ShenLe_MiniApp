# 授权变更通知与Shadow对照证据

日期：2026-09-11。范围：本地 `release/0.4.46` 前后端工作树；此次没有部署、上传、Git提交或推送。

## 本轮实现

| 链路 | 变更 | 尚缺证据 |
|---|---|---|
| 角色/用户RBAC配置 | 继续使用原事务内共享版本递增 | Enforced真实业务接口验证 |
| 房东身份、维护人、楼盘归属 | 原业务事务内通知共享版本；涉及旧维护人和新维护人，批量集合去重 | MySQL并发/多实例HTTP |
| 旧盘源对接人及分配 | 身份变化与归属变化通知共享版本，批量身份设定统一通知 | 旧客户端实际路径回归 |
| 用户审批/等级/注销 | 补UnitOfWork，数据与版本同提交/回滚 | HTTP失败注入及黑名单副作用回归 |
| 微信可信手机号 | 值变化才递增共享版本，未变化登录仅清当前实例缓存 | 微信凭据真实流程 |
| Shadow未迁移用户 | 等级+新房东/维护人关系只读映射当前模板，旧对接人不变成房东 | 存量真实账号矩阵回放 |
| Shadow日志 | 一致快照加载后仅记录差异；HMAC匿名标识不跨进程稳定 | 测试服务日志实测及增长观测 |

`InvalidateAsync` 必须在业务写事务中等待完成；不能用fire-and-forget或事务外异步事件替代。新模式版本推进失败必须让业务事务失败，不能继续返回保存成功。Legacy不依赖新表，仍是旧模式兼容路径，不宣称具备新模式的跨实例保证。

## 验证命令与结果

后端工作树执行：

```powershell
dotnet test Api/ShenLe.Test/ShenLe.Test.csproj --no-restore -v minimal
```

结果：433通过、2跳过。跳过的是既有 `UserTest.Login` 和 `UserTest.AddUser`。测试使用独立临时SQLite文件，并由测试Dispose清理；没有向MySQL或COS写入测试数据。

新增关键测试：

- `SlAuthorizationSnapshotCacheTests.Relationship_change_advances_once_for_all_affected_users`：Shadow/Enforced批量通知一次版本更新、逐用户去重移除。
- `Legacy_and_empty_mutations_do_not_touch_rbac_tables`：旧模式与空变更不访问新表。
- `Mutation_version_failure_is_not_hidden_by_local_cache_removal`：版本写失败原样传播。
- `Relationship_invalidation_during_another_instances_load_discards_old_grants`：并发关系变更不会把旧权限标为新版本。
- `SlRbacDatabaseTests.Relationship_and_cache_revision_commit_or_rollback_together`：真实SqlSugar关系删除与版本同事务，两个独立缓存通过已提交版本失效；回滚保留原权限。
- `Shadow_maps_unmanaged_user_without_persisting_roles`：模板加载不创建接管标记/用户角色、不推进版本，停用模板不再贡献权限。
- `Shadow_does_not_map_legacy_roles_for_explicitly_managed_empty_user`：显式空角色不恢复旧管理员权限。
- `SlRbacShadowPolicyTests`：9种等级/业务身份组合、无手机号/匿名、动作及范围差异、例外集合只记录数量、日志不含敏感标识。

前端工作树执行 `pnpm test -- --reporter=dot`：41文件、300项通过；`pnpm type-check`通过。所有当前变更的TS/Vue/JS文件使用 `pnpm.cmd exec eslint --` 逐参数传入后通过。

全仓 `pnpm lint` 失败，有1022项错误，输出涉及旧设计稿、HTML和官网脚本；未运行 `--fix`，未修改相关文件。此结果不能被定向ESLint通过替代。

## 必须继续的工作

1. 框架通用用户修改路径现已通过SlAuthorizationAccountReader解决：按主键只读已提交最小账号状态，不使用提交前异步事件、不修改Core。新增SQLite及HTTP证据覆盖停用/注销/手机号，仍需补性能样本和多实例验证。
2. Shadow当前比较动作及范围表达式，并非逐条实际楼盘/房源SQL结果对照。日志差异不能直接当作越权结论，也不能自动修成新旧完全一致。
3. 当前guest模板没有 `portal.business`，而旧游客可进入业务员预览；super_admin模板含全部端入口，但房东端仍需要真实关系。需对模板和最终端入口一起对照，不盲目用增加角色权限抹平差异。
4. 只读映射不接管用户，不升级测试服务模式；真实Enforced验证只能使用独立测试账号/数据，且始终连接 `adminet_test`。
5. 媒体读取/签发/挂载、权限撤销、多个用户的正负向HTTP、微信运行时和iOS/安卓真机还未完成。本轮未产生新的微信构建或体验版。
6. 后续性能、UI、媒体队列与恢复阶段仍保留原范围；参考完整ACCEPTANCE_CHECKLIST.md逐项补证据，不将本轮工作视为整套优化已完成。

## 后续真实接口证据

2026-09-11 16:32已在测试服务完成19项Enforced HTTP验证，最终报告为rbac-http-report-v4.json。脚本路由误用、合成数据缺少租户字段的失败过程统一归档到RBAC_HTTP_ATTEMPTS.md。服务器已恢复Shadow，合成账号/楼盘/媒体/角色/范围均独立核查为0；没有生产操作或COS写入。

本次验证覆盖已接管测试PC账号的文件守卫，与本地MVC的APP分支验证互补，但不等同于微信真机验收。完整测试记录及回滚点见后端DEPLOYMENT_LOG.md。
