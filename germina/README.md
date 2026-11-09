# Germina（发芽）

**Where ideas grow. / 让想法，自由生长。**

[产品 PRD V0.1](../docs/PRD.md) 为规划稿。当前工作台仅为实现基础；Space、素材库、自动保存、版本与 AI 修改建议尚未实现。

DeepSeek Harness 插件：在 Web GUI 左侧栏添加「Germina」入口，提供文件、编辑、AI 聊天三栏内容编辑策划中心。轻边框和独立滚动区域适配宿主深浅主题，文件区与聊天区可收起。

## 1.3.0：目录专属会话与欢迎文档

- 默认打开内置只读「欢迎.md」，包含产品介绍、双语 Slogan 与使用引导。示例不写入用户目录；关闭后可从左侧再次打开。
- 没有有效持久化目录或显式配置时，显示欢迎工作区。默认 `root: '.'` 不再暴露 DSH 进程工作目录。
- 选择文件夹后，通过 DSH `sessions.create({ cwd })` 创建独立会话。切换回原目录时恢复保存的会话，不读取全局 `mainView` 选择，也不提供任意全局会话下拉框。
- 绑定以规范化绝对路径为键，保存到包目录 `germina-sessions.json`。重启后恢复；目录移动视为新目录。绑定损坏时显示错误，不覆盖旧数据。
- 绑定会话已删除时创建替代会话；绑定指向不同 cwd 时停止并提示错误，不展示其他目录历史。
- 切根前保留脏标签确认。切根后重挂编辑状态并释放旧会话视图引用；旧会话历史不删除，正在运行的宿主任务不因释放视图而自动取消。
- 文件请求携带目录身份；Host 拒绝过期请求，避免异步保存落到新目录。

目录会话隔离不等于文件系统沙箱。模型、Agent 默认预设、工具与权限继续由 DSH 提供。详细边界见 [DSH 集成记录](../docs/DSH-INTEGRATION.md)。

## 三栏工作区

- **左侧文件**：目录树、搜索、新建、刷新，以及底部的「打开文件夹」。
- **中间编辑**：默认单栏编辑，支持多标签、编辑 / 分栏 / 预览切换和保存状态；Markdown 预览使用正文阅读排版。
- **右侧 AI 策划助手**：嵌入宿主 `conversation.content` 原生会话，沿用现有会话的模型、回复、工具审批和输入框。每个已选文件夹绑定一段独立会话。首次使用自动创建；返回该文件夹恢复原会话。未选目录不创建会话。
- **引用文档或选中文字**：打开文件后可把当前草稿或编辑器中的选中文字插入聊天草稿，再补充需求并发送。引用包括相对路径和实际草稿内容，含未保存的修改；引用动作不会发送消息。

右栏由插件持有独立 `SessionReference`，在切换会话、关闭聊天区或卸载工作区时释放。聊天记录与草稿继续由宿主原生会话维护。

## 设计参考与图标

v1.2 的文件行密度、轻量工具栏和阅读排版参考了 Craft Agents 的实际开源文件，界面代码独立实现：

- [SessionFilesSection.tsx](https://github.com/craft-ai-agents/craft-agents-oss/blob/main/apps/electron/src/renderer/components/right-sidebar/SessionFilesSection.tsx)：文件树的图标尺寸、缩进和文件名截断。
- [tiptap-editor.css](https://github.com/craft-ai-agents/craft-agents-oss/blob/main/packages/ui/src/components/markdown/tiptap-editor.css)：正文层级、代码样式与紧凑控件。
- [ContentFrame.tsx](https://github.com/craft-ai-agents/craft-agents-oss/blob/main/packages/ui/src/components/overlay/ContentFrame.tsx)：阅读宽度与面板边界。

图标使用 [Lucide 0.468.0](https://github.com/lucide-icons/lucide/tree/0.468.0) 本地子集（30 个 SVG 图标，ISC）。几何数据保存在 `vendor/lucide-icons.json` 并内联至客户端；React 直接渲染，不使用 CDN，不运行全局 `createIcons()` DOM 扫描，也不加载额外 React。完整许可保留在 `vendor/lucide.LICENSE` 并纳入包发布清单。

维护图标时运行 `node scripts/vendor-lucide.mjs` 可从固定上游 tag 重新获取子集并同步内联区。插件管理器的三栏工作区图标为本项目原创。

## 功能

- **打开文件夹**：工具栏「打开文件夹」按钮调起宿主原生目录选择器（`uiWorkspace.pickDirectory`），切换工作根目录并持久化（下次启动自动恢复）。
- **文件树侧栏**：递归目录树（可折叠），顶部搜索框实时过滤文件名；跳过 `node_modules`/`.git`/`dist` 等目录。
- **多标签编辑**：最多 10 个标签页，未保存改动以圆点标记，⌘S 保存。
- **三视图模式**（编辑 / 分栏 / 预览，可拖动分栏线）：
  - **Markdown**（.md/.markdown/.mdx）：marked 实时渲染预览（GFM、表格、代码块），样式对齐宿主主题令牌
  - **JSON**（.json/.jsonc）：一键格式化 + 可折叠树视图预览
  - **HTML/SVG**：源码 + 沙箱 iframe 渲染预览
  - 其余文本类型（代码、配置、YAML…约 40 种扩展名）：纯编辑
- **新建文件**（支持相对路径，新建 .md/.json 等自动带上对应预览）、**删除文件**（树行悬停或键盘聚焦时显示垃圾桶图标，工具栏亦可删除，确认后执行）。
- **脏标签保护**：标签满 10 个时只驱逐未修改的标签（全脏则拒绝开新）；关闭有未保存修改的标签、切换根目录前均弹确认。
- **保存后自动刷新目录树**。

## 结构

| 文件 | 角色 |
|---|---|
| `index.js` | Host 装配：API、固定工作区模块与 vendor UI 资源 exact 路由；串行执行工作区请求 |
| `workspace-state.js` | 目录与会话绑定持久化；未选目录阻止文件访问，过期目录请求返回 409 |
| `client-workspace.js` | 同源 ESM 工作区：目录独立会话、只读欢迎页、多标签与引用生命周期 |
| `WELCOME.md` | 内置示例原文；读取后作为虚拟标签展示，不复制到用户目录 |
| `api.js` | 纯逻辑层：`resolveWithinRoot` 路径安全栅栏 + `list`/`tree`/`read`/`write`/`delete`/`setRoot`；`kindOf` 按扩展名分类 |
| `client.js` | 浏览器入口：惰性加载工作区模块与 coss vendor UI，复用宿主 React；`sidebar.panellist` 图标 + `main` 面板 |
| `vendor/client-ui.js` `client-ui.css` | coss Button/Tabs/Dialog 开发期编译产物；Host 同源提供，CSS 限域在 `.germina-root` |
| `vendor/client-ui.LICENSES.md` | coss 与 Base UI 等组件依赖许可汇总 |
| `vendor/marked.min.js` | [marked](https://github.com/markedjs/marked) v12.0.2（MIT），许可文件同目录 |
| `locale/zh.json` `locale/en.json` | 插件管理器标题/描述；面板文案在 client.js 内经 `ctx.locale.register` 注册 |
| `cordis.patch.yml` | Loader 行（id `germina`）与默认 config |

## 配置（profile 的 cordis.patch.yml 覆盖示例）

```yaml
- id: germina
  name: germina
  config:
    root: /Users/you/Documents/notes   # 初始根目录（UI 里「打开文件夹」可随时切换并持久化）
    maxFileBytes: 1048576              # 单文件读写上限（字节，默认 1MB）
    route: /plugins/germina/api       # Host HTTP 路由（一般不改）
```

## 安全

- 所有路径先经 `resolveWithinRoot`：拒绝绝对路径、`..` 逃逸、非字符串；只允许 root 内相对路径（live 已验证 `../../etc/passwd` → 拒绝）。write/delete 到根自身（`path: '.'`）返回 400，杜绝一条请求清空整个 vault。
- **MD 预览 XSS 加固**：marked 渲染器覆写——原始 HTML token 全部转义显示，链接/图片仅放行 `http(s)`/`mailto`/`data:image`/锚点/相对路径，`javascript:` 等协议降级为纯文本；外部链接 `target=_blank rel=noopener`。
- 二进制文件（前 8KB 含 NUL 或扩展名不在白名单）拒绝读取（415）。
- HTML 预览在无权限 `sandbox` iframe 中渲染，不执行脚本。
- delete 目标不存在返回 404（不告警炸 500）；超过 `maxFileBytes` 的读/写返回 413；tree 扫描条目上限 4000。

## 测试

```bash
node --test test/germina.test.mjs   # 31 个用例：路径栅栏 + list/tree/read/write/delete/setRoot + 根护栏/深度限制
```

## 历史验证（更名前的 1.2.1 视图切换修复）

以下为旧版记录，不代表 Germina 更名后的 DSH 实机验证。

- 修复编辑器与预览组件使用同一 key 导致的 React 协调风险；源文本与预览使用不同的固定容器，切换视图时保留编辑框挂载。
- 分栏使用 CSS Grid 明确分配两侧宽度，单视图占满编辑区；HTML/SVG 预览具有独立的高度约束。
- 不支持预览的文件始终保持可编辑，不会继承前一文件的预览模式而显示空白。

- `node --check germina/client.js` 与 Host 入口语法检查通过。
- `node --test test/*.test.mjs`：38/38 通过，包括文档引用、连续视图切换、跨文件类型回退和分栏比例边界。
- 30 个 Lucide 图标的 vendored 数据与内联副本完全一致；所有静态图标名均能解析，许可与 JSON 均在发布清单中，中英文新文案齐全。
- 当时 profile 安装结果 `application: applied`，无警告；Host 文件列表 API 返回成功；Client `markflow.assistant` 插槽已注册并激活。
- 浏览器自动化服务无法读取标签页（503 / context canceled），尚未完成截图、深浅主题目视检查或实际点击发送验证。

## 历史验证（更名前 live）

- Host 路由：`tree` 返回嵌套条目；`setRoot` 切换到工作区并持久化（`markflow-root.json`）；切换后 `read` 正常；`kind` 分类正确。
- 24/24 单测通过；client.js 语法检查 + marked 内联 round-trip 解析验证通过。
- v1.1：31/31 单测通过；安全管线冒烟验证（XSS 载荷全转义/降级，GFM 表格与正常链接不受影响）。
- 浏览器面板：刷新 Web GUI 后从左侧栏「MarkFlow」进入。

## 后续可拓展方向

- 代码高亮（vendor highlight.js 到预览代码块）
- 文件重命名/移动、拖拽上传图片到 MD
- YAML/TOML 校验预览

## coss UI 开发与打包

在仓库根目录运行 `npm ci`，编辑 `dev-src/` 的 JSX 与 Tailwind v4 源码，然后执行 `node scripts/build-client.mjs`。开发时用 `node scripts/build-client.mjs --watch` 同时重建 JS 和 CSS。安装或打包前先构建，再运行 `node --test test/*.test.mjs`；插件发布清单包含 `vendor/client-ui.js`、`client-ui.css` 和许可文件。运行时由 Host 的固定同源路由加载产物，共用 DSH React，不从 npm/CDN 加载组件。当前工作区的保存按钮已使用 coss Button；Tabs/Dialog 保留为可复用组件和开发期示例。

## 安装与 MarkFlow 迁移

1. 在目标 DSH Profile 的插件包配置中，将旧 `markflow/` 本地包路径改为本仓库的 `germina/` 绝对路径。不同 DSH 版本的安装入口以宿主为准。
2. 将 Profile 的 Loader `id` 与 `name` 从 `markflow` 改为 `germina`。禁用旧 Loader，避免重复加载。包内 `cordis.patch.yml` 提供新标识的配置模板。
3. 默认 Host 与 Client 路由均为 `/plugins/germina/api`。旧默认路由 `/plugins/markflow/api` 不再注册。自定义路由必须同时更新 Host 的 `config.route` 与 `client.js` 的 `API_ROUTE`；仅改 Profile 不会同步客户端。
4. 重载插件并刷新 Web GUI，从「Germina」进入。内部面板 key、会话来源与子插槽改为 `germina` / `germina.assistant`，宿主会话记录仍由 DSH 保存。
5. 升级到 1.3.0 后，重载插件 Host 并刷新页面；Host 必须能提供默认 `/plugins/germina/api/workspace.js`（自定义 API 路由时一并跟随）。仅热更客户端不够。
6. 保留包目录中的 `markflow-root.json`。新 `germina-root.json` 不存在时，插件兼容读取旧文件。仅恢复存在且为目录的 root；新文件存在但损坏、或保存目录已失效时，回退到 Profile 显式指定的有效 `config.root`，不再尝试旧文件。默认 `.` 则进入欢迎工作区。
7. 用户通过「打开文件夹」确认有效目录后，`setRoot` 只写 `germina-root.json`，不删除或改写旧文件。升级时保留状态文件；它们不包含在包发布清单内。

本仓库保留的旧状态指向 `/Users/huazi/Code/Developer/DSH/DSH-MarkFlow`。更名不改写该用户路径，也不替用户选择新目录。若旧路径已失效，请显式配置 root 或在 UI 选择目录。

本次不修改外部 DSH Profile 或远程仓库，也不执行宿主重载。

## 当前验证（1.3.0）

- `node --test test/*.test.mjs`：69/69 通过。覆盖文件 API、目录会话绑定、coss 构建产物、React 18 ref/JSX runtime 契约与固定 JS/CSS 路由。生产模式 UI 测试 4/4 通过。
- Host、状态模块、API、Client、工作区模块与图标维护脚本的 `node --check` 均通过。
- Host 回归在临时包中运行，不读写真实用户状态。
- 旧版隔离浏览器使用 DSH 同版本 React 18.3.1 验证欢迎页与目录会话；coss 接入后的实际宿主渲染仍需在 DSH 环境验证。
- 独立 coss 浏览器页验证按钮、Tabs、Dialog、DOM ref 与焦点恢复；开发版和生产版 React 下无本轮 key/ref 告警。实际宿主键盘与主题仍待验证，见 [集成记录](../docs/DSH-INTEGRATION.md)。
- DSH 0.2.2-rc.1 的会话创建、列表刷新和引用接口已从安装包源码核对；实际宿主重载、原生会话创建及聊天发送尚待用户环境验证。
- client.js 与 client-workspace.js 均低于 800 行。Host 使用 Node.js ESM；coss 组件在开发期编译为 vendor 产物。
- PRD 保留原文，不将目录会话绑定宣称为完整 Space 能力。

## 改名记录

早期 `dsh-file-vault` → `markflow`（MarkFlow）。2026-11-09：`markflow` → `germina`（Germina / 发芽）。旧名称仅用于历史记录、状态兼容与迁移说明。
