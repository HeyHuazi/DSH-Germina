# dev-src/

> L2 | 父级: ../CLAUDE.md

浏览器 UI 的开发时源码（coss/ui copy-paste 组件、Base UI、JSX + Tailwind v4）。
`scripts/build-client.mjs` 将源码编译为 `germina/vendor/client-ui.js|css`；宿主按固定路由加载产物。

成员清单
- components/CLAUDE.md: 指向 coss/ui 组件树与上游依赖边界
- components/ui/CLAUDE.md: 逐项记录七个 coss 组件及组合关系
- lib/CLAUDE.md: 记录类名合并工具的职责
- styles/CLAUDE.md: 记录 Tailwind 入口及主题作用域
- index.ts: 打包入口；IIFE 导出 coss 组件表 `__germinaUI`（Button/SegmentedControl/Alert/Tabs/Dialog），client.js 与宿主 React 共同求值
- components/ui/button.tsx: coss Button 与 cva 变体；forwardRef 兼容 React 18，依赖 Base UI useRender、Spinner
- components/ui/tabs.tsx: coss Tabs；依赖 Base UI Tabs、SegmentedControl
- components/ui/dialog.tsx: coss Dialog；依赖 Base UI Dialog、Button、ScrollArea
- components/ui/spinner.tsx: coss Spinner；供 Button 加载状态使用
- components/ui/scroll-area.tsx: coss ScrollArea；供 DialogPanel 使用
- components/ui/segmented-control.tsx: coss SegmentedControl；供 TabsList 与视图模式切换器使用
- components/ui/alert.tsx: coss Alert；error/info/success/warning 变体；workspace 错误横幅使用，无额外运行时依赖
- lib/utils.ts: cn 工具（clsx + tailwind-merge）
- styles/tailwind.css: Tailwind v4 入口与 Germina 根容器内的明暗主题令牌；不引入全局 preflight

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
