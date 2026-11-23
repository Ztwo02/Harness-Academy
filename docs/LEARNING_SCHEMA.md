# 课程数据契约 v1

交换单位是一份完整课程发布包。结构以 [course.schema.json](schema/course.schema.json) 为准，采用 JSON Schema Draft 2020-12 和 UTF-8 JSON。发布包是作者输入和导出的标准格式，SQLite 保存同一份原文以及反向查询需要的索引。

| 根字段 | 约定 |
| --- | --- |
| schemaVersion | 当前为 1；读取方先分派版本。遇到未知版本停止导入并显示所需格式 |
| projectId、repositoryId、commit | 已登记的一个项目、其一个主仓库及完整 Git 提交，整包共用 |
| courseId、version、title | 项目内的稳定课程 ID、正整数版次和显示名。修订内容或更新固定提交都发布新版 |
| sourceEvidence | 键是版内稳定证据 ID；值包含 path、symbol、startLine、endLine、blobOid、excerptSha256。至少一条 |
| materials | 可为空的官方资料字典。每项含 kind、url、accessedAt、sha256、locator；供补充引用，不代替源码证据 |
| lessons | 非空且有序的知识点数组。一章聚焦一个可验证问题；每章必须满足以下十二项 |

| 教学项 | 字段 | 要求 |
| --- | --- | --- |
| 1 学习目标 | objectives | 用可检查的动作表述，例如“指出调用发生在哪一行” |
| 2 前置知识 | priorKnowledge、prerequisiteLessons | 前者写必要基础，后者引用本版已有章节 ID；首章可无前置章 |
| 3 技术概念 | concepts | 由浅入深的可追溯断言 |
| 4 真实源码 | sourceReading | 按阅读顺序列出证据 ID |
| 5 函数和类 | keySymbols | 每项 name、sourceRef 指向该符号实际所在的证据 |
| 6 执行流程 | execution | 按触发、分支、结果列断言，顺序有意义 |
| 7 调用关系 | calls | 交代调用者、被调用者和条件；涉及多处实现时列出相应证据 |
| 8 业务场景 | scenario | 具体输入、角色与预期结果，教学假设显式标出 |
| 9 设计原因 | designRationale | 有作者或代码明证时写事实，由现象推导动机时写推断 |
| 10 常见问题 | faq | 每项用 question 提问、用 answer 断言回答 |
| 11 练习题 | exercises | 至少一道；解释必须能带学习者回到证据 |
| 12 总结 | summary | 列出本章能用源码验证的要点 |

## 断言与作答

断言对象含 kind、text、sourceRefs，可附 materialRefs。三种 kind 固定为 fact（源码或材料直接证实）、inference（给出推理依据）、advice（给出适用条件的设计建议）。三类均至少列一个真实源码上下文；建议与推断的文字必须反映结论的强度。引用补充文档的事实同时注明该文档究竟证明了什么。

题目有本章唯一 id、prompt、kind、explanation。single-choice 使用至少两个不同 ID 的 options 和属于其中的 correctOption；trace 使用非空 rubric，通过文字回答和评分点自评。反馈保存题目所属版次，错题重做产生一条新作答。

## 发布校验顺序

1. **结构**。解析时拒绝重复 JSON 键；按 schemaVersion 选择 Schema，启用 URI 与日期时间格式校验。对象拒绝未知字段；ID 采用小写字母开头的小写字母、数字、短横线组合。
2. **引用**。校验项目/仓库归属、课程版次和 Git 格式；检查章节 ID、每章题号、每题选项 ID 唯一；正确答案必须存在。校验所有 sourceRefs/sourceRef/sourceReading、materialRefs；keySymbols 的 name 必须与目标证据的非空 symbol 相同。前置章必须存在、位于当前章之前，不能自引或形成环。
3. **证据**。逐条检查提交树、普通 blob、严格文本、行区间和摘要；官方资料校验来源、快照摘要及段落定位。算法见[仓库与证据](REPOSITORY_SOURCES.md)。先报告具体章节、字段或证据键，再说明修复途径。
4. **审稿**。核实断言、符号职责、调用关系、材料适用范围和练习答案；机器只验证可机械判定的条件。通过后以事务写入不可变版次与反链。任何失败均保留上一个已发布版本。

检查程序中包含一个**仅用于契约验收**的最小完整包，由测试文本生成定位信息。可以从 sample_course 开始查看真实字段形状和合法引用。Pi 的课程内容由 P1 针对已取得的 Pi Git 对象另行编写。[完整夹具与拒绝用例](../checks/phase0.py)

课程结构的破坏性修改需要新增 schemaVersion 和旧包读取/迁移策略；内容版次 version 与数据库 PRAGMA user_version 各自演进。

## Phase 5：课程 v2 与官方阅读卡

[v2 Schema](schema/course-v2.schema.json) 保留十二项、单仓固定提交及证据坐标，增加必填 sourceKind（public-repo/sdk-repo）和 unverifiedQuestions。每条技术断言增加同名来源类别 sourceCategory，必须与本版及数据库登记的 source_kind 一致；内部机制没有合法的断言类别，只能作为 question/reason/verificationNeeded 保留。不得在问题里加入 kind=fact 或 text 来绕过分类。Claude 新课程必须使用 v2。

旧 v1 Schema 与既有课程原文保持不变，应用按 schemaVersion 分派验证器。Pi/Codex/DeepSeek 的旧进度、练习与深链仍按原 release 恢复；数据库无需迁移。结构分类检查不替代自然语言语义审稿。

[阅读卡契约](schema/reading-card.schema.json) 独立于源码课：固定 official-doc 类别、id/version、官方 URL、抓取时间、原始响应 SHA-256、标题定位、短选区及其 SHA-256、中文摘要和未决问题。导入器只接收应用内已核对卡片的 id/version；原始响应不做换行归一化。阅读时校验摘要和标题后同一节内的选区，原文作为纯文本提供，不执行 Markdown 内代码或 HTML。

阅读卡本身不伪造 Git 证据或十二项源码课，也不纳入章节完成率。版本化本机清单及原始响应随数据目录备份；同版不同清单冲突，原始响应缺失或损坏可从应用附带同版副本修复。
