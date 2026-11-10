# Germina（发芽）

> 仓库：https://github.com/HeyHuazi/DSH-Germina · MIT License

**Where ideas grow.**  
**让想法，自由生长。**

一个让你与 AI 一起探索灵感、组织素材、培育想法、打磨作品的创作空间。

Germina 是基于 DeepSeek Harness（DSH）的 AI 创作工作空间插件。

## 当前实现（2026-11-10）

文件编辑工作台 + 创作语义层：目录树、多标签编辑、Markdown/JSON/HTML 预览、按目录绑定的独立 AI 会话、文档与选区引用、**停笔自动保存**、**版本快照与恢复**（恢复前自动备份）、**Markdown/HTML 导出**、**Space 清单**（germina.space.json：名称/简介/目标/项目背景）、**文档状态**（草稿/进行中/已完成）、**衍生创作与来源关系**、**素材登记与四项研究快捷操作**（注入 Space 背景+素材清单到聊天草稿，发送由用户确认）。

仍未实现：AI 发送通道的编程化调用（聊天发送由用户在会话内确认，见 docs/DSH-INTEGRATION.md 验证边界）、PDF/网页正文解析、Tiptap 富文本（已裁决不做）、版本 diff 比较（P1）。当前版本覆盖 PRD V0.1 P0 的大部分非 AI 通道能力。

首次打开默认显示内置只读「欢迎.md」，介绍工具与双语 Slogan。未选择目录时不读取 DSH 工作目录，也不创建会话。切换目录后恢复对应会话；会话绑定会保存到本地。

## 文档

- [产品需求文档 V0.1](docs/PRD.md)：2026-11-09 产品规划稿 / 待技术验证，保留需求原文全部 19 章。
- [插件安装、使用与迁移](germina/README.md)。
- [项目架构规范](CLAUDE.md)。

PRD 的 Tiptap 与 SQLite 等技术选型属于待验证建议。Host 继续使用 Node.js ESM；coss/ui 的 JSX 与 Tailwind v4 在开发期编译为 vendor 产物，插件运行时无需 npm 依赖。

## 验证

从仓库根目录运行：

```bash
npm ci
node scripts/build-client.mjs
node --test test/*.test.mjs
node --check germina/index.js
node --check germina/api.js
node --check germina/client.js
node --check germina/client-workspace.js
node --check germina/workspace-state.js
node --check scripts/vendor-lucide.mjs
```
