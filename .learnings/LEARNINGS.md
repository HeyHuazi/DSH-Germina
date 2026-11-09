# Project learnings

## [LRN-20261104-001] embedded conversation contracts

**Priority**: medium
**Status**: resolved
**Area**: tools

### 内容
在 root 级 MarkFlow 面板嵌入宿主会话时，必须声明 session-maybe 子插槽，并用显式 SessionReference 包装 SessionProvider。Provider 不接受 sessionId。引用应在 React effect 中 retain，在切换或卸载时 release。conversation.content 使用 embedded variant 与宿主 phase/hero 状态；保留默认 views 以维护原生聊天草稿。

### 建议修复
接入时先查 Client Inspect；若返回类型不足，查询包的 Config 获取 packageDir，再读取 README 与已安装实现确认契约。inputActions.insertText 必须接收 captureInsertion() 返回的 span，返回 boolean；不能省略 span 或按对象结果判断。

### 元数据
- Source: best_practice

---
