---
name: Harness Academy
description: 面向中文开发者的本地源码学习工作台
colors:
  blue: "#3053b2"
  navy: "#203458"
  tint: "#eaf0ff"
  focus: "#2958c2"
  green: "#236453"
  progress: "#cee1a8"
  evidence-fill: "#edf1ff"
  evidence-line: "#5071c2"
  ink: "#202c42"
  muted: "#56657b"
  canvas: "#f5f6f9"
  paper: "#fff"
  line: "#dce1e9"
typography:
  display:
    fontFamily: '"Source Sans 3", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "clamp(28px, 3vw, 42px)"
    fontWeight: 740
    lineHeight: 1.3
    letterSpacing: "-0.035em"
  reading:
    fontFamily: '"Source Sans 3", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "16px"
    lineHeight: 1.85
  label:
    fontFamily: '"Source Sans 3", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "14px"
    fontWeight: 600
  reference:
    fontFamily: '"IBM Plex Mono", "Cascadia Code", Consolas, monospace'
  editor:
    fontFamily: '"Cascadia Code", Consolas, monospace'
    fontSize: "14px"
    lineHeight: "23px"
rounded:
  tag: "4px"
  field: "6px"
  control: "7px"
  disclosure: "8px"
  panel: "12px"
spacing:
  compact: "8px"
  small: "12px"
  medium: "16px"
  section: "20px"
  chapter: "26px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    typography: "{typography.label}"
    padding: "7px 14px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    typography: "{typography.label}"
    padding: "7px 14px"
  button-subtle:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "3px 8px"
  pi-action:
    backgroundColor: "#eff3ff"
    textColor: "{colors.navy}"
    rounded: "{rounded.field}"
    padding: "9px 14px"
  text-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "9px 11px"
  nav-current:
    backgroundColor: "#e9efff"
    textColor: "#2b4eaa"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  evidence-chip:
    backgroundColor: "#f3f6fc"
    textColor: "{colors.blue}"
    rounded: "{rounded.tag}"
    padding: "2px 6px"
  pi-panel:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.paper}"
    rounded: "{rounded.panel}"
  project-list:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  directory-toggle:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "9px 16px"
---

# Harness Academy 设计系统

## Overview

**Creative North Star: "中文源码阅读工作台"**

学习中心面向能读代码、首次系统学习 Agent Harness 的中文开发者。首页先列出四个项目。Pi 展示学习入口、章节完成率和已完成章数，另外三个项目各自标出开放阶段。

进入章节后，读者从业务场景读到函数，打开固定提交中的源码，再回到原章继续阅读。正文留出行间距，版本、路径和行区间紧邻它们解释的内容。

**Key Characteristics**

- 在同一处查看项目和学习进度。
- 沿函数名与行区间往返章节和源码。
- 可用键盘展开目录、查看版本和继续阅读。

## Colors

海军蓝用于 Pi 面板，浅黄绿色标出 π 字标和已完成的进度。灰蓝背景上的白色区块承载正文和源码，深色文字写内容，灰蓝色文字写路径、说明和数量。链接与主操作用蓝色，证据区间同时用浅蓝整行底色和蓝色左线标出。

**键盘焦点。** 链接、按钮、表单控件和版本摘要获得键盘焦点时，蓝色外框宽 3px，离开控件边缘 3px。

## Typography

中文界面优先使用本机字体。页面标题随视口缩放，章节用较宽的行距连续排文。文件名、提交号和行区间使用等宽字，Monaco 显示固定行高的代码。界面数字启用等宽数字，便于核对进度。

## Layout

桌面左侧为主导航（216px），顶栏放当前位置和本地模式。首页将项目区置于学习路径、记录入口左侧。章节在正文右侧放本章导航和学习笔记。阅读器让文件树与代码并排，选区关联章节和对象摘要置于代码下方。

| 视口宽度 | 布局变化 |
| --- | --- |
| ≤ 1150px | 主导航缩至 188px，项目区与学习路径仍并排。 |
| ≤ 960px | 主导航缩至 165px，辅助内容移至项目下方。章节目录在正文前折叠。 |
| ≤ 700px | 主导航改由顶栏按钮展开。文件目录折叠在代码上方。 |
| ≤ 480px | Pi 面板转为单栏，文件和函数名移到课程入口下方，进度仍在面板底部。 |

## Elevation & Depth

纸面之间用浅色边线和留白分隔。阅读器用不同底色区分文件树和代码。学习记录的当前标签以蓝色内侧底线标出。

## Shapes

课程纸面、项目列表和源码阅读器共用较大的圆角。按钮与输入框圆角较小，函数引用采用更紧凑的标签。源码保留方整的逐行选区。

## Components

- **项目入口**随本机记录显示“导入 Pi 源码”“进入课程”或“继续学习”。面板内可预览调用顺序，其余项目以行列出名称、主题、“待开放”和阶段。
- **章节证据**在论断旁显示“函数名 · 行区间”。点击进入只读源码，编辑器页脚显示当前选区。用“返回章节”回到“源码阅读”中对应的引用行并恢复键盘焦点。
- **版本与目录**先显示八位短 SHA，展开后可复制完整提交。窄屏目录按钮报告展开状态，在展开目录中按 Escape 可关闭并把焦点送回按钮。
- **读取反馈**同时给出图标和中文说明。无法展示文件正文时显示原因与对象标识，固定版本缺失时提供重新导入入口。系统开启“减少动态效果”时，加载提示保留文字并停止旋转。

## Do's and Don'ts

### Do

- 在源码阅读列表并列显示函数名、原路径和含首尾的行区间。
- 长路径和完整 SHA 可以换行，保留可选择和复制的原文。

### Don't

- 避免只用颜色表示课程状态、作答结果或证据范围。
- 避免给待开放课程填写尚无依据的完成百分比。
