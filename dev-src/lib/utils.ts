/*
 * [INPUT]: 依赖 clsx 的条件类名合并与 tailwind-merge 的 Tailwind 类冲突归并
 * [OUTPUT]: 导出 cn 函数，供 coss 组件组合 className
 * [POS]: dev-src/lib 的唯一类名边界；组件只调用此函数，不重复拼接逻辑
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
