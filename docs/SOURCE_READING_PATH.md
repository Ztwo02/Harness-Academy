# 从 Pi 到 Claude Code 的源码学习路线

带着同一个问题出发：**用户交给 Agent 一个任务，工具返回以后，谁决定下一步？** 先在 Pi 跟完一次循环，再读 Codex 的任务轮次、DeepSeek 的插件协作，最后从 Claude 的公开示例与 SDK 追到客户端能观察的边界。现有 13 个源码章节和两张文档卡都可以独立学习。

## 开始前一次备好五个来源

在项目根目录依次运行以下命令。已有依赖和当前版本构建的用户直接运行最后一条。保持终端开启，打开 [学习中心](http://127.0.0.1:4317)。下面的本机入口使用默认端口，自定义端口时请使用终端打印的地址。

```powershell
npm ci
npm run build
npm start
```

按表依次打开“本机导入”，保留页面预填的 GitHub 来源和完整 SHA，点击“开始导入”，等当前来源成功再打开下一行。已导入相同版本的来源可直接阅读。也可以选择含对应提交的本机 Git 仓库。这里的 SHA 是**被学习的上游源码版本**，教材 v1、v2 是平台的课程版次。

| 顺序与教材 | 本机导入 | 上游固定提交 |
| --- | --- | --- |
| 1 · Pi v2 | [导入 Pi](http://127.0.0.1:4317/repositories?project=pi&repository=pi-mono) | [`08dc60bc52d89d6823a9738cc90b1916e5e446e5`](https://github.com/agentic-labs/pi-mono/tree/08dc60bc52d89d6823a9738cc90b1916e5e446e5) |
| 2 · Codex v1 | [导入 Codex](http://127.0.0.1:4317/repositories?project=codex&repository=codex-cli) | [`d4014cb19d23614be39c0cf57d981e042ba0763a`](https://github.com/openai/codex/tree/d4014cb19d23614be39c0cf57d981e042ba0763a) |
| 3 · DeepSeek Harness v1 | [导入 DeepSeek](http://127.0.0.1:4317/repositories?project=deepseek&repository=deepseek-harness) | [`2e39e70496aa02986ca6a820c5d497e816b69d7e`](https://github.com/DeepSeek-ai/deepseek-harness/tree/2e39e70496aa02986ca6a820c5d497e816b69d7e) |
| 4 · Claude Code 公开示例 v1 | [导入公开仓库](http://127.0.0.1:4317/repositories?project=claude&repository=claude-code) | [`b022ba6df88a5ddfbcedc39739a191c7e2ff5196`](https://github.com/anthropics/claude-code/tree/b022ba6df88a5ddfbcedc39739a191c7e2ff5196) |
| 5 · Claude Agent SDK（Python 0.2.187）v1 | [导入官方 SDK](http://127.0.0.1:4317/repositories?project=claude&repository=claude-agent-sdk-python) | [`3184360393a92ca8a6ec7bbbdee571afd1ce1c56`](https://github.com/anthropics/claude-agent-sdk-python/tree/3184360393a92ca8a6ec7bbbdee571afd1ce1c56) |

再打开 [Claude 官方文档阅读卡](http://127.0.0.1:4317/materials/claude)，点击“导入已核对快照”。这两张卡用响应摘要固定版本。五个仓库和快照备好后，可以断网按下面的顺序学习。

## 每一章怎么读

先看业务场景，写下自己对本章问题的预测。再从“源码阅读”点开下表列出的符号，观察输入、分支和输出。点击“返回原章”，用自己的话记一句结论，并附上刚读的符号和行号。最后完成练习、标记本章完成。卡住时打开“本章源码导师”核对调用链。下次启动后，从学习中心的项目进度接着读。

| 站点 | 打开对应章节 | 源码里要弄清的一件事 |
| --- | --- | --- |
| 01 · [进入 Pi](http://127.0.0.1:4317/projects/pi) | 从输入消息到 Agent Loop | 从 `agentLoop` 第 32–55 行开始，追到 `runAgentLoop`，找出新消息进入上下文的位置。 |
| 02 · Pi | 工具返回之后，谁决定下一轮？ | 读 `runLoop`，指出哪条分支会继续请求模型，哪条可以结束。 |
| 03 · Pi | 工具怎样把成功和异常变成消息？ | 从 `executeToolCalls` 追到 `createToolResultMessage`。用订单 Mock 分别单步走一次成功和抛错，预测下一条事件。 |
| 04 · Pi | 事件怎样更新 Agent 状态？ | 看 `processEvents` 和 `finishRun`，说清调用者何时能看到状态变化。 |
| 05 · [进入 Codex](http://127.0.0.1:4317/projects/codex) | 从 codex exec 进入核心运行时 | 沿 `run_main`、`start_thread` 找到命令行交出任务的位置。 |
| 06 · Codex | 一次用户任务怎样驱动模型轮次？ | 打开 `run_turn` 第 227–249 行，再看调用方，区分提交用户输入与执行一轮任务。 |
| 07 · Codex | 工具调用与结果怎样回到模型？ | 跟着 `handle_tool_call` 和 `drain_in_flight`，指出结果在哪一步可供下一次模型请求使用。 |
| 08 · [进入 DeepSeek Harness](http://127.0.0.1:4317/projects/deepseek) | 从 headless 任务进入插件运行时 | 从 `followup` 第 171–189 行回看创建 Agent 的工厂，找出是谁唤醒驱动循环。 |
| 09 · DeepSeek | 一次任务怎样成为模型 step？ | 对照 `turn`、`step` 与 `buildRequest`，追踪一次请求使用的消息从哪里来。 |
| 10 · DeepSeek | 原生工具结果怎样回到下一请求？ | 从 `NativeToolExecutor` 追到结果提交，再回看请求构建，找出两次模型调用之间保留下来的数据。 |
| 11 · [进入 Claude Code](http://127.0.0.1:4317/projects/claude)／公开仓库 | 公开 Hook 示例：从输入到校验结果 | 从 `main` 进入 `_validate_command` 第 48–53 行，用一个输入说明示例如何给出校验结果。 |
| 12 · Claude／官方 Python SDK | 官方 Python SDK：请求怎样进入 CLI 传输层？ | 在项目页选 SDK 教材，从 `query` 第 11–20 行追到 `open_process`，指出 Python 与 CLI 的进程边界。 |
| 13 · Claude／官方 Python SDK | 消息与控制回调怎样分流并返回？ | 对照 `_read_messages`、`hook_callback` 与 `receive_messages`，分别追一次控制请求和普通消息。 |

Pi 请选择《Pi 架构与运行机制》v2。如果只看到 v1，可在“源码导师与实验”点击“从已固定源码更新 Phase 2 教材”，旧版笔记和进度会保留。

最后按顺序读 [两张官方文档卡](http://127.0.0.1:4317/materials/claude) 中的《Agent SDK 与其他 Claude 工具的边界》和《Hook 的公开用法与实现证据边界》。把 Claude 笔记中的每条结论标成“公开示例”“SDK 源码”“官方文档”或“待验证”。例如，SDK 怎样发送控制回复可以定位到代码，CLI 内部怎样调度工具仍需独立证据。完成后可到 [阶段复习与统计](http://127.0.0.1:4317/review?tab=statistics) 按项目重做错题。
