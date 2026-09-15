# 微信开发版本上传 Runbook

适用项目：`ShenLe_MiniApp_SourceContact`

## 固定边界

- 测试环境 API：`https://shenzuyk.com/test-api`
- 小程序 AppID：`wxb3b545efe13da99b`
- 项目目录：`E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_SourceContact`
- 微信开发者工具 CLI：`D:\Program\Tencent\微信web开发者工具\cli.bat`
- 固定 CLI 服务端口：`9421`
- 上传只生成微信后台开发版本，体验版仍由用户在微信公众平台手动选择。
- 房东分享二维码的后端环境必须匹配小程序版本：测试服务配置 `Wechat:MiniProgramEnvironmentVersion=trial`，生产服务配置 `release`；不要把测试服务配置成 `release`。

## 标准流程

1. 没有代码变化且 `dist/dev/mp-weixin` 已完成验证时，直接复用产物，不重新构建。
2. 需要重新生成测试产物时，只执行：

```powershell
pnpm build:mp:test
```

3. 在微信开发者工具界面确认账号已登录，并确认 `设置 -> 安全设置 -> 服务端口` 已开启。
4. 只执行一次下列上传命令，替换版本号和描述：

```powershell
$cli = 'D:\Program\Tencent\微信web开发者工具\cli.bat'
$project = 'E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_SourceContact'
$version = '0.4.30'
$desc = '本次更新说明（测试环境）'

& $cli upload `
  --project $project `
  --version $version `
  --desc $desc `
  --port 9421 `
  --lang zh
```

5. 成功标准必须同时出现：

```text
Using AppID: wxb3b545efe13da99b
TOTAL ... size (Byte)
upload
```

6. 将版本、描述、包大小和完整上传命令写入 `ShenLe_SourceContact/DEPLOYMENT_LOG.md`。

## 失败止损

- 第一次上传失败：只读取原始错误，不改环境。
- 错误为 `IDE service port disabled`：立即停止，请用户在开发者工具中手动开启服务端口，然后重新执行原命令；不做其他尝试。
- 界面已登录但 CLI 返回未登录：先检查服务端口，不能启动自动登录。
- 其他错误：最多执行一次同命令的 `--debug` 诊断。仍失败就停止并询问用户。
- 禁止扫描私钥、改用 `miniprogram-ci`、修改开发者工具内部状态文件、注入自定义启动参数、桌面坐标点击或结束无关进程。
- 任意一次上传任务最多允许两次失败的工具调用，不得无限重试。

## 已验证实例

2026-08-18 上传 `0.4.29` 的成功命令：

```powershell
& 'D:\Program\Tencent\微信web开发者工具\cli.bat' upload `
  --project 'E:\WorkSpace\WorkSpace-MiniApp\深乐租项目\ShenLe_MiniApp_SourceContact' `
  --version '0.4.29' `
  --desc '修复房东端地图首屏及底部导航图标（测试环境）' `
  --port 9421 `
  --lang zh
```

结果：AppID `wxb3b545efe13da99b`，包大小 `1,156,257` 字节，CLI 返回 `upload` 成功。

## 已知问题与稳定上传通道（2026-09-15 验证）

### 故障现象

`cli.bat`（及同结构的 `wechatidecli.cmd`）在某些 shell 环境（如 ZCode 的 bash→cmd 链路）下会因首行 `chcp 65001` 触发 cmd 批处理重解析缺陷：路径/参数含中文时字节偏移错乱，`setlocal` 被反复重执行，报 `Maximum setlocal recursion level reached`，上传命令零输出挂起。Codex 的 PowerShell 环境此前未触发该边界。

### 稳定命令（绕过 cmd，直调 exe，与 cli.bat 完全等价）

先验证通道（只读）：

```bash
cd "/d/Program/Tencent/微信web开发者工具"
BS='const e=process.argv[1],a=process.argv.slice(2).filter(function(x){return x!=="--electron"});if(!process.env.cwd)process.env.cwd=process.cwd();process.argv=[process.execPath,"--ms-enable-electron-run-as-node",e,"--electron"].concat(a);require(e)'
ELECTRON_RUN_AS_NODE=1 timeout 60 ./微信开发者工具.exe -e "$BS" "D:\Program\Tencent\微信web开发者工具\resources\app.asar.unpacked\js\common\cli\index.js" islogin --port 9421
# 预期输出 {"login":true}
```

上传时把 `islogin` 换成 `upload --project "<项目绝对路径>" --version "<版本>" --desc "<描述>" --port 9421 --lang zh`，其余不变。成功标准与上文一致（AppID + 包大小 + upload）。

### 选择规则

- PowerShell 交互环境：优先用标准 `cli.bat` 命令（历史验证）。
- 任何智能体 shell（ZCode/Codex 等）出现挂起或 setlocal 递归报错时：直接改用本节稳定命令，不要反复重试 cli.bat。
