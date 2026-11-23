# Harness Academy

一个本地优先的中文 Agent Harness 源码学习平台。学习者从具体问题进入课程，先看架构和执行过程，再跳到固定 Git 提交中的函数与行区间，最后通过练习、笔记和复习检验理解。

**Phase 4 已接入 DeepSeek Harness。** Pi 提供四章深入课程及 Mock 实验；Codex 提供架构导读、模型轮次和工具结果三章；DeepSeek 新增插件架构、模型 step 与原生工具结果三章。三个项目支持固定源码阅读、本地导师、符号候选和独立学习记录。旧版课程与记录继续保留，Claude Code 计划在 Phase 5 开课。

## 本机启动

准备 Node.js 24.12 或更高版本、npm、Git 和 ripgrep（`rg`，用于符号候选检索）。在仓库根目录执行以下命令，然后打开终端打印的地址。默认地址为 `http://127.0.0.1:4317`。

```sh
npm ci
npm run build
npm start
```

1. 在学习中心选择 **导入 Pi 源码**。可确认预填的 GitHub 来源，也可以切到“本机目录”，输入已含该提交的工作树或裸仓库的绝对路径。关联工作树可选择主仓库。保留首章基线 SHA 后点击“开始导入”。
2. 打开 **Pi 架构与运行机制 → 从输入消息到 Agent Loop**。在“源码阅读”中选择 `agentLoop`，阅读器会标记第 32–55 行。点击“返回原章”可回到原证据。
3. 保存笔记和疑问，提交练习，再点“标记本章完成”。学习记录页可以查看历次作答；最新作答正确时，该题退出待复习列表。
4. 在章节打开“本章源码导师”查看职责、调用链和数据流，或打开 Mock 实验，选择工具成功、抛错、工具不存在三种场景，单步或自动播放。在阅读器输入标识符检索候选，也可在 Monaco 使用 F12 / Shift+F12；候选是文本定位，需要核对上下文。
5. 在“学习记录 → 阶段复习与统计”比较每道题的首次与最近作答。旧用户在“源码导师与实验”点击“从已固定源码更新 Phase 2 教材”，可离线新增 v2；v1 的进度和笔记保留，新版独立计数。

### 学习 Codex

在学习中心打开 **OpenAI Codex CLI**，导入其预填来源 `https://github.com/openai/codex` 和完整提交 `d4014cb19d23614be39c0cf57d981e042ba0763a`，也可选择含该提交的本机工作树或裸仓库。导入后自动发布 **Codex 架构与核心执行路径 · v1**，依次阅读入口、任务轮次和工具结果三章。

从第二章打开 `run_turn`，应定位 `codex-rs/core/src/session/turn.rs` 第 227–249 行。阅读器默认在当前目录查询；需要跨模块时，把“检索目录”改为 `codex-rs/core/src`。全仓超过 4000 文件或 32 MiB 的检索预算会提示缩小范围，定义/引用仍是文本候选。

导师可按项目切换，也会从章节带入正确版次；复习页可按 Codex 或 Pi 单独筛选。Codex 教材只讲固定公开版本的本机 `codex exec` 普通任务路径，不执行 Codex、不调用模型。现有订单 Mock 对应 Pi，Codex 不复用这条模拟作为实现证据。[Phase 3 验收与手动复核](docs/PHASE3_ACCEPTANCE.md)

默认数据目录为当前用户主目录下的 `.harness-academy`。SQLite、已固定的 Git 对象和学习记录保存在本机，导入后可断网阅读。可在启动前设置 `HARNESS_DATA_DIR` 和 `HARNESS_PORT`。备份时先停止服务，再复制整个数据目录；恢复时将 `HARNESS_DATA_DIR` 指向该副本。全部学习功能在本机运行，无需模型密钥。

### 学习 DeepSeek Harness

在学习中心打开 **DeepSeek Harness**，导入预填来源 `https://github.com/DeepSeek-ai/deepseek-harness` 和完整提交 `2e39e70496aa02986ca6a820c5d497e816b69d7e`，也可使用含该提交的本机工作树或裸仓库。导入后发布 **DeepSeek Harness 插件架构与执行路径 · v1**：先读 headless 的插件与工厂入口，再追 turn/step 和原生工具结果回填。

首章打开 `followup`，应定位 `packages/core/agent-loop/src/agent.ts` 第 171–189 行；在当前目录搜索 `followup` 定义候选，应命中第 180 行。全仓超检索预算时缩小到 `packages/core/agent-loop/src`。从章节进入导师、保存笔记和完成练习，复习页可单独筛选 DeepSeek。现有订单 Mock 仍只对应 Pi。

本课仅覆盖固定公开版本、默认 base 的 headless 新会话与 native 工具路径。各章说明未覆盖范围；模型服务端内部、其他 profile、PTC 和平台安全实测没有被概括为事实。[公开组件与资料缺口表](docs/DEEPSEEK_SCOPE.md) · [Phase 4 验收与手动复核](docs/PHASE4_ACCEPTANCE.md)

## 从哪里开始读

| 想了解什么 | 入口 |
| --- | --- |
| 谁会使用、首版可以完成什么、页面怎样走通 | [产品需求与页面设计](docs/PRD.md) |
| 浏览器怎样安全读取固定版本的源码 | [软件架构](docs/ARCHITECTURE.md) · [安全边界](docs/SECURITY.md) |
| 一章课如何编写、保存和验证 | [课程数据契约](docs/LEARNING_SCHEMA.md) · [教学规范](docs/LEARNING_METHODOLOGY.md) |
| 学习记录和证据如何跨会话保留 | [数据库模型](docs/DATA_MODEL.md) |
| 四个项目来自哪里，行号如何复核 | [仓库与证据](docs/REPOSITORY_SOURCES.md) |
| 接下来做什么、如何验收和提交 | [阶段计划](PLAN.md) · [GitHub 规范](docs/GITHUB_SPECIFICATIONS.md) · [开发约定](AGENTS.md) |

## 仓库目录

```text
README.md
AGENTS.md
PLAN.md
LICENSE
server/                         本机 API、SQLite、Git 与课程校验
shared/                         前后端共用的课程与学习记录类型
web/                            React 学习中心、章节、Monaco 阅读器
courses/pi-foundations.v1.json   不可变的 Pi 旧版架构导读
courses/pi-foundations.v2.json   同一 Git 基线的四章深入课程
courses/codex-foundations.v1.json Codex 独立 Git 基线的三章课程
courses/deepseek-foundations.v1.json DeepSeek 独立版次与公开范围课程
shared/lab.ts                   不执行上游代码的确定性 Mock 引擎
tests/                          单元、集成、进程重启及真实 Pi 验收
config/
  repositories.json             四个项目的公开仓库和固定提交
docs/
  PRD.md                        需求、页面及验收路径
  ARCHITECTURE.md               模块、接口和本地数据流
  DATA_MODEL.md                 数据归属、索引和事务
  LEARNING_SCHEMA.md            课程发布、字段和语义验证
  LEARNING_METHODOLOGY.md       课程编写与审稿标准
  REPOSITORY_SOURCES.md         证据定位和版本变更
  SECURITY.md                   信任边界与负向用例
  GITHUB_SPECIFICATIONS.md      提交和评审
  schema/
    academy.sql                 可在空 SQLite 库执行的设计基线
    course.schema.json          JSON Schema Draft 2020-12
checks/
  phase0.py                     离线验收设计契约
```

## 测试

`npm test` 在独立临时目录运行离线测试，默认跳过需要真实 Pi/Codex/DeepSeek 来源的三个用例。`npm run build` 同时检查 TypeScript 和生产构建。最新命令及范围见 [Phase 4 验收记录](docs/PHASE4_ACCEPTANCE.md)；Pi 的 Mock 输入及完整事件序列保留在 [Phase 2 验收记录](docs/PHASE2_ACCEPTANCE.md)，两种真实 Pi 来源的导入步骤见 [Phase 1 验收记录](docs/PHASE1_ACCEPTANCE.md)。

### Phase 0 设计契约

使用 Python 3.10+ 和含 JSON 函数的 SQLite 3.38+。在已激活的 Python 虚拟环境中安装校验依赖，再从仓库根目录运行检查。安装完成后，检查只使用内存数据库和本地测试夹具。

```sh
python -m pip install "jsonschema[format]>=4.18,<5"
python checks/phase0.py
```

四个上游的联网复核方法见[仓库与证据](docs/REPOSITORY_SOURCES.md)。

项目自身采用 [MIT 许可证](LICENSE)。上游源码和官方资料的使用遵循各自的许可。
