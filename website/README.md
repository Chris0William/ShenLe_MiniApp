# 深租宝典企业官网

这是深租宝典 / 深乐租的独立静态官网页面，不参与小程序构建。

## 本地预览

```powershell
cd E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_Next
python -m http.server 4173 -d website
```

打开 `http://localhost:4173`。

## 验证

```powershell
node website/scripts/verify-website.mjs
```

`package.json` 也提供了 `website:verify`，但当前本机 `pnpm` 在非 TTY 下可能触发依赖目录清理检查，自动化验证优先直接使用 Node 命令。

验证内容包括关键文案、页面区块、敏感表达和 UTF-8 no BOM。

## 部署建议

第一版可将 `website/` 目录作为静态站点部署到 Nginx 根路径，API 继续保留在 `/api/`。