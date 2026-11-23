# Harness Academy：Agent Harness 源码学习实验室

你现在是一名资深 Agent Harness 架构师、源码分析工程师和全栈开发工程师。

我希望你帮助我开发一款名为 **Harness Academy** 的本地源码学习软件。

## 一、项目目标

这不是普通的代码阅读器，而是一款帮助开发者系统学习 Agent Harness 源码的专业学习平台。

我的目标是从真实开源项目开始，逐步学习：

1. Pi Agent Harness
2. OpenAI Codex CLI
3. DeepSeek Harness
4. Claude Code（公开仓库、SDK 和官方文档）

最终让我能够独立阅读、分析、理解和实现 Agent Harness。

## 二、核心学习理念

必须遵循以下学习原则：

1. 从真实源码出发，不允许凭空编造源码逻辑。
2. 先解释整体架构，再学习具体模块。
3. 先解释运行原理，再进入函数和类的实现。
4. 每个知识点必须关联真实源码文件、函数和行号。
5. 使用简单直白的中文解释复杂技术。
6. 每个知识点必须结合实际业务场景。
7. 每个章节必须包含源码阅读、执行流程、知识总结和练习题。
8. 区分源码明确证实的事实、合理推断和个人设计建议。
9. 源码必须固定 Commit SHA，确保课程可以复现。
10. 不允许为了方便而将不同项目的实现混为一谈。

## 三、首批学习仓库

请预先建立以下仓库配置：

Pi：
https://github.com/agentic-labs/pi-mono

OpenAI Codex：
https://github.com/openai/codex

DeepSeek Harness：
https://github.com/DeepSeek-ai/deepseek-harness

Claude Code：
https://github.com/anthropics/claude-code

注意：

Claude Code 必须区分公开仓库内容、官方 SDK 和无法直接验证的内部实现，不得虚构其内部源码。

第一阶段只深入学习 Pi，其他仓库暂时作为后续课程。

## 四、软件核心功能

### 1. 学习中心

展示所有 Harness 项目、课程、学习进度和知识地图。

### 2. 源码仓库管理

支持：

- GitHub 仓库导入
- 本地目录导入
- Git Commit 版本固定
- 仓库目录树
- 多仓库管理

### 3. 源码阅读器

支持：

- 代码高亮
- 文件路径定位
- 函数定义与引用跳转
- 关键代码行标记
- 源码与课程双向关联

### 4. AI 源码导师

支持：

- 简单中文解释
- 类和函数职责分析
- 函数调用链解释
- 数据流分析
- 实际场景结合
- 源码证据定位

所有源码结论必须能够回溯到对应仓库、Commit、文件和行号。

### 5. 可视化实验室

支持：

- Agent Loop 执行过程展示
- Tool Calling 流程展示
- Event 时间线
- State 变化
- 单步执行
- 暂停、继续和重置

初期使用 Mock LLM 和 Mock Tool，不要求真实模型 API。

### 6. 学习系统

支持：

- 章节学习状态
- 学习笔记
- 疑问记录
- 知识测试
- 错题记录
- 阶段复习
- 学习成果统计

## 五、统一学习课程标准

每一个知识点必须包含：

1. 学习目标
2. 前置知识
3. 技术概念解释
4. 真实源码位置
5. 关键函数和类
6. 源码执行流程
7. 函数调用关系
8. 简单业务场景
9. 技术设计原因
10. 常见问题
11. 练习题
12. 本章总结

讲解必须通俗易懂，但技术结论必须准确。

## 六、技术实现原则

优先考虑：

- 前端：React + TypeScript
- 后端：Node.js + TypeScript
- 数据库：SQLite
- 代码编辑器：Monaco Editor
- 流程图：Mermaid
- 本地源码索引：Git + ripgrep，后续按需引入 Tree-sitter

优先开发本地 Web 应用，后续再考虑桌面打包。

要求：

- 本地优先，不上传源码到云端。
- API Key 不得硬编码。
- 第一阶段不依赖真实 LLM。
- 不自动执行导入仓库中的未知代码。
- 真实代码运行必须经过用户明确授权和安全隔离。
- 不要提前引入没有实际需求的复杂技术。

如果当前工作区已有项目，请先检查现有结构，不得随意覆盖原有文件。

## 七、开发阶段

必须严格按照以下阶段开发：

Phase 0：产品需求、架构、数据模型、学习规范和开发计划。

Phase 1：学习平台 MVP，首先接入 Pi。

Phase 2：Pi 源码深度学习和可视化实验。

Phase 3：Codex 源码课程。

Phase 4：DeepSeek Harness 源码课程。

Phase 5：Claude Code 公开资料与 SDK 学习。


每个 Phase 必须具有：

- 明确任务
- 具体交付物
- 验收标准
- 测试要求
- Git 提交要求

## 八、当前任务：只执行 Phase 0

现在不要直接开发全部功能。

请先完成：

1. 检查当前工作区。
2. 分析产品需求。
3. 设计整体技术架构。
4. 设计数据库模型。
5. 设计课程数据 Schema。
6. 设计源码证据与版本关联机制。
7. 设计 UI 页面结构。
8. 制定 Phase 0～Phase 5 开发计划。
9. 制定 GitHub 提交规范。
10. 创建项目 AGENTS.md，明确 Codex 后续开发规范。

建议交付：

- README.md
- AGENTS.md
- PLAN.md
- docs/PRD.md
- docs/ARCHITECTURE.md
- docs/DATA_MODEL.md
- docs/LEARNING_SCHEMA.md
- docs/LEARNING_METHODOLOGY.md
- docs/REPOSITORY_SOURCES.md
- docs/SECURITY.md
- docs/GITHUB_SPECIFICATIONS.md

完成后：

1. 检查文档是否相互一致。
2. 给出项目目录结构。
3. 说明整体软件架构。
4. 说明各个 Phase 的开发依赖。
5. 明确 Phase 1 的具体开发任务。
6. 等待我验收，不要擅自进入 Phase 1。

请以长期维护、可扩展、真正能够辅助学习大型 Agent Harness 源码为设计目标，而不是为了快速完成一个演示项目。