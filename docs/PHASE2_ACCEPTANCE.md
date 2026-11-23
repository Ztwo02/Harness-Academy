# Phase 2 验收记录

2026-11-23，在 Windows、Node.js 24.18.1、Git 2.54.0.windows.1、ripgrep 15.2.0 和本机 Chromium 上验收。使用独立 QA 数据目录，不修改用户学习数据库。

## 交付范围

课程为 `pi-foundations` v2，主仓库 [agentic-labs/pi-mono](https://github.com/agentic-labs/pi-mono)，固定提交 `08dc60bc52d89d6823a9738cc90b1916e5e446e5`。保留不可变 v1，v2 包含四章、4 道单选题、1 道追踪自评题、15 条源码证据。新增功能包括本地源码导师、定义/引用候选、Mock 实验及阶段复习统计。

| 课程 | 实际取证与阅读路线 |
| --- | --- |
| 从输入消息到 Agent Loop | 保留首章及原六条证据；输入 → 事件流 → 上下文 → 模型接口 → 工具结果与 follow-up |
| 工具返回之后，谁决定下一轮？ | `runLoop` 第 153–273 行；核对模型 error/aborted、工具结果回填、prepareNextTurn、轮末停止回调与消息队列 |
| 工具怎样把成功和异常变成消息？ | `executeToolCalls` 第 409–424 行 → `prepareToolCall` 第 607–675 行 → 执行/异常 → finalize → 工具消息；另核对并行工具的完成事件与消息输出顺序 |
| 事件怎样更新 Agent 状态？ | `processEvents` 第 544–591 行，`finishRun` 上下文第 489–543 行；核对消息、pendingToolCalls 与监听器结算后的空闲边界 |

[核对工具准备函数原始行区间](https://github.com/agentic-labs/pi-mono/blob/08dc60bc52d89d6823a9738cc90b1916e5e446e5/packages/agent/src/agent-loop.ts#L607-L675)。所有新增证据均由固定 Git blob 生成坐标与 SHA-256，发布时逐条核验；语义回放沿调用者、执行、结果消费三端复读，单选答案和自评评分点回到同版证据。没有引入上游版次升级。

## 自动化验收

| 命令 / 路径 | 结果和覆盖 |
| --- | --- |
| `python checks/phase0.py` | 12 项通过；文档链接、Schema、DDL、版次隔离与契约负例 |
| `npm run build` | TypeScript 和生产构建通过；保留依赖的现有大包提示，Monaco、Mermaid、实验页面按需加载 |
| `npm test` | 最终启用本机真实 Pi 的回归 14 项全部通过、无跳过；其中离线用例覆盖存储、Git、学习、候选符号、导师、实验控制、统计和教材升级；默认不设置来源时跳过真实 Pi 用例 |
| 真实 Pi 双来源回放 | 设置下方两个环境变量后运行 `npm test`；GitHub、本机导入同一 SHA，逐条检查两版全部证据，逐章调用导师，并找到两个文件中的同名 `prepareToolCall` 定义候选 |
| 实验控制 | 三种工具结果下单步/自动播放轨迹与最终状态一致，重置重放一致；暂停、重置、卸载使旧回调失效；对外状态副本不能改内部轨迹 |
| 复习与恢复 | 同请求重试不重复计数，错→对退出队列，对→错重新进入；追踪题显式自评；旧版完成、笔记、作答在升级和重启后保留，新版从零开始 |

Python 检查需要 README 中的 `jsonschema[format]` 依赖。本次把校验依赖装在忽略的 QA 目录，通过 `PYTHONPATH` 使用，没有修改系统 Python 或项目运行依赖。

```powershell
$env:ACADEMY_TEST_GITHUB = "1"
$env:ACADEMY_PI_DIRECTORY = "D:\Repositories\pi-mono"
npm test
```

本机目录需含固定提交，可使用普通工作树或裸仓库。Windows 受限沙箱可能阻止 Git 本地传输创建 MSYS 对象；本次在允许启动本地服务与 Git 的执行环境中复验。

## Mock 可复现实例

从新版任意章节进入“打开 Mock 实验”，使用默认教学输入。实验不调用模型、不执行工具代码、不加载上游依赖。它模拟单工具、两轮固定回复；省略流式增量、并发、参数 Schema、钩子、截断、取消和监听器结算。`phase`、`toolResult` 为教学字段，不能当成 Pi 的真实 AgentState。

```json
{"prompt":"订单 42 发货了吗？","scenario":"success"}
```

依次单步或一次自动播放，事件类型序列相同：

```text
1  agent_start
2  turn_start
3  message_start       user
4  message_end         user
5  message_start       assistant：lookup_order(orderId=42)
6  message_end         assistant
7  tool_execution_start
8  tool_execution_end  订单 42：已发货 · isError=false
9  message_start       toolResult
10 message_end         toolResult
11 turn_end
12 turn_start
13 message_start       assistant：你的订单已发货。
14 message_end         assistant
15 turn_end
16 agent_end
```

最终教学状态为 `phase=finished`，消息角色依次为 user、assistant、toolResult、assistant，`toolResult="订单 42：已发货"`。将 scenario 改为 `error` 或 `unknown-tool` 并应用输入，仍有 16 项事件，工具消息 `isError=true`，固定最终回复提示稍后重试。输入与已播放事件可在页面“复现实验的输入与事件 JSON”中直接核对。

暂停不增加事件；继续从当前游标消费；完成后需重置才能重放。事件上的源码链接表示对应机制的证据，不意味着 Mock 状态、订单文本和事件载荷与 Pi 运行轨迹完全相同。旧版缺少深入章节映射时明确标为教学模拟。

## 页面与边界

源码导师按所选版次与章节查已审稿内容，保留事实/推断/建议分类；未覆盖的符号或问题提示登记疑问，证据损坏时提供重导入口。定义/引用为固定提交的文本候选，含路径、行、列与定位依据，不承诺语言级绑定；相似标识符不命中，注释和同名定义如实列出。超预算或缺少 ripgrep 时可继续使用原课程证据。

浏览器验收覆盖新版章节 → 源码证据 → 原章、导师检索与未覆盖问题、Mock 成功/异常与暂停、逐题复习。实际查看 1440 × 900 与 390 × 844 的渲染截图，保存在忽略的本机 QA 目录。窄屏核对章节/文件目录的 Enter 展开、Escape 收起及焦点恢复；宽窄布局不改变源码坐标，没有页面横向溢出。F12 实际找到两个 `prepareToolCall` 定义候选并将焦点移到检索框；返回原章聚焦 `cite-tool-prepare`。浏览器屏蔽外部 HTTPS 后仍可加载本地教材与实验。

Impeccable 的源码检测产生 112 项 advisory（47 项色值、58 项字号、7 项圆角与设计记录不一致），没有非 advisory 条目。检测覆盖变动文件的完整样式表，包含既有 Phase 1 样式；没有把这些提示当成页面视觉验收通过的证明。本次保留既有视觉系统，实际检查中文阅读层级、事件状态、候选提示、宽窄布局与焦点往返，未扩大范围修复设计工具配置。

## Git 交付与待验收

开发基于已完成的 Phase 1 提交 `0a9c657`，使用 `codex/phase2` 分支。远端 main 在开始时仍为 `ae6dbeb`，尚未包含 Phase 1；本阶段不改写这两个分支的历史。教材、实验引擎、平台功能和验收说明分批提交。

| 提交 | 内容 |
| --- | --- |
| `4b2e04b` | Pi 四章课程 v2 与版次登记 |
| `6aa14dd` | 确定性 Mock 引擎及控制状态机测试 |
| `aab2890` | 本地导师、符号候选、实验页面、复习统计和配套验收测试 |

PR 以 `codex/phase1` 为比较基线，使评审只显示 Phase 2 变化。需先将 Phase 1 的 PR 合入 main，再把 Phase 2 PR 的目标分支改为 main；不得把合入 Phase 1 开发分支等同于阶段发布。本文和路线说明作为最后一份交付提交，其 SHA 由 Git 日志记录。

自动化与本机浏览器回放不等同于负责人验收。待负责人确认课程教学质量，以及候选导航和简化 Mock 的范围是否满足进入 Phase 3 的条件；没有执行真实 Pi 模型或上游工具。
