# Claude Code Phase 5 来源与范围审阅

2026-11-23 核对三个独立资料类别。没有安装或执行上游 CLI、SDK、Hook、模型或工具，教材均为只读源码推演。

| 类别 | 固定身份 | 能支持的结论 |
| --- | --- | --- |
| 公开仓库 | [anthropics/claude-code](https://github.com/anthropics/claude-code)，`b022ba6df88a5ddfbcedc39739a191c7e2ff5196`；`claude-public` v1 | 当前公开 Hook 示例自己的输入、正则匹配、stderr 和退出路径；不作为二进制内部 Agent Loop 的源码 |
| 官方 Agent SDK | [anthropics/claude-agent-sdk-python](https://github.com/anthropics/claude-agent-sdk-python)，独立提交 `3184360393a92ca8a6ec7bbbdee571afd1ce1c56`，pyproject 版本 `0.2.187`；`claude-sdk-python` v1 | Python 客户端 query、默认子进程传输、NDJSON、消息路由和控制回调；不是 Anthropic Messages API 客户端教材 |
| 官方文档 | `https://code.claude.com/docs/en/agent-sdk/overview.md` 与 `https://code.claude.com/docs/en/hooks-guide.md`；每张卡独立 v1、抓取时间及摘要 | 抓取时官方公开的用法与接口说明；不是 SDK 固定提交或内部实现的替代证据 |
| 未验证内部机制 | 两个课程包的 unverifiedQuestions | 内部模型轮次、全部平台的权限/沙箱、上下文裁剪和记忆算法都保留为问题，不能标为源码事实 |

公开主仓沿用 P0 登记基线；当天 main HEAD 为 `50cdc7005318f630144c28217d1dada32e6ba762`，没有随其移动。SDK 是新登记的独立仓库，不借用主仓 SHA。SDK README 链接 Anthropic 官方 Agent SDK 文档，pyproject 列 Anthropic 作者；两者与官方组织来源一致。SDK 的 `_internal` 只是公开客户端的模块命名，不等于 CLI 的未公开内部实现。

## 源码路径

- 公开示例：`examples/hooks/bash_command_validator_example.py`。`main` 第 56–72 行读 JSON 并分支，第 74–79 行消费 `_validate_command` 的结果；定义在第 48–53 行。这里只引用脚本行为，实际退出码怎样被产品消费另看官方文档说明，不能用注释还原二进制内部调用链。[固定脚本定义](https://github.com/anthropics/claude-code/blob/b022ba6df88a5ddfbcedc39739a191c7e2ff5196/examples/hooks/bash_command_validator_example.py#L48-L53)
- SDK：`src/claude_agent_sdk/query.py` → `_internal/client.py` → `_internal/transport/subprocess_cli.py`；客户端在初始化后发送 user JSON，从 `_internal/query.py` 分流消息，再用 `_internal/message_parser.py` 解析并 yield。共 19 条 SDK 证据与公开示例的 6 条证据分别核验。[固定 query 定义](https://github.com/anthropics/claude-agent-sdk-python/blob/3184360393a92ca8a6ec7bbbdee571afd1ce1c56/src/claude_agent_sdk/query.py#L11-L20)

## 文档快照

原始 Markdown 响应按 SHA-256 随应用保存于 `materials/claude`，摘要不经过重新排版或换行归一化。阅读卡保存官方 URL、UTC 抓取时间、标题定位、短选区及选区摘要，中文说明和待查问题单列。导入只复制应用附带的已核对快照到本机资料库，不提供任意 URL 抓取接口。

| 卡片 | 原始响应 SHA-256 | 定位 |
| --- | --- | --- |
| sdk-overview v1 | `6bf994e5897cbf228f19e17b177036fe23cdbd02b790944f72a090f07e80258d` | `## Compare the Agent SDK to other Claude tools` 下的工具分类段落 |
| hooks-guide v1 | `b3139b7a8e1e8057122ee300f8e907667856b43dd97f5e8de862724be9cd19a1` | `# Automate actions with hooks` 下的用户定义 Hook 段落 |

每次阅读重验原始摘要及标题所在段落选区，不仅检查字符串在全文某处出现。快照损坏时停止展示，允许从应用内同 SHA 副本修复。产品文档更新必须新增阅读卡版本；本机的旧版清单和快照保留。Git 课程与阅读卡的版本号互不替代。

## 许可证与审稿边界

公开主仓的 LICENSE.md 声明 Anthropic 版权所有并适用 Commercial Terms；不能将“公开可读”称为“CLI 内核开源”。Python SDK 的 LICENSE 为 MIT。这里只提交中文教材和定位元数据，不复制或执行上游源码；官方文档快照保留来源归属，见 [资料说明](../materials/claude/NOTICE.md)。

v2 课程结构强制声明来源类别，每条断言类别须与登记仓库一致，内部类别不能写入断言；内部问题使用独立对象，禁止混入 fact/text 字段。此检查能阻止结构误标，不能判定自然语言是否真实，调用解释与教学质量仍需独立负责人审稿。负例与恢复测试见 [Phase 5 测试](../tests/phase5.test.ts)。
