# Harness Academy

一个本地优先的中文 Agent Harness 源码学习平台。学习者从具体问题进入课程，先看架构和执行过程，再跳到固定 Git 提交中的函数与行区间，最后通过练习、笔记和复习检验理解。

**当前交付为 Phase 0，待项目负责人验收。** 本仓库提供产品与技术设计、四个来源的版本基线，以及可以独立检查的课程和数据库契约。首个应用版本在 Phase 1 接入 Pi。

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

## 复核本次设计

使用 Python 3.10+ 和含 JSON 函数的 SQLite 3.38+。在已激活的 Python 虚拟环境中安装校验依赖，再从仓库根目录运行检查。安装完成后，检查只使用内存数据库和本地测试夹具。

```sh
python -m pip install "jsonschema[format]>=4.18,<5"
python checks/phase0.py
```

四个上游的联网复核方法见[仓库与证据](docs/REPOSITORY_SOURCES.md)。

项目自身采用 [MIT 许可证](LICENSE)。上游源码和官方资料的使用遵循各自的许可。
