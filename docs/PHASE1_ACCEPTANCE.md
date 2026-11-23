# Phase 1 验收记录

2026-11-22 在 Windows、Node.js 24.18.1、SQLite 3.53.1、Git 2.54.0.windows.1 和本机 Chromium 浏览器上验收。使用独立数据目录。课程来自 [Pi 基线提交](https://github.com/agentic-labs/pi-mono/commit/08dc60bc52d89d6823a9738cc90b1916e5e446e5)，完整 SHA 为 `08dc60bc52d89d6823a9738cc90b1916e5e446e5`，课程 `pi-foundations`，版次 1。

## 验收结果

| 路径 | 实际观察 |
| --- | --- |
| 首次启动与首页 | 空库显示四个项目，Pi 可导入，其余显示 Phase 3、4、5。项目列表与进度优先展示。学习中的 Pi 有“继续学习”入口，点击直达上次章节 |
| GitHub 与本机导入 | 用登记的 GitHub URL 和本机 Git 裸仓库分别固定 Pi，重复导入返回同一课程版次。每种来源均核对了六条证据的路径、blob、行范围和摘录 SHA-256 |
| 章节 → 源码 → 章节 | 从真实章节打开 Monaco，突出显示 `packages/agent/src/agent-loop.ts` 的 `agentLoop` 第 32–55 行。选区反链回到当前版章节，焦点恢复到原证据链接。[核对原始行区间](https://github.com/agentic-labs/pi-mono/blob/08dc60bc52d89d6823a9738cc90b1916e5e446e5/packages/agent/src/agent-loop.ts#L32-L55) |
| 学习与复习 | 在页面保存笔记和疑问，同一道题先错后对，学习记录显示两次结果，标记完成后首页显示 1/1 章、100%。测试另核对重复作答请求、疑问解决状态，以及最新版与旧版的记录隔离 |
| 离线与重启 | 测试移动原仓库并更新原分支，关闭服务与数据库，另起生产 Node 进程。仍能读取已固定对象、已完成进度与两次作答。浏览器屏蔽外部 HTTPS 后也能加载课程、Monaco 和本地资源 |
| 失败与恢复 | 拒绝跨源写入、会话令牌缺失、范围越界、摘要不符、错项目、不可达前置章和同版冲突。删除测试快照的可访问路径后，旧笔记与作答仍可查询；重导同一 SHA 恢复证据。二进制及大文件显示元数据，符号链接和子模块不被跟随 |
| 响应式与键盘 | 实测 1440 × 900 与 390 × 844。窄屏章节目录和文件目录默认收起，Enter 展开、Escape 收起并恢复焦点。选区不因布局切换而改变 |

## 重跑

在仓库根目录安装锁定依赖后，运行以下命令。常规测试使用临时 Git 与 SQLite 数据，跳过需要真实 Pi 来源的可选测试。

```sh
npm run build
npm test
```

同时验证 GitHub 和本机 Pi 时，在 PowerShell 设置以下环境变量。目录须含基线提交，可以使用普通工作树或裸仓库。

```powershell
$env:ACADEMY_TEST_GITHUB = "1"
$env:ACADEMY_PI_DIRECTORY = "D:\Repositories\pi-mono"
npm test
```

设计契约的 12 项离线检查见 [README](../README.md)。应用测试从 [测试目录](../tests/phase1.test.ts) 与 [真实 Pi 回放](../tests/pi.test.ts) 开始阅读。应用层测试使用的合成夹具只验证契约，正式课程保存在 [Pi 首章](../courses/pi-foundations.v1.json)。

## 首版使用范围

- 仓库管理接受已登记来源的 GitHub URL、本机普通工作树和裸仓库。对非基线的本地 SHA 会校验已有固定记录或与基线的 Git 祖先关系；无法核验的浅仓库可以改从登记的 GitHub URL 导入。目录树每页 100 项，源码文本上限 1 MiB。
- 源码阅读提供文本高亮、固定行区间、文件树和课程反链。语言级定义与引用导航、模拟实验属于 Phase 2。
- 本机课程包在导入时执行结构、引用、Git 对象和摘要校验；教材作者需复核语义和上游许可。数据库迁移与备份参见[数据库设计](DATA_MODEL.md)。
