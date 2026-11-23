# Phase 5 验收记录

2026-11-23，Windows、Node.js 24.22.3、Git 2.54.0.windows.1、ripgrep 15.2.0。应用版本 0.5.0；使用独立 QA 数据目录和临时 Git/SQLite 夹具，没有修改个人数据库及未跟踪的原始需求文件。

## 已实现内容

| 交付 | 实际范围 |
| --- | --- |
| 公开仓库课程 | `anthropics/claude-code` 固定 `b022ba6df88a5ddfbcedc39739a191c7e2ff5196`；`claude-public` v1，一章 Hook 示例、6 条证据 |
| 官方 SDK 教材 | `anthropics/claude-agent-sdk-python` 独立固定 `3184360393a92ca8a6ec7bbbdee571afd1ce1c56`（0.2.187）；`claude-sdk-python` v1，两章、19 条证据 |
| 练习与导师 | 两门课程共三道单选及一道追踪自评；职责、调用链和数据流带来源标记，可返回同版源码；内部问题单列 |
| 官方文档阅读卡 | 两份官方原始 Markdown 响应、时间、URL、响应 SHA-256、标题、短选区及选区 SHA-256；本机导入、离线复读、纯文本原文与损坏修复 |
| 多来源平台 | 四个项目、五个 Git 来源，Claude 可分别选择公开主仓和官方 SDK；edition/阅读器/导师显示仓库与类别，发布与更新可限定仓库 |
| 契约与旧记录 | Claude 课程使用 Schema v2，逐条分类与主仓类别一致；禁止内部类别进入断言，问题不能混入 fact/text。旧 Schema v1 原样读取，SQLite user_version=2 不变 |

来源、独立 SHA、公开范围、未验证问题与快照摘要见 [Claude 来源审阅](CLAUDE_SCOPE.md)，两套 [课程格式](LEARNING_SCHEMA.md) 并存。每个源码知识点仍有完整十二项；原始路径、符号、行区间、blob OID 与选区摘要由独立 Git 对象计算。

实际复读路线：

1. 公开文件 `examples/hooks/bash_command_validator_example.py`：main 读 stdin → Bash/空命令分支 → `_validate_command` 第 48–53 行 → issues 回到 main → stderr/退出。配置与产品退出码协议的说明不被当作内部调用链。
2. SDK `query.py:11` → query 委托 InternalClient.process_query → `_process_query_inner` 选择 transport → 默认 SubprocessCLITransport.connect → anyio.open_process 管道 → Query start/initialize → user JSON 写入。
3. 传输读 NDJSON → Query._read_messages 分流控制请求/响应 → receive_messages → parse_message → query 调用者；核对 hook_callback 与 can_use_tool 分支，并明确只证明 SDK 侧接口。

## 实际验证结果

| 验证 | 结果 |
| --- | --- |
| `npm test`，启用五个真实本机 Git 来源 | **22 项全部通过，无跳过**；覆盖旧 Pi/Codex/DeepSeek、Claude 双仓、记录隔离、重启与证据恢复 |
| `node --test tests/claude.test.ts tests/pi.test.ts`，同时启用 GitHub 与本机来源 | **2 项通过**，实际涵盖 Claude 公开仓库、官方 SDK 和 Pi 的双来源；同仓同 SHA 两种来源返回同一 release |
| 真实 Claude 全证据回放 | 25 条全部读取并重算选区摘要；核对 blob、逐章导师、分类与练习答案；Python 定义候选 query:11、_validate_command:48 命中 |
| 来源审稿负例 | 错仓库、错提交、错 blob、SDK 声明为公开仓库、断言类别与仓库不符、internal fact 类别及问题对象混入 fact/text 均拒绝 |
| 官方快照负例 | 错响应摘要、缺失标题、选区在其他节、错选区摘要、非官方 URL、非法 id、同版不同清单均拒绝；损坏响应停止展示，重导修复 |
| 快照与历史恢复 | 原始响应以 text/plain 返回，摘要逐字节一致；重启后本机阅读卡及同项目双仓的独立笔记/作答仍可读 |
| `npm run build` | 最终 TypeScript 与生产构建通过；保留既有 Monaco/Mermaid 大包及依赖 use-client 提示 |
| `python checks/phase0.py` | **13 项通过**；新增 v2 包与阅读卡 Schema、来源、原始响应摘要检查，原 12 项保留 |

Python 依赖按 README 要求安装；本次复用被忽略的 QA 格式依赖目录，通过 PYTHONPATH 运行。涉及回环与 Git 子进程的测试使用本机执行权限和独立临时库。没有运行上游代码、CLI 或真实模型，测试中的业务输入均为源码阅读推演。

原始响应使用 `.gitattributes` 禁用文本换行转换，防止 Windows 的 autocrlf 改动内容寻址字节；另将已提交快照检出到 QA 目录，逐个复算 SHA-256 验证可移植性。

### 重跑

```powershell
npm ci
npm run build
python -m pip install "jsonschema[format]>=4.18,<5"
python checks/phase0.py

$env:ACADEMY_PI_DIRECTORY = "D:\Repositories\pi-mono"
$env:ACADEMY_CODEX_DIRECTORY = "D:\Repositories\codex"
$env:ACADEMY_DEEPSEEK_DIRECTORY = "D:\Repositories\deepseek-harness"
$env:ACADEMY_CLAUDE_DIRECTORY = "D:\Repositories\claude-code"
$env:ACADEMY_CLAUDE_SDK_DIRECTORY = "D:\Repositories\claude-agent-sdk-python"
npm test

$env:ACADEMY_TEST_CLAUDE_GITHUB = "1"
$env:ACADEMY_TEST_GITHUB = "1"
node --test tests/claude.test.ts tests/pi.test.ts
```

目录需包含课程的对应完整提交，工作树和裸仓库均支持。不设置真实来源变量时，四个真实来源用例按设计跳过（Claude 一个用例覆盖双仓），其余为离线测试。

## 浏览器与设计复核

已实际操作：

- 项目页分别提供公开仓库、SDK 和文档阅读卡入口；课程选择可切到两章 SDK 教材，同项目没有重复项目行。
- 仓库管理切换 SDK 后，URL 与完整 SHA 属于官方 SDK；阅读器持续显示 SDK 类别与仓库 ID。SDK query 定位第 11–20 行，公开 `_validate_command` 定位第 48–53 行，返回原章焦点恢复到原证据。
- 公开章节断言标“公开仓库”，SDK 章节与导师标“官方 SDK”；内部未验证问题单列。两种首章的静态 Mermaid 图只描述公开代码边界。
- SDK 单选先错后对，保存中文笔记；Claude 统计为 1/4 题已答、首次错→最近对 1、待复习 0。旧 Pi v1 可移植深链仍打开 agentLoop 第 32–55 行。
- 从列表导入文档快照并阅读，URL、抓取时间、两种摘要及定位节选可见；屏蔽全部外部 HTTPS 后，仍能导入另一张应用内快照并读取其正文。
- SDK 缺失证据显示错误，修复入口明确指向 SDK 仓库，未退回 Claude 公开主仓。
- 390×844 下项目、SDK 章节、阅读器、仓库管理、阅读卡列表/正文和复习页实测 scrollWidth=390。章节目录与文件目录可 Enter 展开、Escape 关闭并恢复触发器焦点。

UI/UX Pro Max 用于阅读页与响应式选型，沿用现有中文 16px/1.85 行高和本地配色。Impeccable 实际取得并查看 1440×900、390×844 的项目页、阅读卡列表/正文及 SDK 章节截图。发现来源提示中的链接在窄屏被 flex 挤成窄列，改为普通文本流后复核；长 URL、摘要和版次选择框可在窄屏阅读。机械扫描变更文件的结果为整份旧 CSS 的 112 条字面量提示（47 色彩、58 字号、7 圆角），变动 TSX 与新增布局规则没有命中。

阅读器的源码、行区间、焦点与宽度已由真实浏览器操作验证；本次没有取得其最终源码面板的专门截图。真实触控设备、系统读屏和课程教学质量仍交负责人独立复核。截图与 QA 数据保存在忽略目录，不提交个人数据或导入对象。

## 交付与负责人验收

分支 `codex/phase5`，基于 Phase 4 `a82894f`。远端 main 尚停在前序设计基线；本阶段只追加本地提交，保留前序分支和未跟踪的原始需求文件。按来源核对、公开课程、SDK 课程、补充资料、平台接入及验收拆分；完整提交位置见分支日志。

| 提交 | 内容 |
| --- | --- |
| `311f9eb` | 来源核对、公开范围与未验证问题 |
| `9e809f9` | Claude 公开仓库 Hook 课程 |
| `5705a67` | 独立官方 Python SDK 教材 |
| `3623384` | 官方文档阅读卡与原始响应快照 |
| `89e43e2` | 原始快照的跨平台字节保留规则 |
| `14166db` | 多来源平台、Schema v2、快照服务与测试 |

本记录、README、PLAN 和阶段约定另作最终文档提交。

负责人可从 Claude 项目页分别导入两仓并完成三章阅读，各打开一条证据再返回；导入两张阅读卡，核对响应摘要与标题段落；重启后查看原笔记、作答及 Pi/Codex/DeepSeek 记录。需要独立审阅自然语言结论、公开范围、许可证归属和教学质量：结构与摘要校验能阻止机械误引，不能证明一段内部机制推测是真的。
