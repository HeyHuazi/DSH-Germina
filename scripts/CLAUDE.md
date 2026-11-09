# scripts/

> L2 | 父级: ../CLAUDE.md

开发期维护脚本；不参与插件运行。

成员清单
- vendor-lucide.mjs: 固定 Lucide 版本同步脚本；写入图标、许可与客户端内联区。
- build-client.mjs: coss UI 构建脚本；esbuild 自动 JSX、仅外部化宿主 React，内置官方 JSX runtime 并匹配宿主 React 18 开发/生产模式；内置 Base UI 所需 ReactDOM；Tailwind v4 限域 CSS，从 bundle 输入汇总依赖许可；`--watch` 并行监听 JS/CSS。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
