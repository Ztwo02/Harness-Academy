# 仓库、版本与证据

来源的机器可读清单在 [repositories.json](../config/repositories.json)。2026-11-22 使用匿名 Git 读取以下四个地址的 HEAD 和符号引用。下表显示便于识别的前缀，清单保存完整 SHA。它们是可复核的导入基线；实际发布课程还须取得本地 commit、逐条核对文件和函数。

| 项目 | 用户指定的公开仓库 | 核对时的分支 / 提交前缀 | 首次课程 |
| --- | --- | --- | --- |
| Pi | [agentic-labs/pi-mono](https://github.com/agentic-labs/pi-mono) | main / 08dc60bc | P1 导读，P2 深入 |
| Codex | [openai/codex](https://github.com/openai/codex) | main / d4014cb1 | P3 |
| DeepSeek Harness | [DeepSeek-ai/deepseek-harness](https://github.com/DeepSeek-ai/deepseek-harness) | master / 2e39e704 | P4 |
| Claude Code | [anthropics/claude-code](https://github.com/anthropics/claude-code) | main / b022ba6d | P5 |

复核当前上游可运行 `git ls-remote --symref <配置中的 URL> HEAD`。分支移动后以清单 SHA 为准，在本地受管仓库用 `git cat-file -t <完整 SHA>` 核对类型为 commit。URL 无法访问时记录失败，允许从含相同提交的本机 Git 仓库恢复。替换来源或更新基线需要记录原因、审查来源并单独提交。

## 证据身份与核验算法

课程版次固定 **项目 → 仓库 → 完整提交**。每个证据再固定 **仓库相对路径、Git blob OID、1 起算闭区间、可选限定符号名、选区 SHA-256**。函数与类必须有符号名；配置、模块入口等无符号材料可用 null。符号帮助人识别，定位依据仍是原提交树和行区间。

1. 解析 course_release 得到唯一仓库和提交，要求完整小写十六进制 OID（40 或 64 位，须与仓库对象格式一致）。应用持有该提交的 Git 引用，离线重读不依赖上游分支或用户工作树。
2. 从 commit 的根 tree 按区分大小写的路径段逐级查找，只接受普通文件 blob。路径统一使用正斜杠；拒绝绝对路径、盘符、反斜杠、空段、点段、控制字符、符号链接和子模块。保留 Git 路径原始拼写，不按 Windows 磁盘规则猜测。
3. 首先比对原始 blob OID。可定位的源码采用严格 UTF-8；开头的一个 UTF-8 BOM 忽略，CRLF 转 LF，孤立 CR 或 NUL 视为不支持。按 LF 分行，仅去掉文件末尾换行产生的最后一个空元素。空文件为零行，空白行和行内空格保留。
4. 检查 1 ≤ startLine ≤ endLine ≤ 文件总行数。取闭区间，用单个 LF 拼接选中各行，不追加终止换行；对其 UTF-8 字节求小写 SHA-256。例：原始文本 `A\r\n\r\nB\r\n` 有三行，选第 1–2 行得到字节 `41 0A`。阅读器使用同一行坐标系。
5. 校验限定符号与代码职责。P1 作者确认定义、调用处与证据范围，审稿人复核；摘要匹配只能证明内容一致。缺对象、越界、摘要不符或符号无法证实均阻止发布，显示仓库/SHA/路径及原因。

可分享的公开源码链接采用 `https://github.com/<owner>/<repo>/blob/<完整提交>/<分段编码的路径>#L<起行>-L<止行>`。本地阅读以同一对象为准。本地独有来源只生成应用内深链。

### 一条已复核的定位样本

在 Pi 基线 `08dc60bc52d89d6823a9738cc90b1916e5e446e5`，函数 `agentLoop` 的定义位于 `packages/agent/src/agent-loop.ts` 第 32–55 行。已读取该提交下的完整文件字节，重算 Git blob OID，并按上述规则计算这 24 行的摘要。可用这条记录人工验收 P1 的阅读器跳转。[打开固定版本的这 24 行](https://github.com/agentic-labs/pi-mono/blob/08dc60bc52d89d6823a9738cc90b1916e5e446e5/packages/agent/src/agent-loop.ts#L32-L55)

| 检查项 | 期望值 |
| --- | --- |
| 完整文件的 Git blob OID | `193e3faf9607fee37207c1cd9ec337f1eab8cec5` |
| 第 32–55 行的 excerptSha256 | `dd1b3f587884c428ab1ee3f8fc985ad9c622c53f4483ddba949d88e3321ed87a` |

## 上游升级

### Codex Phase 3 取证

2026-11-23 取得登记的完整提交 `d4014cb19d23614be39c0cf57d981e042ba0763a`，保持原来源与基线不变。`codex-foundations` v1 的三章引用 13 个文件、28 个闭区间，记录各自原路径、符号、blob OID 和选区摘要。范围是本机 `codex exec` 普通用户任务，沿 CLI → 内嵌 app-server → Session 输入队列 → RegularTask → 模型采样与工具产物回填取证；不把默认 TUI、远端路径或服务端未公开实现纳入事实。

例如 [run_turn 原始定义](https://github.com/openai/codex/blob/d4014cb19d23614be39c0cf57d981e042ba0763a/codex-rs/core/src/session/turn.rs#L227-L249) 的 blob 为 `69cf16e774791a1d9b11e38768391e33f027645b`，第 227–249 行摘要为 `10adf0bd362dbf5a03df03824caa0ae24dd5255d1cdb17068092811b931935a7`。上游该提交的 LICENSE 为 Apache-2.0；本仓库提交中文教材和证据元数据，源码对象保存在用户本机，不复制上游工作树。真实双来源回放见 [Phase 3 验收记录](PHASE3_ACCEPTANCE.md)。

### 更新流程

显式获取新 SHA，与旧提交通读相关 diff，在新树重新定位函数与行区间，重新计算两个摘要，人工复核断言和习题。以新课程版次发布，保留旧版、旧对象与学习记录。重命名、拆函数或出现多个候选时进入待复核清单；不能把附近同名行当作已有证据。

## Claude Code 的资料边界

| 类别 | 收录方式 | 能支持的结论 |
| --- | --- | --- |
| 公开仓库 | 使用上表主来源，以 commit、blob、函数及行号引用 | 该公开文件在该版本实际展现的行为 |
| 官方 SDK | 确认 Anthropic 官方来源后，单独登记 sdk-repo，另建固定提交的课程版次；SDK 文档另建 material | 具体 SDK 或公开接口的行为，注明适用版本 |
| 官方文档 | 记录 HTTPS URL、抓取时间、标题/段落定位和原始响应正文的 SHA-256，在本地保留快照 | 公开描述的接口和用法；网页变化时复核新快照 |
| 内部实现 | 登记为待验证问题，比较表可显示“公开资料未覆盖” | 缺少公开证据的内部机制不形成课程事实或调用链 |

同一页面可以并列展示多个来源类别，每条结论须保留自己的证据。纯文档资料可建阅读卡；正式源码知识点仍须关联真实源码。若公开内容不足，缩小教学目标并记录缺口。
