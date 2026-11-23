# Phase 4 验收记录

2026-11-23，在 Windows、Node.js 24.22.3、Git 2.54.0.windows.1、ripgrep 15.2.0 上实施和验证。应用版本为 0.4.0，使用独立 QA 数据目录与临时测试库。没有修改个人学习数据库或未跟踪的原始需求文件。

## 交付范围与来源

- 项目：DeepSeek Harness，仓库 ID `deepseek-harness`，[DeepSeek-ai/deepseek-harness](https://github.com/DeepSeek-ai/deepseek-harness)。
- 独立完整提交：`2e39e70496aa02986ca6a820c5d497e816b69d7e`，沿用登记基线；当天远端 master HEAD 已移动，不升级课程版次。
- 课程：`deepseek-foundations` v1，《DeepSeek Harness 插件架构与执行路径》。三章、11 个文件、35 条证据、三道单选题和一道追踪自评题。
- 课程每章包含十二项教学内容，分别标注事实、推断、建议，保留原路径、符号、闭区间、blob OID 与选区摘要。
- 范围：固定公开版本、默认 base 的 headless 新会话、默认 Agent Loop、Session 消息投影与 native 工具管线。未覆盖范围不写成“上游未实现”。[公开组件核对与资料缺口表](DEEPSEEK_SCOPE.md)
- 平台开放 DeepSeek 导入与独立发布、知识地图、架构图、Monaco、导师、笔记、练习和复习；Pi/Codex 课程与历史继续可用。订单 Mock 仍只对应 Pi。课程 Schema v1、SQLite user_version=2 不变，无新增迁移或用户数据表。

| 章节 | 实际源码复读路线 | 练习核对 |
| --- | --- | --- |
| 从 headless 任务进入插件运行时 | base/headless patch → run → AgentRegistry.create → 已登记工厂 createAgent → initializeAgent → ReactLoopAgent；run → followup → send → wakeDriver → kick → turn | 注册表通过工厂转交创建，不直接构造循环 |
| 一次任务怎样成为模型 step？ | turn/start → preStep 的输入认领与接纳 → step → prepareRequest/prepareCall → 日志消息 → buildRequest/deriveMessages → stream → 后续输入/停止检查 → turn/end | 模型历史取自 Session 投影；拒绝或空首输入可以没有 step |
| 原生工具结果怎样回到下一请求？ | assistant/message → tool-call → ToolsService → 所选 NativeToolExecutor → executeToolBatch/runGroup → prepare/dispatch/complete → 工具体 → BatchSettlement.commit → tool/result → 下一请求历史投影 | 区分结果日志和 additionalContexts，核对 concluded；工具异常追踪题显式自评 |

首章人工抽检入口为 [followup/send 第 171–189 行](https://github.com/DeepSeek-ai/deepseek-harness/blob/2e39e70496aa02986ca6a820c5d497e816b69d7e/packages/core/agent-loop/src/agent.ts#L171-L189)：blob `7ec43dd1323edc6e2b488d7c9d35fdd2d323abbd`，选区 SHA-256 `b49c9a37b7078389a9239777a48af80fb806e7bd8e46e68b8595d30198222791`。定义候选应另命中第 180 行。

## 实际测试结果

| 命令或验证 | 实际结果 |
| --- | --- |
| `npm test`，启用真实 Pi/Codex/DeepSeek 本机来源 | 19 项全部通过，无跳过。覆盖各阶段旧用例、三项目隔离、证据/导师、学习历史、修复与重启 |
| `node --test tests/pi.test.ts tests/deepseek.test.ts`，同时启用两个 GitHub 来源和两个本机来源 | 2 项通过；每个项目两种来源返回同一 release。DeepSeek 的全部 35 条证据重算摘录、核对对象、检查反链，逐章导师与单选错→对通过 |
| `npm run build` | TypeScript 和最终生产构建通过。保留既有 Monaco/Mermaid 大包及依赖 use-client 提示，不影响构建 |
| `python checks/phase0.py`，使用 QA 目录中的 README 格式校验依赖 | 12 项全部通过，检查课程契约、数据库设计、来源与文档链接 |
| 真实 DeepSeek 导航 | 限定 `packages/core/agent-loop/src` 或 agent.ts，followup 定义命中第 180 行；全仓超过既有预算，返回 index_budget 并提示缩小范围 |
| 三项目合成负例 | 同课程 ID、章号、题号、证据键、路径、类名和 step 方法分别解析各仓内容；相似 stepExtra 不混入 step。错项目、错提交、错 blob 和跨项目 request_id 重用拒绝 |
| 恢复与旧记录 | DeepSeek 对象损坏时证据和导师停止展示，Pi/Codex 仍可读；同 SHA 重导恢复原 release。DeepSeek v2 不覆盖 v1 进度，重启后旧记录保留 |

初次测试环境缺少 Python 的 URI/date-time 格式依赖，安装到被忽略的 QA 目录后复跑通过。沙箱内 Node 的回环 fetch 失败，随后使用本机执行权限及同样的独立临时测试库重跑通过。初次真实课程发布还查出几处选区没有包含声明符号；修正区间、重算摘要后，全量本机和 GitHub 回放均通过。没有将这些初次失败记为成功验收。

### 重跑命令

```powershell
npm ci
npm run build
python -m pip install "jsonschema[format]>=4.18,<5"
python checks/phase0.py

# 目录须包含各自课程的完整提交；普通工作树和裸仓库均可
$env:ACADEMY_PI_DIRECTORY = "D:\Repositories\pi-mono"
$env:ACADEMY_CODEX_DIRECTORY = "D:\Repositories\codex"
$env:ACADEMY_DEEPSEEK_DIRECTORY = "D:\Repositories\deepseek-harness"
npm test

# 可选：复验 Pi/DeepSeek 的 GitHub 与本机双来源
$env:ACADEMY_TEST_GITHUB = "1"
$env:ACADEMY_TEST_DEEPSEEK_GITHUB = "1"
node --test tests/pi.test.ts tests/deepseek.test.ts
```

不设真实来源环境变量时，三个真实来源用例按设计跳过，其余 16 项为离线测试。本次 Python 的实际执行方式是将 `.phase4-qa/python-deps` 放入 PYTHONPATH，再运行同一个 `checks/phase0.py`；未修改系统 Python 依赖。

## 浏览器与设计复核

真实浏览器操作已覆盖：

1. 首页显示三个可学项目；DeepSeek 0/3 章、固定 SHA 与前置顺序可见，Claude 仍标 Phase 5 待开放。
2. 首章 followup 进入 `packages/core/agent-loop/src/agent.ts` 第 171–189 行；源码页显示同一课程和 SHA。查定义命中第 180 行，返回原章后焦点为 `cite-input`。
3. 源码导师带入 DeepSeek，切到 Pi 后展示 Pi 教材；项目与 release 冲突明确报错。DeepSeek Mock 页说明尚无对应实验。
4. 工具结果单选先错后对、保存中文笔记；DeepSeek 统计显示 1/4 题已答、首次错→最近对为 1、待复习 0，两次作答仍在。
5. 缺失 evidence 显示“这条证据不属于当前版次”，修复入口绑定 DeepSeek；旧 Pi v1 可移植深链仍打开 agentLoop 第 32–55 行。
6. 390×844 下章节目录和文件目录可用 Enter 展开、Escape 关闭，焦点回到触发按钮且 aria-expanded=false。项目、章节、阅读器与复习页实测 scrollWidth=390；1440×900 阅读器未横向溢出。

UI/UX Pro Max 检索了长文行距、行宽和横向溢出，沿用现有中文 16px、1.85 行高及证据/焦点样式。Impeccable 评审使用实际项目与章节的 1440×900、390×844 截图：发现长版次选择框挤压“知识地图”标题，已改为可换行标题区及窄屏独占一行的选择器，重新截图确认修复。没有引入新字体、配色或外部资源。

Impeccable 对变更文件的机械扫描包含整份旧 CSS，报告 112 条既有设计系统字面量提示（47 颜色、58 字号、7 圆角）；本次新增布局规则与变动 TSX 没有命中。没有借本阶段改写旧设计系统。截图与 QA 输出保存在忽略目录，不进入交付提交。

**视觉验证边界：** Ego 的截图调用两次超时，改用 Impeccable 本机 Chromium 后取得并实际查看了项目和章节的宽窄屏图像。阅读器的该工具截图只捕获加载态，不能用它证明源码面板的最终像素效果；其真实代码、行区间、宽窄屏尺寸与键盘行为由实际浏览器操作验证。阅读器最终像素效果及系统读屏、真实触控设备仍可由负责人复核。

## 手动验收入口与 Git 交付

从学习中心选择 DeepSeek，导入预填 GitHub URL 和完整 SHA；按三章顺序至少各打开一处证据并返回。首章查 followup，第三章核对工具结果的 commit 和 buildRequest；保存笔记、完成练习、标记完成，重启后检查 DeepSeek 与旧 Pi/Codex 记录。另查看 [资料缺口表](DEEPSEEK_SCOPE.md)，确认未验证问题没有被写成源码事实。

分支为 `codex/phase4`，基于 Phase 3 `16ac4c6f84b540d7b750564662cf8115b436f912`。远端 main 仍停在前序设计基线，Phase 4 应先以 `codex/phase3` 为评审基线；待前序阶段按序合入后再调整目标，不混入前序阶段的评审差异。

| 提交 | 内容 |
| --- | --- |
| `7e78ef7` | 独立来源核对、公开组件与资料缺口 |
| `0a9c51e` | DeepSeek 独立课程与证据；复读时修正服务初始化的表述 |
| `59b21e7` | 平台入口、发布、导航与隔离测试、版本号及窄屏修复 |

本记录、README 和阶段文档另行提交，完整位置见分支日志。待负责人独立审阅教学质量、调用关系解释与公开范围，并复核上述视觉验证边界。没有执行 DeepSeek、Codex 或 Pi 的真实程序、模型或工具；这些不是本阶段只读源码学习的验收条件。
