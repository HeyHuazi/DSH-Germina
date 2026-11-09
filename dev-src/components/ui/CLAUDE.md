# ui/

> L2 | 父级: ../CLAUDE.md

成员清单
- button.tsx: coss Button；forwardRef 将 React 18 引用交给 Base UI useRender，Spinner 呈现加载状态。
- tabs.tsx: coss Tabs；Base UI 提供选择状态，SegmentedControl 绘制标签列表。
- dialog.tsx: coss Dialog；Base UI 管理焦点与 Portal，ScrollArea 限制内容滚动。
- spinner.tsx: coss Spinner；提供 Button 的加载指示。
- scroll-area.tsx: coss ScrollArea；为 DialogPanel 提供可滚动内容。
- segmented-control.tsx: coss SegmentedControl；为 TabsList 与工作区视图切换器提供布局与选择标识。
- alert.tsx: coss Alert；cva 五档语义变体，工作区错误横幅使用，无额外运行时依赖。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
