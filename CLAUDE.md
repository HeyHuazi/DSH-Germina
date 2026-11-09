# Germina（发芽）- 基于 DSH 的 AI 创作工作空间插件

Node.js（Host ESM）+ DSH 宿主扩展点（Host `apply(ctx, config)` / Web client `window.__ModuleLoader__`）+ coss/ui（开发期 esbuild/Tailwind v4 编译）

<directory>
.agents/ - 官方 coss 与 coss-particles 开发技能；使用前读对应 SKILL.md
germina/ - Germina 内容编辑策划中心：文件选择 + 多标签编辑预览 + 原生 AI 聊天与文档引用（Host/Client/纯逻辑三层，见其目录内 CLAUDE.md）
dev-src/ - 浏览器 UI 开发时源码：coss/ui copy-paste 组件（Base UI + JSX + Tailwind v4），经 scripts/build-client.mjs 编译入 germina/vendor/
docs/ - 产品需求原文与规划边界（PRD V0.1，待技术验证）
test/ - node:test 冒烟测试（每个插件一套，`node --test test/*.test.mjs`）
scripts/ - 维护脚本：vendor-lucide.mjs 从固定上游版本同步本地图标子集及许可；build-client.mjs 将 dev-src 编译为 vendor 产物（开发期工具，插件运行时零依赖）
</directory>
<config>
README.md - 品牌入口、实现边界与安装导航
package.json / package-lock.json - coss/Base UI、esbuild 与 Tailwind 的开发依赖及锁定版本
docs/PRD.md - 原始产品规划稿，19 章，2026-11-09
无根级配置；各插件配置经 profile 的 cordis.patch.yml 覆盖（示例见各插件 README）
</config>

## 插件共性约定

- 三层结构：`index.js`（Host 装配）→ `workspace-state.js` / `api.js`（状态与文件语义，node:test 覆盖）→ `client.js` / `client-workspace.js`（运行时 React.createElement）与 `dev-src/`（开发期 JSX）。
- Host 暴露 exact HTTP API 与固定 `/workspace.js`、`/client-ui.js|css` 资源路由；Client 同源加载并复用宿主 React。所有文件路径必须过 `resolveWithinRoot` 栅栏。
- 第三方库 vendor 进包内并同目录带 LICENSE；client 侧以源码内联 + `new Function` 惰性求值。
- 文案一律走 `ctx.locale.register`（zh/en 双语）。

[PROTOCOL]: 变更时更新此头部，然后检查各模块 CLAUDE.md

## 实现与规划边界

- 当前交付是文件编辑工作台，不是 PRD V0.1 完整产品。
- [PRD](docs/PRD.md) 中的 Space、素材库、版本与自动保存尚未实现。
- PRD 的 TypeScript / Tailwind / Tiptap / SQLite 为待验证建议。
- Host 保持 ESM 无构建；浏览器 coss 组件在开发期编译。三层架构与文件安全约定继续有效。
- 根状态缺失时兼容旧状态；无有效状态则使用显式目录配置。
- 默认点路径进入欢迎工作区，不读取宿主进程工作目录。
- 目录会话按绝对路径持久绑定，不借用宿主全局会话。
- 欢迎 Markdown 为只读虚拟文档，不写入用户目录。
- 工作区 UI 通过固定 `/workspace.js` 加载；coss Button 由同源 vendor 包提供，CSS 限定于 `.germina-root`。
- 更名不修改外部 DSH Profile、用户保存路径或远程仓库。
