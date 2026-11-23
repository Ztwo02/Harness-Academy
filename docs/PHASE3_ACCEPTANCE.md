# Phase 3 验收记录

2026-11-23，使用 Windows、Node.js 24.18.1、Git 2.54.0.windows.1、ripgrep 15.2.0 和本机浏览器，在独立 QA 数据目录验收。用户原始需求文件与个人学习数据库未修改。

## 课程与来源

- 项目与仓库：Codex，`codex-cli`，[openai/codex](https://github.com/openai/codex)。
- 完整提交：`d4014cb19d23614be39c0cf57d981e042ba0763a`，沿用设计基线，没有移动上游版次。
- 课程：`codex-foundations` v1，《Codex 架构与核心执行路径》。三章、三道单选题、一道追踪自评题，13 个文件、28 条证据。
- 范围：公开仓库中的本机 `codex exec` 普通用户任务。默认 TUI、远端执行、恢复/分叉、具体工具的全部审批/沙箱策略与未公开服务实现没有被概括为课程事实。

| 章节 | 实际复读路线与练习依据 |
| --- | --- |
| 从 codex exec 进入核心运行时 | CLI Exec 分发 → exec.run_main → 内嵌 app-server → ThreadStart / TurnStart → turn_start → thread.start_or_steer_turn → SessionIo 提交。单选检查 TurnStart 请求边界 |
| 一次用户任务怎样驱动模型轮次？ | SubmissionOp::TurnInput → 输入接纳 → RegularTask.run_turns → run_turn → clone_history → run_sampling_request → 后续工作/待处理输入/停止检查。单选定位历史采样输入 |
| 工具调用与结果怎样回到模型？ | handle_output_item_done → tool_future → ToolCallRuntime → 路由与注册表 → drain_in_flight 回填历史 → 后续采样。练习区分 RespondToModel 与 Fatal；追踪题显式自评 |

每章满足课程 Schema 的十二项；事实、推断、建议分别标记。证据从原 Git 对象计算路径、符号、闭区间、blob OID 与选区摘要；发布时全量核验，作者另沿请求消费、工具分派和结果消费位置复读。固定 [run_turn 第 227–249 行](https://github.com/openai/codex/blob/d4014cb19d23614be39c0cf57d981e042ba0763a/codex-rs/core/src/session/turn.rs#L227-L249) 可用于人工抽检。机器摘要通过不等同于教学语义已获独立负责人审稿。

## 实际测试

| 验证 | 实际结果 |
| --- | --- |
| `npm test`，启用真实 Pi 与 Codex 本机来源 | 16 项全部通过、无跳过。覆盖原 Phase 1/2、Codex 接入、Rust 候选、跨项目数据、损坏恢复与重启 |
| Codex GitHub + 本机来源 | 单独运行 `tests/codex.test.ts`，两种来源均发布同一 release；逐条回放 28 条证据、逐章导师、单选验答和 run_turn 定义候选，通过 |
| Pi GitHub + 本机来源 | `tests/pi.test.ts` 双来源回放通过，两版旧教材证据和导师仍可用 |
| `npm run build` | TypeScript 与生产构建通过；保留既有 Monaco/Mermaid 大包提示，依赖按需加载 |
| `python checks/phase0.py` | 12 项通过；未修改 Schema 或 DDL，文档链接与来源归属继续核对 |

首次 Codex GitHub 导入在原 120 秒下载上限失败；随后将联网获取预算调整为 240 秒、本机仍为 120 秒，更新测试轮询预算后复跑双来源，通过。该修订保留超时，不执行下载的上游代码。初次失败没有登记成功版次。

合成隔离测试特意让 Pi 与 Codex 使用同一课程 ID、章 ID、题号、证据键和路径，但文件内容及正确答案不同。已验证跨项目/错提交/错 blob 的课程拒绝发布，跨项目重用 request_id 返回冲突；导师、反链、进度、笔记、统计分别绑定 release。删除测试中的 Codex 对象访问位置后，Pi 旧记录与证据仍可读；重导 Codex 修复后，重启仍保留两项目记录。

### 重跑

```powershell
npm ci
npm run build
python checks/phase0.py

# 本机真实对象回放；目录需包含各自课程提交
$env:ACADEMY_PI_DIRECTORY = "D:\Repositories\pi-mono"
$env:ACADEMY_CODEX_DIRECTORY = "D:\Repositories\codex"
npm test

# 可选：同时检验 GitHub 来源，网络需要能在下载预算内访问仓库
$env:ACADEMY_TEST_GITHUB = "1"
$env:ACADEMY_TEST_CODEX_GITHUB = "1"
npm test
```

默认不设置环境变量时是 14 项通过、2 项真实来源测试跳过。Python 需安装 README 中的 `jsonschema[format]`；本次复用忽略的 QA 依赖目录，通过 PYTHONPATH 执行。

## 浏览器操作回放

实际通过浏览器操作并读取页面状态，覆盖：

1. 学习中心 Codex 显示 0/3 章并可进入知识地图；三章及提交号可见，DeepSeek/Claude 保留待开放。
2. 架构导读点击 run_main，Monaco 定位 `codex-rs/exec/src/lib.rs` 第 284–307 行；返回聚焦 `cite-entry`。Mermaid 展示本机 exec 的五段职责路径。
3. 阅读器把检索目录设为 `codex-rs/core/src`，查询 run_turn，命中 `session/turn.rs:227`，展示 Codex SHA 与检索范围。
4. Codex 工具题先选 Fatal 答错，再选 FunctionCallOutput 答对；统计显示首次错、最近对、待复习退出，范围为 3 章/4 题。
5. 从 Codex 章节进入导师，所选项目为 Codex；切换 Pi 后出现 Pi 课程。项目与 release 冲突时显示错误，不静默切换到另一项目。
6. Codex 的 Mock 页明确没有对应实验；Pi v2 的订单实验仍能单步，显示 1/16 事件。
7. 打开旧 Pi 可移植深链，仍读到 agentLoop 第 32–55 行。390×844 下，章节和文件目录 Enter 展开、Escape 收起后焦点回到触发器；章节、阅读器与复习页页面宽度未超出视口。1440×900 的项目页也未出现横向溢出。

**视觉检查限制：** Ego 浏览器截图接口反复超时；Chrome 调试连接与 Windows 窗口截图回退也未能取得可用图像，底层截图返回黑画面。上面的结论来自真实 DOM/键盘操作、可访问页面状态和布局尺寸，不把它们称为像素级截图验收。最终宽窄屏视觉效果仍需负责人在本机查看。

Impeccable 对变动源码执行机械检测，没有返回条目；本次没有修改 CSS。检测结果不能替代上述未完成的截图视觉审阅。延续现有中文 16px 正文、宽行距、证据标记和焦点样式。

## 手动验收入口

从 `codex/phase3` 构建并重启本机服务，在学习中心选 OpenAI Codex CLI，导入预填 SHA。按三章顺序进入，每章至少打开一个证据并返回；完成一题、保存笔记、标记完成、重启，再检查 Codex 进度和 Pi 原有记录。阅读器中选择 `codex-rs/core/src`，查 run_turn 定义；把 scope 清空可验证全仓超预算的恢复提示。

## 交付与待验收

基于 Phase 2 `59b76a8`，分支 `codex/phase3`。开始时远端 main 尚未包含 Phase 1/2；为保持本阶段差异清楚，PR 以 `codex/phase2` 为基线。应按前序阶段顺序评审合入，再把本 PR 的目标改为 main；本次不改写前序分支或个人数据。

课程提交 `c8d2866`，平台接入和测试提交 `5b19cdf`。最终验收与阶段说明另行提交，完整 SHA 可在分支日志查看。未提交导入对象、个人记录、工具缓存或浏览器测试材料。

待负责人复核课程教学质量、公开范围和最终页面视觉效果。没有运行真实 Codex、模型或工具；这些也不是本阶段源码学习验收条件。
