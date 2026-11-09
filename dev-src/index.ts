/**
 * [INPUT]: 依赖 components/ui 的 coss 组件（Button/SegmentedControl/Alert/Tabs/Dialog）与官方 JSX runtime
 * [OUTPUT]: vendor/client-ui.js 的 IIFE 导出变量 __germinaUI
 * [POS]: dev-src 打包入口；client.js 同源获取源码，注入宿主 React 后求值
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export { Button, buttonVariants } from "./components/ui/button"
export {
  SegmentedControl, SegmentedControlItem,
} from "./components/ui/segmented-control"
export {
  Alert, AlertTitle, AlertDescription, AlertAction,
} from "./components/ui/alert"
export { Tabs, TabsList, TabsTab, TabsPanel } from "./components/ui/tabs"
export {
  Dialog, DialogTrigger, DialogPopup, DialogHeader, DialogTitle,
  DialogDescription, DialogPanel, DialogFooter, DialogClose,
} from "./components/ui/dialog"
