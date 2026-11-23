# Harness Academy 开发约定

本仓库用于开发中文、本地优先的 Agent Harness 源码学习平台。开始任务时先读 [README](README.md)、[阶段计划](PLAN.md) 和相关设计；核对当前工作树、用户修改及远端历史。

## 工作范围

- Phase 0–3 已完成，当前实现为 Phase 4。后续依序推进，并按 PLAN 中该阶段的任务、交付物、验收、测试、Git 要求完成工作。
- 当前开放 Pi、Codex 与 DeepSeek Harness，Claude Code 先登记。前端采用 React + TypeScript，后端采用 Node.js + TypeScript 和 SQLite。阅读器使用 Monaco，流程图使用 Mermaid。Git 提供版本事实，ripgrep 用于固定版本上的文本查询。
- 新增页面或接口前核对 PRD 与架构；新增持久化同时核对数据模型、迁移与旧记录恢复。维持单用户本地部署，先用已有组件解决已出现的问题。

## 前端设计技能

- 设计学习中心、章节页、源码阅读器或复习页时，先用 `ui-ux-pro-max` 选取适合长时间中文阅读的字号、行距、色彩和响应式布局。结合 React 与 Monaco 的实际交互，保留键盘焦点和清晰的证据行标记。
- 用 `impeccable` 评审实现后的页面。沿“章节 → 源码证据 → 返回章节”走一遍，在宽屏和窄屏核对阅读层级、焦点恢复和侧栏收放，再检查加载、空数据与证据缺失时的反馈。
- 两个技能使用 Codex 本机安装目录。运行配套工具时以各自 `SKILL.md` 所在目录解析脚本路径，工作目录保持为项目根目录。安装基线见 [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/f76d1653d7467fc11fb9d9d79295a421c92ab958/.claude/skills/ui-ux-pro-max) 和 [Impeccable](https://github.com/pbakaus/impeccable/tree/b49177d32788f2dc585c42831d845dacf1ebed2c/.agents/skills/impeccable)。

## 课程和证据

- 以完整 SHA 读取 Git 对象，记录原路径、符号、行区间、blob OID 和选区摘要。源码结论要能回到该项目和该版。升级提交或教材内容时保留旧版和原学习记录。
- 每章按课程 Schema 的十二项编写，先整体后局部，先原理后实现，用中文结合具体业务场景。分别标记事实、推断与设计建议；证据不足就按实际公开范围缩小结论。
- Claude Code 的公开仓库、官方文档、官方 SDK 与未验证的内部实现严格区分。跨项目比较只通过各自的独立版次引用。

## 安全、测试和交付

- 按 [安全设计](docs/SECURITY.md) 处理不可信仓库、教材及路径。保留用户选择范围和回环边界。导入或读码不执行上游代码，不将源码、学习数据或凭据发往云端；模型密钥不得硬编码。
- 修改课程契约、DDL、来源清单或文档链接后运行 `python checks/phase0.py`。应用改动运行 `npm test` 和 `npm run build`。涉及 Pi 证据或 Git 导入时，按 [Phase 1 验收记录](docs/PHASE1_ACCEPTANCE.md) 复跑真实仓库。明确区分实际执行的测试与计划中的验收。
- 按 [GitHub 规范](docs/GITHUB_SPECIFICATIONS.md) 审阅差异、分批暂存、说明验证。交付时列出实际改动、测试结果、提交位置和待验收项。
