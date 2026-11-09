/**
 * [INPUT]: 依赖 coss registry spinner、Base UI 与本地样式工具
 * [OUTPUT]: 提供 coss spinner 组件及其组合部件
 * [POS]: dev-src/components/ui 的可编辑 vendor 源码；上游 https://coss.com/ui/r/spinner.json
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { Loader2Icon } from "lucide-react";
import type React from "react";
import { cn } from "../../lib/utils";

export function Spinner({
  className,
  ...props
}: React.ComponentProps<typeof Loader2Icon>): React.ReactElement {
  return (
    <Loader2Icon
      aria-label="Loading"
      className={cn("animate-spin", className)}
      role="status"
      {...props}
    />
  );
}
