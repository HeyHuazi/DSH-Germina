# germina/

> L2 | 父级: ../CLAUDE.md

Germina（发芽）提供文件、编辑与 AI 三栏工作台。
当前为 1.3.0，Host 使用 Node.js ESM；coss 浏览器组件在开发期构建，运行时只读 vendor 产物。
目录会话不是 PRD 中完整的 Space 实体。

成员清单
- index.js: Host 装配；注册 API、`/workspace.js` 与 `/client-ui.js|css` 固定路由。串行执行请求，避免切根与旧写入交叉。
- workspace-state.js: 持久化边界；读取目录、旧状态与会话绑定。提供 workspace/setRoot/bindSession，文件操作委托 api.js。无选定目录则拒绝文件访问。目录身份不符返回 409。
- api.js: 文件语义；提供 resolveWithinRoot 与 handleApi。覆盖 list/tree/read/write/delete/setRoot。拒绝绝对路径、路径逃逸与根自身写入或删除。二进制返回 415，超限返回 413。
- client.js: 浏览器入口；加载同源 UI bundle/CSS 与工作区模块，仅注入宿主 React 求值 coss 组件，不模拟 JSX runtime。Markdown 转义原始 HTML，限制链接与图片协议；HTML 预览使用无权限 sandbox。
- client-workspace.js: 工作区 UI；保存按钮用 coss Button，编辑视图切换（edit/split/preview）用 coss SegmentedControl，错误横幅用 coss Alert（error 变体），按目录重挂多标签编辑器。每目录创建或恢复专属会话，保存绑定后再 retain。切根、折叠或卸载时释放视图引用。不读取全局 mainView 会话。不自动发送文档。
- WELCOME.md: 内置介绍与双语 Slogan；客户端作为只读虚拟标签展示，不写入用户目录。
- cordis.patch.yml: Loader 标识与默认配置；root 的点路径表示尚未选择目录。
- package.json: ESM 包、DSH 导出与发布清单；包含工作区模块、欢迎文档与 UI vendor 产物，不包含运行时状态。
- README.md: 安装、使用、升级步骤与验证边界。
- icon.svg: 插件管理器原创三栏图标。
- locale/zh.json: 插件管理器中文元数据；工作台文案由 client.js 注册。
- locale/en.json: 插件管理器英文元数据；与中文键保持一致。
- vendor/marked.min.js: marked v12.0.2 源码，内联至 client.js。
- vendor/marked.LICENSE.md: marked 的 MIT 许可。
- vendor/lucide-icons.json: Lucide 0.468.0 的 30 个静态图标；维护脚本同步客户端内联副本。
- vendor/client-ui.js: coss/Base UI 编译产物（IIFE，自动 JSX；仅外部化 react，内置随宿主 React 18 选择开发/生产模式的官方 JSX runtime 与 ReactDOM）；由 scripts/build-client.mjs 从 dev-src/ 构建。
- vendor/client-ui.css: Tailwind v4 静态样式；构建时将选择器限定在 `.germina-root`。
- vendor/client-ui.LICENSES.md: coss 与 esbuild 实际打包的 Base UI、ReactDOM 等直接/间接依赖许可。
- vendor/lucide.LICENSE: Lucide 的 ISC 许可。

运行时文件（不纳入发布）
- germina-root.json: 用户确认的绝对目录。无效时回退显式配置；默认点路径进入欢迎页。
- markflow-root.json: 旧状态兼容入口；仅在新根状态缺失时读取，保留原始用户路径。
- germina-sessions.json: version 1 的目录→会话 ID 绑定；禁止不同目录共享 ID，损坏时拒绝覆盖。
- germina-root.json.tmp / germina-sessions.json.tmp: 串行写入的暂存文件；rename 成功后提交状态。

会话约定
- sessions.create({ cwd }) 创建新身份；不传旧 sessionId，不切换宿主主视图。
- 绑定会话存在且 cwd 匹配时恢复。会话删除后允许创建替代身份。
- 相同目录的并发 UI 挂载共用一次创建流程；写绑定失败后复用已创建身份重试。
- 绑定按规范化绝对路径识别。目录移动视为新目录，不迁移旧对话。
- 目录绑定不是工具权限沙箱；模型、Agent 预设与授权由 DSH 控制。
- 多个 DSH Profile 共享同一插件目录时，也共享包内状态；当前不提供 Profile 隔离存储。

测试：`node --test test/*.test.mjs`。
接口核对与验证边界见 [DSH 集成记录](../docs/DSH-INTEGRATION.md)。
产品目标见 [PRD V0.1](../docs/PRD.md)，不得将规划当作已实现能力。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
