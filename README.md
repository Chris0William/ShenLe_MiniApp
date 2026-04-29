# ShenLe MiniApp Next

深乐租小程序重构版，基于 unibest + wot-design-uni。

- 原小程序保留在 `ShenLe_MiniApp`，用于参考和回退。
- 当前目录是 Git worktree：`refactor/unibest-wot-next`。
- API 路径统一保留后端完整路由，如 `/api/slProperty/page`，基础域名只配置到主机名。

## Scripts

```bash
pnpm install
pnpm type-check
pnpm build:mp-weixin
pnpm dev:mp-weixin
```
