# Germina 优化路线图

- **日期**：2026-11-10
- **基线**：GitHub `HeyHuazi/DSH-Germina` v1.3.0（commit d2b62ad）
- **原则**：文件系统即真相；每步独立可交付、可回滚；遵守三层架构与安全栅栏既有约定

---

## 第一层：工程地基（半天内完成，全部零风险）

### 1.1 ✅ 已完成（随本次上传）
- git 仓库初始化 + GitHub 公开仓（MIT license、7 个 topic）
- package.json：test/build:client/verify 三个 script 修复，版本号对齐 1.3.0
- .gitignore：运行时状态文件（用户路径与会话绑定）不入库

### 1.2 CI（GitHub Actions）
`.github/workflows/ci.yml`：push/PR 时跑 `npm ci → node --test → node --check 五文件 → build:client`。
价值：vendor 产物一旦与 dev-src 脱节，CI 立刻发现（现在只有本机能查）。

### 1.3 发布产物自动化
`npm run package`：产出可分发的 zip（germina/ 目录 + README，排除运行时状态）。
价值：从「源码仓库」变成「可安装插件」，别人拿到即可用。

---

## 第二层：体验补强（每个 1-2 天，按序做）

### 2.1 编辑器体验三件套
现状是纯 `<textarea>`。按投入产出排序：
1. **自动保存（防抖 800ms）+ 未保存离开拦截**——PRD 5.7 的最小切片，不需要版本系统。实现点：`workspace-state.js` 加 `scheduleWrite`，client 端 `beforeunload` 拦截。
2. **状态栏**：显示路径/编码/字节/保存状态（已保存●未保存○）。纯 UI，零风险。
3. **Ctrl+S/Cmd+S 手动保存**——现在只有按钮。

### 2.2 会话体验
- 会话历史在 UI 中可见（现在只显示当前轮）；引用插入草稿的交互加一个「已插入」微反馈。
- 会话导出为 Markdown 落盘到当前目录 `.germina/sessions/`——既是功能也是用户数据自主权（Local First 的兑现）。

### 2.3 Markdown 渲染增强
- 任务列表（- [ ]）、表格已支持性确认；代码块加语言标签与复制按钮。
- WELCOME.md 里的链接逐个点一遍（作者门面，最容易被发现 broken link）。

---

## 第三层：架构决断（写下来，不再摇摆）

### 3.1 Space = 目录 + germina.space.json（裁决记录）

PRD 的 F01 Space 体系按以下方式落地，**不引入数据库**：

```
用户选的目录/
  germina.space.json     ← Space 清单：名称/简介/目标/标签/背景约束(Context)/创建时间
  .germina/
    materials.json       ← 素材登记（相对路径 + 元数据）
    notes/               ← 笔记（.md 文件）
    sessions/            ← 会话导出
  <用户自己的作品文件>     ← Works 就是普通文件，编辑器直接编辑
```

裁决理由（写入 PRD 附录）：
1. Local First 原则要求真相留在用户可见的文件系统里；SQLite 把真相藏进二进制文件，违背第 3.5 节。
2. Space 的本质是「目录 + 语义」——现有 `workspace-state.js` 的目录绑定机制 80% 可复用，germina.space.json 只是把语义补齐。
3. 删除 Space = 删除目录（现有确认门闸直接复用）；迁移 Space = 拷目录。零特殊情况。
4. Context（项目背景）= `germina.space.json` 的一个字段，AI 会话创建时自动注入 system prompt——PRD 的 F01-03 顺带完成。

### 3.2 富文本：不做 Tiptap（裁决）

保持 Markdown 纯文本编辑。理由：
1. Tiptap + 协同运维的复杂度对一个单用户本地工具是过度设计（YAGNI）。
2. Markdown 预览已够用；导出走 marked→HTML 管线。
3. 若未来真需要所见即所得，再评估 Milkdown（基于 prosemirror，比 Tiptap 轻）。

### 3.3 素材收集最小版（F02 切片）
不做网页剪藏（浏览器扩展是另一个产品）。做「拖文件进 Space 目录 = 自动登记」：File System Access API 已在用，监听目录新增文件 + 生成 materials.json 条目即可。

---

## 里程碑建议

| 里程碑 | 内容 | 判据 | 状态 |
|---|---|---|---|
| M1 工程化 | CI + package 脚本 | CI 绿；zip 可装 | ✅ 2026-11-10 |
| M2 编辑体验 | 自动保存/状态栏/快捷键 | 停笔 800ms 落盘；失败不清草稿 | ✅ 2026-11-10 |
| M3 Space MVP | germina.space.json + 编辑对话框 | 75 测试全绿；清单落用户目录 | ✅ 2026-11-10（Context→AI 注入待接线） |
| M4 素材登记 | 拖文件自动登记 | materials.json 与目录一致 | 待做 |

---

## 风险与红线

1. **vendor 产物与 dev-src 脱节**是最大工程风险——CI 必须含「build 后 git diff --exit-code vendor/」检查。
2. 所有新功能不得突破 `resolveWithinRoot` 围栏；会话导出写入目录内。
3. 公开仓库后：README 里若有内网地址/真实人名需复查（已查：无）。
