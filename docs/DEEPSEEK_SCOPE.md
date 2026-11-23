# DeepSeek Harness 公开范围与资料缺口

2026-11-23 核对 [DeepSeek-ai/deepseek-harness](https://github.com/DeepSeek-ai/deepseek-harness)，使用登记的完整提交 `2e39e70496aa02986ca6a820c5d497e816b69d7e`。当天匿名 `ls-remote` 的 master HEAD 为 `4b399c39a6d1479cd84ca591b4d7c88e24d38a96`；课程仍保留原基线，不随分支移动。只取得 Git 对象，没有安装、构建或运行上游程序。

## 实际公开的组件

| 组件 | 固定版本位置与可验证内容 | 本课取舍 |
| --- | --- | --- |
| 项目与插件组合 | [README](https://github.com/DeepSeek-ai/deepseek-harness/blob/2e39e70496aa02986ca6a820c5d497e816b69d7e/README.md)、`packages/bundle/base/cordis.patch.yml`、`packages/bundle/headless/cordis.patch.yml` | 公开代码为插件组成的 Harness；base 挂载会话、模型、工具和循环，headless 增加单次任务 runner。不是只有 API SDK 的空壳 |
| Agent 工厂与注册表 | `packages/core/agent/src/index.ts`、`packages/core/agent-loop/src/index.ts` | create → 已登记工厂 createAgent → initializeAgent → ReactLoopAgent |
| 默认驱动 | `packages/core/agent-loop/src/agent.ts` | followup → send → wakeDriver → kick → turn → preStep → step → buildRequest |
| 会话与模型请求 | `packages/core/session/src/index.ts`、循环中的 prepareRequest/buildRequest | 从会话日志的 surface 投影模型消息，准备模型调用并消费流；不声称掌握模型服务端内部 |
| 工具服务与原生执行器 | `packages/core/tools/src/index.ts`、`packages/core/tool-executor-native/src/index.ts`、`packages/core/tools/src/batch.ts`、`pipeline.ts` | 默认 base 启用 native、禁用 PTC；讲原生工具 prepare/dispatch/complete 与结果回填 |
| 其他已公开目录 | `packages/llm`、`sandbox`、`subagent`、`mcp`、`session`、`sdk`、`python`、`apps/desktop`、`vendor` | 目录存在不等于其全部行为已审稿；不扩大本课结论 |

## 一条完整的阅读路径

假设本机 headless profile 挂载默认 base、使用新会话、模型返回一个普通原生工具调用，且没有自定义插件改写流程。沿下列调用点和消费端阅读：

1. headless `run` 读取模型选择，通过 `agents.create` 建立会话，`agent.followup` 送入教学任务。
2. `AgentRegistry.create` 转交已登记工厂，`AgentLoop.createAgent` 调用 `initializeAgent`，后者构造 `ReactLoopAgent`。AgentLoop 的服务初始化方法登记工厂。
3. `followup` 调用 `send(next-turn, true)`；`send` 插入 inbox 并唤醒，`wakeDriver` 在空闲时启动 `kick`；`kick` 消费 `turn`。
4. `turn` 先记 turn/start，`preStep` 认领输入、解析工具并组装提示，接受输入后进入 `step`。`step` 准备调用、记录消息，`buildRequest` 用 `session.deriveMessages()` 取模型可见历史。
5. 流消费后记 assistant/message。存在工具调用时调用 `ToolsService.execute` → 所选 `NativeToolExecutor.execute` → `executeToolBatch` → pipeline prepare/dispatch/complete → 工具体。
6. `BatchSettlement.commit` 追加 tool/result 并记录 call 关联。没有 concluded 且未发生取消/错误时，`step` 返回 null，`turn` 进入下一 step，历史投影使结果进入下一请求。concluded、额外输入、停止钩子及 max-tokens 均影响终止，不能简化成“有工具就一定继续”。

例如 [followup 与 send 第 171–189 行](https://github.com/DeepSeek-ai/deepseek-harness/blob/2e39e70496aa02986ca6a820c5d497e816b69d7e/packages/core/agent-loop/src/agent.ts#L171-L189) 是首章的阅读器验收入口。课程包保存每条路径、符号、闭区间、blob OID 与选区摘要，发布和真实来源测试全量复验。

## 资料缺口表

“未覆盖”表示本课程没有完成该范围的证据审稿，不能据此断言上游没有实现。

| 问题 | 已有证据能回答什么 | 缺口与学习边界 | 后续验证方式 |
| --- | --- | --- | --- |
| 模型内部怎样生成下一 token？ | 公开循环调用 prepareCall/stream 并消费返回流 | 模型权重、训练方法和托管服务端内部不由这些调用点证明 | 需要独立且可验证的模型/服务端来源，不补写为 Harness 源码事实 |
| 所有 profile 是否相同？ | 固定 base 与 headless patch、headless runner 的普通任务路径 | Web、Desktop、SDK、ACP、恢复/分叉及自定义 patch 未逐条取证 | 分别固定入口、配置与消费端；不得把 headless 路径外推到所有部署 |
| 每种工具是否都经过相同执行器？ | ToolsService 按 scope 选择执行器；默认 base 的 native 分支 | PTC、外部插件及各工具特定实现未审稿 | 从实际挂载配置和 scope 选择追到对应执行器，另行发布教材 |
| 审批与沙箱是否在所有系统安全？ | 原生管线存在 pre-execute、guards、execute、post-execute 扩展点 | 没有操作系统级运行、真实命令或安全性实测 | 单独审核 provider、权限配置和平台测试；本平台不执行上游代码 |
| 日志是否一定落盘、断电可恢复？ | 课程验证会话事件、结果关联和模型历史投影 | 内存日志追加不等于物理持久化成功；后端刷盘、迁移、崩溃恢复未逐条审稿 | 另审 persistence backend、flush、格式迁移与故障测试 |
| Multi-Agent、MCP、Memory 的完整行为？ | 对应公开组件目录可查 | 本课程尚未建立这些组件的完整调用证据链，也未与 Pi/Codex 做比较 | 如需扩展这些主题，应先取得该项目独立证据 |

许可证核对：该固定版本根 LICENSE 为 MIT，另有 THIRD_PARTY_NOTICES.md。应用只提交中文教材和证据元数据，导入对象与本机学习数据不进 Git。机器摘要通过不能替代课程教学质量的负责人审稿。
