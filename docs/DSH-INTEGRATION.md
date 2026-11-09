# DSH 集成记录：目录会话与欢迎文档

核对日期：2026-11-09。目标宿主：DSH 0.2.2-rc.1。
本记录描述当前实现，不修改 [PRD 原文](PRD.md)。

## 已核对的接口

核对来源为本机 DeepSeek Harness 安装包源码：

- `@deepseek-ai/dsh-api-session-controller/lib/types/client/sessions/service.js`：`sessions.create({ cwd })` 返回会话 ID，并在返回前发布目录元数据。不提供 sessionId 时创建新身份，不复用宿主当前空白聊天。
- 同包 `manager.js`：创建请求将 cwd 传给 Host。`sessions.refresh()` 刷新会话目录；客户端要求快照 phase 为 ready 后再决定是否新建。
- `sessions.list.getSnapshot().byId`：目录行包含 id、cwd、parentId。Germina 只恢复自身绑定且 cwd 完全匹配的普通会话。
- `sessions.retain(id, { source: 'germina' })`：返回视图引用。等待 ready 后交给 SessionProvider，卸载时 release。
- `@deepseek-ai/dsh-client-ui-workspace/lib/client.js`：宿主也使用 sessions.create 后返回身份；视图选择是独立操作，Germina 不调用该选择操作。

旧版按 retainedBy.mainView 推导当前会话。1.3.0 移除该推导，也移除全局会话下拉框。

## 数据流

1. Client 请求 workspace，取得目录、绑定 ID 和欢迎 Markdown。
2. 无有效目录时展示只读欢迎文档，不读取宿主工作目录，不创建会话。
3. 选择目录后，Host 校验并保存根目录。
4. Client 刷新 DSH 会话目录，验证已绑定身份。
5. 无绑定或原会话已删除时，创建指定 cwd 的新会话。
6. Client 将绑定提交 Host；持久化成功后才 retain 并显示聊天。
7. 切换目录后按目录 key 重挂编辑器，并释放旧聊天视图引用。

文件请求携带 `_workspaceRoot`。Host 串行执行请求，当前目录与请求不匹配时返回 409，不把旧草稿写到新目录。

## 本地状态

- germina-root.json 保存用户选定目录；旧根状态只读兼容。
- germina-sessions.json 保存 version 1 的绝对路径→会话 ID 绑定。
- 状态先写 tmp，再 rename；失败不返回成功。
- 绑定损坏时保留原文件，显示错误，不自动重置。
- 欢迎文档来自包内 WELCOME.md，不创建用户目录中的示例文件。

这些状态保存在插件包目录，而不是 Profile 数据库。多个 Profile 共用同一包路径时，也共用这些状态。当前不保证 Profile 间隔离。不同浏览器窗口并发创建时，Host 的旧值比较防止覆盖已有绑定，但仍可能产生未被绑定的空白会话；不会删除这些宿主会话。

## 浏览器模块边界

client.js 保留 Markdown 安全渲染器和图标。client-workspace.js 提供工作区组件，由浏览器原生 ESM 惰性加载。coss 组件从固定同源路由加载预编译 JS/CSS；JS 复用宿主 React，Base UI 所需的 ReactDOM 由产物携带。JSX 使用自动运行时，避免 coss registry 中仅作类型导入的 React 被当作全局变量。

产物携带官方 JSX runtime，不由 Client 模拟。构建脚本保留开发版与生产版，按宿主 React 18 元素的 `_store` 选择。此约定绑定 React 18.3.1；升级 React 时必须复核。开发版 runtime 保留静态子元素验证，避免与开发版宿主混用时误报 key。Button 使用 forwardRef，将 DOM 引用交给 Base UI useRender。

Host 只为固定模块和资产注册 `${route}/workspace.js`、`${route}/client-ui.js`、`${route}/client-ui.css`。仅允许 GET，返回对应 MIME。路由不接收用户路径。自定义 API 路由时，资产路由自动跟随；Client 的 API_ROUTE 仍须与 Host 配置一致。CSS 选择器限定于 `.germina-root`。

升级需重载 Host 并刷新 Web GUI。2026-11-09 当前桌面 Host 进程中，`/workspace.js` 返回 200，`/client-ui.js` 和 `/client-ui.css` 返回 404；Profile 已链接本项目目录，但 Host 尚未重载新装配。

## 验证结果

- 69 项 node:test 全部通过；覆盖 React 18.3.1 的 Button/Tabs 服务端渲染、Button ref 契约、JSX runtime 模式与静态子元素验证。生产模式下 4 项 UI 测试通过。
- Host、状态模块、文件 API、客户端入口、工作区模块与维护脚本语法检查通过。
- 在临时插件副本中执行 Host 测试，不修改用户状态。
- 使用宿主同版本 React 18.3.1，真实浏览器渲染欢迎 Markdown；确认只读与初始不创建会话。
- 模拟 DSH sessions 服务验证 A→B→A：只创建两段会话，返回 A 恢复原身份。
- 浏览器验证聊天栏折叠释放引用，展开重新 retain 原身份；控制台无 error。

- 独立 coss 浏览器页使用开发版 React 18.3.1，验证按钮状态、Tabs 切换、Dialog 打开与关闭后焦点恢复；本轮捕获无 key/ref 告警或运行异常。
- 原生按钮与 render 链接均收到 DOM ref；Dialog Portal 位于 `.germina-root`，宿主模拟元素样式不变。生产版 React 页面验证 ref、Dialog、Portal 与初始焦点，同样无运行异常。
- 浏览器控制工具的 Escape 按键未关闭 Dialog；向聚焦元素派发 Escape DOM 事件可关闭并恢复触发器焦点。真实宿主键盘路径仍待实机验证。

## 尚未验证与权限边界

实际 DSH 插件重载、coss 深浅主题目视检查、原生会话创建、模型流式回复及引用发送尚未完成实机验证。当前桌面宿主仍运行旧路由；测试没有发送消息，没有调用模型，也没有修改外部 Profile。

目录会话绑定只隔离聊天身份与文件 API 请求，不构成 AI 工具的文件系统沙箱。模型、Agent 默认预设、工具审批与访问权限由宿主控制。释放视图引用不删除历史，也不主动取消后台任务。
