# Germina（发芽）

> 仓库：https://github.com/HeyHuazi/DSH-Germina · MIT License

**Where ideas grow.**  
**让想法，自由生长。**

一个让你与 AI 一起探索灵感、组织素材、培育想法、打磨作品的创作空间。

Germina 是基于 DeepSeek Harness（DSH）的 AI 创作工作空间插件。

## 当前实现

现有文件编辑工作台是产品的实现基础：目录树、多标签文本编辑、Markdown / JSON / HTML 预览、按文件夹绑定的独立 AI 会话，以及文档和选区引用。文件采用手动保存，引用动作只插入聊天草稿，不自动发送。

Space、素材库、资料检索、富文本编辑、AI 修改建议、自动保存、版本快照和作品衍生均为规划能力，尚未实现。当前版本不代表 PRD V0.1 已交付。

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
