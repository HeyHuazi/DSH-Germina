/**
 * [INPUT]: 依赖 client.js 注入 React、coss Button/SegmentedControl/Alert、预览器与 UI 原语；依赖 Host 工作区 API 与 DSH sessions
 * [OUTPUT]: createWorkspaceUI 提供 WorkspaceShell 与 ChatPane；目录绑定不读取全局会话选择
 * [POS]: 浏览器工作区边界；按目录重挂编辑器并释放旧会话引用，欢迎文档不写入用户磁盘
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function createWorkspaceUI(deps) {
    const { React, uiKit: { Button, SegmentedControl, SegmentedControlItem, Alert, AlertTitle, AlertDescription, AlertAction }, requestApi, sessions, Icon, IconButton, PanelIcon, Styles, MdPreview, JsonPreview, HtmlPreview,
      TreeRow, useSplit, kindFor, fileIcon, parentOf, extOf, isSvgExt } = deps
    const h = React.createElement
    const { useState, useEffect, useCallback, useRef } = React
    function documentContext(active, selection) {
      if (!active) return ''
      const content = selection || active.content
      if (!content.trim()) return ''
      return `\n\n[${active.path}${selection ? ' · selection' : ' · draft'}]\n${content}\n\n`
    }

    function editorLayout(kind, requestedMode, requestedRatio) {
      const canPreview = ['markdown', 'json', 'html'].includes(kind)
      const mode = canPreview && ['edit', 'split', 'preview'].includes(requestedMode) ? requestedMode : 'edit'
      const ratio = Number.isFinite(requestedRatio) ? Math.min(0.8, Math.max(0.2, requestedRatio)) : 0.5
      const split = mode === 'split'
      return {
        mode, ratio, split,
        editor: mode !== 'preview',
        preview: mode !== 'edit',
        columns: split ? `minmax(0, ${ratio}fr) 1px minmax(0, ${1 - ratio}fr)` : 'minmax(0, 1fr)',
      }
    }

    // 每个插件实例共用一次创建流程；不从宿主当前选中会话推导绑定。
    function createFolderSessions({ sessions, requestApi }) {
      const inFlight = new Map()
      const unpublished = new Map()
      const checked = async (payload) => {
        const result = await requestApi(payload)
        if (!result.body.ok) throw new Error(result.body.error || `HTTP ${result.status}`)
        return result.body
      }
      const assertFolder = (entry, root) => {
        if (!entry || entry.cwd !== root || entry.parentId) throw new Error('Folder session is missing or belongs to another directory. Retry after checking the host session.')
      }
      const ensure = async (root) => {
        const state = await checked({ op: 'workspace' })
        if (state.root !== root) throw new Error('Folder changed. Reopen the current folder.')
        if (state.sessionError) throw new Error(state.sessionError)
        await sessions.refresh()
        if (sessions.list.getSnapshot().phase !== 'ready') throw new Error('Host session catalog is not ready. Please retry.')
        const saved = state.sessionId && sessions.list.getSnapshot().byId[state.sessionId]
        if (saved) { assertFolder(saved, root); return state.sessionId }
        let id = unpublished.get(root)
        if (!id || !sessions.list.getSnapshot().byId[id]) {
          id = await sessions.create({ cwd: root })
          unpublished.set(root, id)
        }
        assertFolder(sessions.list.getSnapshot().byId[id], root)
        const bound = await checked({ op: 'bindSession', _workspaceRoot: root, sessionId: id, previousSessionId: state.sessionId })
        await sessions.refresh()
        assertFolder(sessions.list.getSnapshot().byId[bound.sessionId], root)
        unpublished.delete(root)
        return bound.sessionId
      }
      return (root) => {
        if (!root) return Promise.reject(new Error('Choose a folder first'))
        if (!inFlight.has(root)) {
          const pending = ensure(root).finally(() => inFlight.delete(root))
          inFlight.set(root, pending)
        }
        return inFlight.get(root)
      }
    }
    const inputActionsBridge = { current: null } // ChatPane 注入 → 工具栏研究模板消费
    const ensureFolderSession = createFolderSessions({ sessions, requestApi })

    /* ---------- F08 导出：前端组装，不依赖宿主 ---------- */
    function mdToHtml(md) {
      const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      return esc(md)
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        .replace(/^---$/gm, '<hr/>')
        .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    }
    function buildExportHtml(name, content) {
      return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>${name.replace(/\.\w+$/, '')}</title>
<style>body{max-width:760px;margin:40px auto;padding:0 20px;font:15px/1.8 -apple-system,"PingFang SC",sans-serif;color:#1e293b}
h1,h2,h3{line-height:1.4;margin:1.6em 0 .6em}blockquote{border-left:3px solid #cbd5e1;margin:0;padding:2px 16px;color:#475569}
code{background:#f1f5f9;padding:1px 5px;border-radius:4px}a{color:#2563eb}</style></head>
<body>${mdToHtml(content)}</body></html>`
    }
    function triggerDownload(name, content, mime) {
      const url = URL.createObjectURL(new Blob([content], { type: mime }))
      const a = h('a', { href: url, download: name })
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    }


    /* Space 编辑对话框：清单写入用户目录的 germina.space.json */
    function SpaceDialog({ space, spaceSaving, onClose, onSave, t }) {
      const [form, setForm] = useState(() => ({
        name: space?.name || '',
        description: space?.description || '',
        goal: space?.goal || '',
        audience: space?.context?.audience || '',
        style: space?.context?.style || '',
        terms: space?.context?.terms || '',
        forbidden: (space?.context?.forbidden || []).join('\n'),
      }))
      const [confirmText, setConfirmText] = useState('')
      const field = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))
      const submit = async () => {
        const ok = await onSave({
          name: form.name,
          description: form.description,
          goal: form.goal,
          context: {
            audience: form.audience,
            style: form.style,
            terms: form.terms,
            forbidden: form.forbidden.split('\n').map((x) => x.trim()).filter(Boolean),
          },
        })
        if (ok) onClose()
      }
      return h('div', { className: 'germina-modal-veil', onClick: onClose },
        h('div', { className: 'germina-modal', role: 'dialog', 'aria-label': t('spaceTitle'), onClick: (e) => e.stopPropagation() },
          h('div', { className: 'germina-modal-head' },
            h(Icon, { name: 'sprout', size: 16 }),
            h('strong', null, t('spaceTitle')),
            h('span', { className: 'germina-subtitle' }, t('spaceManifestHint')),
            h(IconButton, { icon: 'x', label: t('close'), onClick: onClose })),
          h('label', { className: 'germina-field' }, h('span', null, t('spaceName')), 
            h('input', { value: form.name, maxLength: 80, placeholder: t('spaceNamePh'), onChange: field('name') })),
          h('label', { className: 'germina-field' }, h('span', null, t('spaceDesc')),
            h('input', { value: form.description, maxLength: 400, placeholder: t('spaceDescPh'), onChange: field('description') })),
          h('label', { className: 'germina-field' }, h('span', null, t('spaceGoal')),
            h('input', { value: form.goal, maxLength: 400, placeholder: t('spaceGoalPh'), onChange: field('goal') })),
          h('div', { className: 'germina-field-group' },
            h('span', { className: 'germina-field-label' }, t('spaceContext')),
            h('label', { className: 'germina-field' }, h('span', null, t('ctxAudience')),
              h('input', { value: form.audience, onChange: field('audience'), placeholder: t('ctxAudiencePh') })),
            h('label', { className: 'germina-field' }, h('span', null, t('ctxStyle')),
              h('input', { value: form.style, onChange: field('style'), placeholder: t('ctxStylePh') })),
            h('label', { className: 'germina-field' }, h('span', null, t('ctxTerms')),
              h('input', { value: form.terms, onChange: field('terms'), placeholder: t('ctxTermsPh') })),
            h('label', { className: 'germina-field' }, h('span', null, t('ctxForbidden')),
              h('textarea', { rows: 3, value: form.forbidden, onChange: field('forbidden'), placeholder: t('ctxForbiddenPh') }))),
          h('div', { className: 'germina-modal-foot' },
            h('span', { className: 'germina-subtitle' }, t('spaceFileNote')),
            h('span', { style: { flex: 1 } }),
            h(Button, { variant: 'ghost', size: 'sm', onClick: onClose }, t('close')),
            h(Button, { size: 'sm', onClick: submit, disabled: spaceSaving || !form.name.trim() },
              h(Icon, { name: spaceSaving ? 'loader-circle' : 'check', size: 14, className: spaceSaving ? 'germina-spin' : '' }),
              spaceSaving ? t('saving') : t('spaceSave')))))
    }

    function welcomeTab(content, name = '欢迎.md') {
      return { path: 'germina:welcome', name, content, orig: content, kind: 'markdown', readOnly: true }
    }

    function WorkspaceShell(props) {
      const [workspace, setWorkspace] = useState(null)
      const [error, setError] = useState('')
      const [retry, setRetry] = useState(0)
      useEffect(() => {
        let mounted = true
        requestApi({ op: 'workspace' }).then((result) => {
          if (!mounted) return
          if (result.body.ok) { setWorkspace(result.body); setError('') }
          else setError(result.body.error || `HTTP ${result.status}`)
        })
        return () => { mounted = false }
      }, [retry])
      if (!workspace) return h('div', { className: 'germina-root' }, h(Styles), h('div', { className: 'germina-empty', role: error ? 'alert' : 'status' },
        error || props.t('loading'), error ? h('button', { className: 'germina-btn', onClick: () => setRetry((value) => value + 1) }, props.t('retry')) : null))
      return h(MainPanel, { ...props, key: workspace.root || 'welcome', workspace, onWorkspaceChange: setWorkspace })
    }

    const DocumentContext = React.createContext(null)

    function ChatPane({ renderFactorySlot, inputActions, t, sessionId, useSession, useConversation, useSessions, inputActionsRef }) {
      if (inputActionsRef) inputActionsRef.current = inputActions // 桥接：研究模板读取草稿插入能力
      const session = useSession((state) => state)
      const conversation = useConversation((state) => state)
      const summaryBlank = useSessions((state) => state.byId[sessionId]?.blank)
      const shellPhase = !session || !conversation ? 'blank'
        : (conversation.activeTargets.size > 0 || (!session.blank && !session.awaitingFirstTurn) || session.running) ? 'active'
          : session.promptAttempted ? 'engaging' : 'blank'
      const settling = sessionId !== undefined && ((shellPhase === 'blank' && session?.openState === 'loading' && summaryBlank !== true)
        || (session?.subagent?.address.mode === 'continuable' && session.subagent.parentAvailable === undefined))
      const hero = sessionId === undefined || (shellPhase === 'blank' && (session?.openState === 'open' || summaryBlank === true))
      const phase = settling ? 'settling' : hero ? 'hero' : 'active'
      const doc = React.useContext(DocumentContext)
      const [notice, setNotice] = useState('')
      useEffect(() => { setNotice('') }, [doc?.active?.path, sessionId])
      const cite = () => {
        const text = documentContext(doc?.active, doc?.selection)
        if (!text || !inputActions) return
        const result = inputActions.insertText(text, inputActions.captureInsertion())
        setNotice(result ? t('referenceAdded') : t('referenceFailed'))
      }
      return h('div', { className: 'germina-chat-body' },
        doc?.active ? h('div', { className: 'germina-reference' },
          h('span', { className: 'germina-reference-mark' }, h(Icon, { name: fileIcon(doc.active.name), size: 16 })),
          h('div', { className: 'germina-reference-copy' }, h('span', { className: 'germina-reference-name', title: doc.active.path }, doc.active.name),
            h('small', null, doc.selection ? t('selectedPassage') : t('currentDraft'))),
          h('button', { className: 'germina-btn-ghost', disabled: !inputActions || !doc.active.content.trim(), onClick: cite }, h(Icon, { name: 'quote', size: 13 }), doc.selection ? t('citeSelection') : t('citeDocument'))) : null,
        notice ? h('div', { className: 'germina-chat-hint', role: 'status' }, h(Icon, { name: 'text-cursor-input', size: 13 }), notice) : null,
        h('div', { className: 'germina-chat-content' }, renderFactorySlot('conversation.content', { variant: 'embedded', phase, hero })))
    }

    function MainPanel({ t, pickDirectory, renderSlot, SessionProvider, retainSession, workspace, onWorkspaceChange }) {
      const rootName = workspace.name
      /* Space 语义：清单在用户目录里（germina.space.json），文件系统即真相 */
      const [space, setSpace] = useState(null)
      const [spaceOpen, setSpaceOpen] = useState(false)
      const [versionsOpen, setVersionsOpen] = useState(false)
      const [versionList, setVersionList] = useState([])
      const [versionLoading, setVersionLoading] = useState(false)
      const [works, setWorks] = useState([])
      const [materials, setMaterials] = useState([])
      const [spaceSaving, setSpaceSaving] = useState(false)
      const refreshSpace = useCallback(async () => {
        if (!workspace.root) { setSpace(null); return }
        const r = await requestApi({ op: 'spaceRead', _workspaceRoot: workspace.root })
        if (r.body.ok) { setSpace(r.body.space); setWorks(r.body.space?.works ?? []) }
        const m = await requestApi({ op: 'materialsRead', _workspaceRoot: workspace.root })
        if (m.body.ok) setMaterials(m.body.materials)
      }, [workspace.root])
      useEffect(() => { refreshSpace() }, [refreshSpace])
      const statusOf = useCallback((path) => works.find((w) => w.path === path)?.status ?? 'draft', [works])
      const derivedFromOf = useCallback((path) => works.find((w) => w.path === path)?.derivedFrom ?? [], [works])
      const setStatusFor = useCallback(async (path, next) => {
        const list = [...works.filter((w) => w.path !== path), { path, status: next, derivedFrom: derivedFromOf(path) }]
        const r = await requestApi({ op: 'worksWrite', _workspaceRoot: workspace.root, works: list })
        if (r.body.ok) setWorks(r.body.works)
        else setError(r.body.error ?? `HTTP ${r.status}`)
      }, [works, workspace.root, derivedFromOf])

      const openVersions = useCallback(async () => {
        if (!active) return
        setVersionsOpen(true)
        setVersionLoading(true)
        const r = await requestApi({ op: 'versionList', _workspaceRoot: workspace.root, path: active.path })
        setVersionLoading(false)
        if (r.body.ok) setVersionList(r.body.versions)
        else setError(r.body.error ?? `HTTP ${r.status}`)
      }, [active, workspace.root])
      const makeSnapshot = useCallback(async (label) => {
        if (!active) return
        const r = await requestApi({ op: 'versionSave', _workspaceRoot: workspace.root, path: active.path, content: active.content, label })
        if (r.body.ok) { openVersions(); setStatus(`${t('snapSaved')} ${r.body.ts ?? ''}`) }
        else setError(r.body.error ?? `HTTP ${r.status}`)
      }, [active, workspace.root, openVersions, t])
      const restoreSnapshot = useCallback(async (ts) => {
        if (!active) return
        if (!window.confirm(t('restoreConfirm').replace('{0}', ts))) return
        const r = await requestApi({ op: 'versionRestore', _workspaceRoot: workspace.root, path: active.path, ts, content: active.content })
        if (!r.body.ok) { setError(r.body.error ?? `HTTP ${r.status}`); return }
        setTabs((prev) => prev.map((x) => (x.path === active.path ? { ...x, content: r.body.content } : x)))
        setVersionsOpen(false)
        setStatus(t('restored'))
      }, [active, workspace.root, t])
      const previewSnapshot = useCallback(async (ts) => {
        const r = await requestApi({ op: 'versionRead', _workspaceRoot: workspace.root, path: active?.path, ts })
        if (r.body.ok) setStatus(`${ts}: ${r.body.content.length} ${t('characters')}`)
        else setError(r.body.error ?? `HTTP ${r.status}`)
      }, [active, t])
      const deriveFrom = useCallback(async (sourceTab) => {
        if (!sourceTab) return
        const kind = window.prompt(t('derivePrompt'), t('deriveDefault'))
        if (kind === null) return
        const base = sourceTab.name.replace(/\.\w+$/, '')
        const name = `${base} · ${kind || t('deriveDefault')}.md`
        const header = `# ${base} · ${kind || t('deriveDefault')}\n\n> ${t('derivedFrom').replace('{0}', sourceTab.name)}\n\n---\n\n`
        const r = await api({ op: 'write', path: name, content: header })
        if (r.body.ok) {
          await requestApi({ op: 'worksWrite', _workspaceRoot: workspace.root, works: [
            ...works.filter((w) => w.path !== name),
            { path: name, status: 'draft', derivedFrom: [sourceTab.path] },
          ] })
          refreshSpace()
          await openFile(name)
          fetchChildren('')
        } else setError(`${name}: ${r.body.error ?? `HTTP ${r.status}`}`)
      }, [works, workspace.root, api, openFile, fetchChildren, refreshSpace])
      const exportAs = useCallback((fmt) => {
        if (!active) return
        const base = active.name.replace(/\.\w+$/, '')
        if (fmt === 'md') triggerDownload(`${base}.md`, active.content, 'text/markdown')
        else triggerDownload(`${base}.html`, buildExportHtml(active.name, active.content), 'text/html')
        setStatus(`${t('exported')} ${base}.${fmt}`)
      }, [active, t])

      /* F02 素材登记：引用当前打开文件，或登记一个链接/笔记 */
      const addMaterial = useCallback(async ({ path, title, type, note }) => {
        const entry = {
          path: path ?? `notes/${Date.now()}.md`,
          title: (title || path || note?.slice(0, 30) || '未命名素材').slice(0, 160),
          type: type ?? (path ? 'file' : 'note'),
          note: note ?? '',
          addedAt: new Date().toISOString(),
        }
        const list = [...materials.filter((m) => m.path !== entry.path), entry]
        const r = await requestApi({ op: 'materialsWrite', _workspaceRoot: workspace.root, materials: list })
        if (r.body.ok) { setMaterials(r.body.materials); setStatus(t('materialAdded')) }
        else setError(r.body.error ?? `HTTP ${r.status}`)
      }, [materials, workspace.root, t])
      const removeMaterial = useCallback(async (path) => {
        const r = await requestApi({ op: 'materialsWrite', _workspaceRoot: workspace.root, materials: materials.filter((m) => m.path !== path) })
        if (r.body.ok) setMaterials(r.body.materials)
        else setError(r.body.error ?? `HTTP ${r.status}`)
      }, [materials, workspace.root])

      /* F03 研究模板：把 Space 背景 + 引导问题注入聊天草稿（发送仍由用户在会话里确认） */
      const inputActionsRef = inputActionsBridge
      const [contextText, setContextText] = useState('')
      useEffect(() => {
        if (!workspace.root) { setContextText(''); return }
        requestApi({ op: 'spaceContext', _workspaceRoot: workspace.root }).then((r) => {
          if (r.body.ok) setContextText(r.body.contextText ?? '')
        })
      }, [workspace.root, space])
      const researchTemplate = useCallback(async (kind) => {
        if (!inputActionsRef.current) { setError(t('chatClosedForResearch')); return }
        const ctx = contextText ? `\n\n[项目背景]\n${contextText}` : ''
        const mats = materials.length ? `\n[已登记素材]\n${materials.slice(0, 20).map((m) => `- ${m.title}${m.type === 'url' ? ` (${m.path})` : ''}`).join('\n')}` : ''
        const prompts = {
          summarize: `请总结当前 Space 已登记素材的要点，按素材逐份输出关键结论。`,
          compare: `请比较已登记素材中的观点异同：先列共同结论，再列矛盾或分歧，并指出各自的依据。`,
          outline: `请基于项目背景与已登记素材，为下面的主题生成一份结构化大纲（H2 级章节 + 每章要点列表）：\n主题：`,
          research: `请围绕以下问题，基于已登记素材作答；若素材不足以支撑结论，请明确说明证据缺口，不要编造来源。\n问题：`,
        }
        const text = `${prompts[kind]}${ctx}${mats}`
        const result = inputActionsRef.current.insertText(text, inputActionsRef.current.captureInsertion())
        setStatus(result ? t('researchInserted') : t('referenceFailed'))
      }, [contextText, materials, t])

      const saveSpace = useCallback(async (patch) => {
        setSpaceSaving(true)
        const r = await requestApi({ op: 'spaceWrite', _workspaceRoot: workspace.root, patch })
        setSpaceSaving(false)
        if (r.body.ok) { setSpace(r.body.space); return true }
        setError(r.body.error ?? `HTTP ${r.status}`)
        return false
      }, [workspace.root])
      const api = useCallback((payload) => requestApi({ ...payload, _workspaceRoot: workspace.root }), [workspace.root])
      /* 懒加载树模型：childrenMap path→entries[]（null=未加载，[]=空）；
         搜索时整体替换为 server-side tree 结果 */
      const [childrenMap, setChildrenMap] = useState(null)  // Map
      const [loadingDirs, setLoadingDirs] = useState(() => new Set())
      const [filter, setFilter] = useState('')
      const [searchResult, setSearchResult] = useState(null) // 搜索时的扁平 entries | null
      const [searching, setSearching] = useState(false)
      const [tabs, setTabs] = useState(() => [welcomeTab(workspace.welcome, t('welcomeFile'))])               // [{path, name, content, orig, kind}]
      const [activePath, setActivePath] = useState('germina:welcome')
      const [error, setError] = useState('')
      const [status, setStatus] = useState('')
      const [busy, setBusy] = useState(false)
      const [view, setView] = useState('preview')           // edit | split | preview
      const [filesVisible, setFilesVisible] = useState(true)
      const [chatVisible, setChatVisibleState] = useState(true)
      const [selection, setSelection] = useState('')
      const [chatState, setChatState] = useState({ reference: null, error: '', loading: false })
      const [chatRetry, setChatRetry] = useState(0)
      const setChatVisible = (visible) => {
        setChatState({ reference: null, error: '', loading: false })
        setChatVisibleState(visible)
      }
      useEffect(() => {
        if (!workspace.root || !chatVisible) return
        let mounted = true
        let reference
        const release = () => { reference?.release(); reference = undefined }
        setChatState({ reference: null, error: '', loading: true })
        ensureFolderSession(workspace.root).then(async (id) => {
          if (!mounted) return
          reference = retainSession(id)
          await reference.ready
          if (mounted) setChatState({ reference, error: '', loading: false })
        }).catch((error) => {
          release()
          if (mounted) setChatState({ reference: null, error: error.message, loading: false })
        })
        return () => { mounted = false; release() }
      }, [workspace.root, chatVisible, chatRetry, retainSession])
      useEffect(() => { setSelection('') }, [activePath])
      const [expanded, setExpanded] = useState(() => new Set())  // 已展开目录 path 集合
      const { ratio, containerRef, splitter } = useSplit(0.5)

      const active = tabs.find((x) => x.path === activePath) ?? null

      /* 拉取一个目录的直接子级（懒加载单元） */
      const fetchChildren = useCallback(async (dirPath) => {
        if (!workspace.root) return []
        setLoadingDirs((prev) => { const n = new Set(prev); n.add(dirPath); return n })
        const r = await api({ op: 'list', path: dirPath })
        setLoadingDirs((prev) => { const n = new Set(prev); n.delete(dirPath); return n })
        if (!r.body.ok) {
          setError(`${dirPath || '/'}: ${r.body.error ?? `HTTP ${r.status}`}`)
          return []
        }
        /* list 只给 name；补全 path 与 kind */
        const entries = r.body.entries.map((e) => ({
          ...e,
          path: dirPath ? `${dirPath}/${e.name}` : e.name,
          kind: e.type === 'file' ? e.kind : undefined,
        }))
        setChildrenMap((prev) => {
          const next = new Map(prev)
          next.set(dirPath, entries)
          return next
        })
        return entries
      }, [api, workspace.root])

      /* 初始加载根目录 */
      useEffect(() => {
        setChildrenMap(new Map())
        setSearchResult(null)
        fetchChildren('')
      }, [fetchChildren])

      /* 刷新某目录的子级：保存/新建/删除后调用，保持树与磁盘同构 */
      const refreshDir = useCallback((dirPath) => {
        if (childrenMap?.has(dirPath)) fetchChildren(dirPath)
      }, [childrenMap, fetchChildren])

      /* 删除文件：Host 端拒绝删根；成功后关标签、刷新父目录 */
      const deleteFile = useCallback(async (path) => {
        if (path === 'germina:welcome') return
        if (!window.confirm(`${t('confirmDelete')} ${path}`)) return
        const r = await api({ op: 'delete', path })
        if (r.body.ok) {
          const under = (p) => p === path || p.startsWith(path + '/')
          setTabs((prev) => prev.filter((x) => !under(x.path)))
          if (under(activePath)) setActivePath('')
          fetchChildren(parentOf(path))
          setStatus(t('deleted'))
        } else {
          setError(`${path}: ${r.body.error ?? `HTTP ${r.status}`}`)
        }
      }, [activePath, fetchChildren, t])

      const openFile = useCallback(async (path) => {
        const existing = tabs.find((x) => x.path === path)
        if (existing) { setActivePath(path); return }
        setStatus('')
        /* 标签满：优先驱逐最旧的干净标签；全是脏标签则拒绝开新，保住用户内容 */
        if (tabs.length >= 10) {
          const cleanIdx = tabs.findIndex((x) => x.content === x.orig)
          if (cleanIdx === -1) { setError(t('tabsFullDirty')); return }
          const evicted = tabs[cleanIdx]
          setTabs((prev) => prev.filter((x) => x.path !== evicted.path))
          if (activePath === evicted.path) setActivePath('')
        }
        const r = await api({ op: 'read', path })
        if (r.body.ok) {
          setTabs((prev) => [...prev, {
            path, name: path.split('/').pop(),
            content: r.body.content, orig: r.body.content,
            kind: r.body.kind ?? 'text',
          }])
          setActivePath(path)
          setError('')
        } else {
          setError(`${path}: ${r.body.error ?? `HTTP ${r.status}`}`)
        }
      }, [tabs, activePath, t])

      const updateDraft = useCallback((value) => {
        setTabs((prev) => prev.map((x) => (x.path === activePath && !x.readOnly ? { ...x, content: value } : x)))
      }, [activePath])

      /* 自动保存：停笔 800ms 后写盘；失败不清草稿，仅状态栏提示；保存期间继续编辑则以最新内容重拍定时器 */
      const [autosaveError, setAutosaveError] = useState(false)
      const autosaveTimer = useRef(null)
      const autosaveInFlight = useRef(false)
      const saveRef = useRef(null)
      useEffect(() => { saveRef.current = save }, [save])
      useEffect(() => {
        if (!active || active.readOnly || !workspace.root) return undefined
        if (active.content === active.orig) return undefined
        if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
        autosaveTimer.current = setTimeout(async () => {
          if (autosaveInFlight.current) { saveRef.current?.(); return }
          autosaveInFlight.current = true
          const r = await api({ op: 'write', path: active.path, content: active.content })
          autosaveInFlight.current = false
          if (r.body.ok) {
            /* 仅当草稿未被继续编辑时才清脏标记；否则留给下一轮自动保存 */
            setTabs((prev) => prev.map((x) => (x.path === active.path && x.content === active.content ? { ...x, orig: active.content } : x)))
            setAutosaveError(false)
          } else {
            setAutosaveError(true)
          }
        }, 800)
        return () => clearTimeout(autosaveTimer.current)
      }, [active?.path, active?.content, active?.orig, active?.readOnly, workspace.root, api])

      const save = useCallback(async () => {
        if (!active || active.readOnly || !workspace.root) return
        setBusy(true)
        setStatus(t('saving'))
        const r = await api({ op: 'write', path: active.path, content: active.content })
        setBusy(false)
        if (r.body.ok) {
          setTabs((prev) => prev.map((x) => (x.path === active.path ? { ...x, orig: active.content } : x)))
          setAutosaveError(false)
          setStatus(`${t('saved')} ${new Date().toLocaleTimeString()}`)
          refreshDir(parentOf(active.path))
        } else {
          setStatus('')
          setError(`${active.path}: ${r.body.error ?? `HTTP ${r.status}`}`)
        }
      }, [active, t, refreshDir])

      const closeTab = useCallback((path) => {
        const tab = tabs.find((x) => x.path === path)
        /* 脏标签关闭前确认，防误点丢内容 */
        if (tab && tab.content !== tab.orig && !window.confirm(t('discardChanges').replace('{0}', tab.name))) return
        setTabs((prev) => {
          const next = prev.filter((x) => x.path !== path)
          if (path === activePath) setActivePath(next.length ? next[next.length - 1].path : '')
          return next
        })
      }, [tabs, activePath, t])

      /* 打开文件夹：经宿主 uiWorkspace.pickDirectory 原生选择，再 setRoot 持久化 */
      const openFolder = useCallback(async () => {
        if (!pickDirectory) { setError(t('noPicker')); return }
        const dir = await pickDirectory()
        if (!dir) return
        /* 有脏标签时切根前确认，否则一按就全丢 */
        if (tabs.some((x) => x.content !== x.orig) && !window.confirm(t('discardAll'))) return
        setBusy(true)
        const r = await api({ op: 'setRoot', _root: dir })
        setBusy(false)
        if (r.body.ok) {
          onWorkspaceChange(r.body)
        } else {
          setError(r.body.error ?? `HTTP ${r.status}`)
        }
      }, [pickDirectory, tabs, t, api, onWorkspaceChange])

      /* 新建文件 */
      const newFile = useCallback(async () => {
        if (!workspace.root) return
        const name = window.prompt(t('newFileName'), 'untitled.md')
        if (!name) return
        if (tabs.length >= 10) { setError(t('tabsFullDirty')); return }
        const r = await api({ op: 'write', path: name, content: '' })
        if (r.body.ok) {
          setTabs((prev) => [...prev, {
            path: name, name: name.split('/').pop(),
            content: '', orig: '', kind: kindFor(name),
          }])
          setActivePath(name)
          fetchChildren(parentOf(name))
        } else {
          setError(`${name}: ${r.body.error ?? `HTTP ${r.status}`}`)
        }
      }, [tabs, fetchChildren, t])

      const formatJson = useCallback(() => {
        if (!active) return
        try {
          const obj = JSON.parse(active.content)
          const pretty = JSON.stringify(obj, null, 2)
          updateDraft(pretty)
          setStatus(t('formatted'))
        } catch (e) {
          setError(`${t('jsonInvalid')}: ${e.message}`)
        }
      }, [active, updateDraft, t])

      /* 键盘：⌘S 保存 */
      useEffect(() => {
        const onKey = (e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save() }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [save])

      const toggleDir = useCallback((path) => {
        /* 首次展开：拉取子级；已加载：仅切换展开记忆 */
        setExpanded((prev) => {
          const next = new Set(prev)
          if (next.has(path)) next.delete(path)
          else {
            next.add(path)
            if (!childrenMap?.has(path)) fetchChildren(path)
          }
          return next
        })
      }, [childrenMap, fetchChildren])

      /* 搜索：去抖 300ms，非空时走 Host 端 tree（浅深度、限量），清空时回到懒加载树 */
      useEffect(() => {
        const q = filter.trim()
        if (!q || !workspace.root) { setSearchResult(null); setSearching(false); return }
        setSearching(true)
        const timer = setTimeout(async () => {
          const r = await api({ op: 'tree', path: '', maxDepth: 12 })
          if (!r.body.ok) { setSearching(false); return }
          const ql = q.toLowerCase()
          const hits = r.body.entries.filter((e) => e.type === 'file' && e.name.toLowerCase().includes(ql))
          setSearchResult(hits.slice(0, 200))
          setSearching(false)
        }, 300)
        return () => clearTimeout(timer)
      }, [filter])

      const dirty = active != null && !active.readOnly && active.content !== active.orig
      const layout = editorLayout(active?.kind, view, ratio)
      const canFormat = active?.kind === 'json'

      const showWelcome = () => {
        if (!tabs.some((tab) => tab.readOnly)) {
          const evicted = tabs.length >= 10 ? tabs.find((tab) => tab.content === tab.orig) : null
          if (tabs.length >= 10 && !evicted) { setError(t('tabsFullDirty')); return }
          setTabs((prev) => [welcomeTab(workspace.welcome, t('welcomeFile')), ...prev.filter((tab) => tab.path !== evicted?.path)])
        }
        setActivePath('germina:welcome')
        setView('preview')
      }
      /* ---------- 渲染 ---------- */

      return h('div', { className: 'germina-root' },
        h(Styles),
        h('div', { className: 'germina-studio-header' },
          h('div', { className: 'germina-brand' }, h('span', { className: 'germina-brand-mark' }, h(PanelIcon, { size: 17 })), h('strong', null, 'Germina'), h('span', { className: 'germina-subtitle' }, t('studio'))),
          h('button', { className: 'germina-btn-ghost', title: t('files'), 'aria-label': t('files'), 'data-active': filesVisible, 'aria-pressed': filesVisible, onClick: () => setFilesVisible(!filesVisible) }, h(Icon, { name: 'panel-left' }), h('span', { className: 'germina-control-label' }, t('files'))),
          h('button', { className: 'germina-btn-ghost', title: t('assistant'), 'aria-label': t('assistant'), 'data-active': chatVisible, 'aria-pressed': chatVisible, onClick: () => setChatVisible(!chatVisible) }, h(Icon, { name: 'panel-right' }), h('span', { className: 'germina-control-label' }, t('assistant')))),
        error ? h(Alert, { variant: 'error', role: 'alert', className: 'germina-alert' },
          h(Icon, { name: 'circle-alert', size: 16 }),
          h(AlertTitle, null, t('error')),
          h(AlertDescription, null, error),
          h(AlertAction, null, h(IconButton, { icon: 'x', label: t('close'), onClick: () => setError('') }))) : null,
        h('div', { className: 'germina-body' },
          filesVisible ? h('aside', { className: 'germina-sidebar', 'aria-label': t('files') },
            h('div', { className: 'germina-section-head' }, h(Icon, { name: 'folder-open', size: 15 }), h('strong', { title: rootName }, rootName || t('files')),
              h(IconButton, { icon: 'refresh-cw', label: t('refresh'), onClick: () => fetchChildren(''), disabled: !workspace.root }),
              h(IconButton, { icon: 'plus', label: t('newFile'), onClick: newFile, disabled: !workspace.root })),
            h('div', { className: 'germina-search' }, h(Icon, { name: 'search', size: 14 }), h('input', { placeholder: t('searchFiles'), 'aria-label': t('searchFiles'), value: filter, disabled: !workspace.root, onChange: (e) => setFilter(e.target.value) }),
              filter ? h(IconButton, { icon: 'x', label: t('clearSearch'), onClick: () => setFilter('') }) : null),
            h('div', { className: 'germina-tree' },
              h('button', { className: 'germina-tree-row', 'data-sel': active?.readOnly, onClick: showWelcome }, h(Icon, { name: 'file-text', size: 15 }), t('welcomeFile')),
              !workspace.root ? h('div', { className: 'germina-empty' }, t('chooseFolder')) : null,
              !workspace.root ? null : searching ? h('div', { className: 'germina-empty' }, t('loading'))
                : searchResult != null ? (searchResult.length ? searchResult.map((entry) => h('button', { key: entry.path, className: 'germina-tree-row', 'data-sel': activePath === entry.path, onClick: () => openFile(entry.path), title: entry.path }, h(Icon, { name: fileIcon(entry.name), size: 15, className: 'germina-file-glyph' }), h('span', { className: 'germina-tree-name' }, entry.path))) : h('div', { className: 'germina-empty' }, t('noMatch')))
                : childrenMap == null ? h('div', { className: 'germina-empty' }, t('loading'))
                  : childrenMap.get('')?.length ? childrenMap.get('').map((node) => h(TreeRow, { key: node.path, node, depth: 0, selectedPath: activePath, onOpenFile: openFile, onDelete: deleteFile, expanded, toggleDir, childrenMap, loadingDirs, t }))
                    : h('div', { className: 'germina-empty' }, t('empty'))),
            workspace.root ? h('div', { className: 'germina-materials' },
              h('div', { className: 'germina-field-label', style: { padding: '6px 12px 2px' } }, `${t('materials')} · ${materials.length}`),
              materials.slice(0, 8).map((m) => h('div', { key: m.path, className: 'germina-material-row', title: m.note || m.path },
                h(Icon, { name: m.type === 'url' ? 'link' : m.type === 'note' ? 'sticky-note' : fileIcon(m.path), size: 13 }),
                h('span', { className: 'germina-tree-name' }, m.title),
                h(IconButton, { icon: 'x', label: `${t('removeMaterial')} ${m.title}`, onClick: () => removeMaterial(m.path) }))),
              materials.length ? h('div', { className: 'germina-research', role: 'group', 'aria-label': t('research') },
                h('span', { className: 'germina-field-label', style: { padding: '0 12px' } }, t('research')),
                [['summarize', 'file-text', t('researchSummarize')], ['compare', 'git-compare', t('researchCompare')], ['outline', 'list-tree', t('researchOutline')], ['research', 'search', t('researchAsk')]].map(([kind, icon, label]) =>
                  h('button', { key: kind, className: 'germina-btn-ghost', title: label, disabled: !!parsing || !materials.length, onClick: () => researchTemplate(kind) },
                    h(Icon, { name: icon, size: 12 }), label.slice(0, 6)))) : null,
              active && !active.readOnly ? h('div', { style: { padding: '2px 12px 6px' } },
                h('button', { className: 'germina-btn-ghost', onClick: () => addMaterial({ path: active.path, title: active.name, type: 'file' }) },
                  h(Icon, { name: 'plus', size: 12 }), t('addCurrent'))) : null,
              h('div', { style: { padding: '0 12px 8px' } },
                h('button', { className: 'germina-btn-ghost', onClick: () => {
                  const url = window.prompt(t('addUrlPrompt'))
                  if (url && url.trim()) addMaterial({ path: url.trim(), title: url.trim(), type: 'url' })
                } }, h(Icon, { name: 'link', size: 12 }), t('addUrl')))) : null,
            h('div', { className: 'germina-sidebar-foot' }, h('button', { className: 'germina-btn-ghost', onClick: openFolder, disabled: busy }, h(Icon, { name: 'folder-open', size: 15 }), t('openFolder')))) : null,
          h('main', { className: 'germina-main', 'aria-label': t('editor') },
        h('div', { className: 'germina-toolbar' },
          h(Icon, { name: active ? fileIcon(active.name) : 'pencil-line', size: 15 }),
          h('span', { className: 'germina-path', title: active?.path }, active && parentOf(active.path) ? `${parentOf(active.path)} / ` : '', h('strong', null, active?.name || t('editor'))),
          canFormat ? h(IconButton, { icon: 'file-json-2', label: t('formatJson'), onClick: formatJson }) : null,
          active && ['markdown', 'json', 'html'].includes(active.kind) ? h(SegmentedControl, { size: 'sm', 'aria-label': t('viewMode'), role: 'group' },
            ['edit', 'split', 'preview'].map((mode) => h(SegmentedControlItem, {
              key: mode, 'data-checked': layout.mode === mode,
              title: t({ edit: 'viewEdit', split: 'viewSplit', preview: 'viewPreview' }[mode]),
              'aria-label': t({ edit: 'viewEdit', split: 'viewSplit', preview: 'viewPreview' }[mode]), onClick: () => setView(mode),
            }, h(Icon, { name: { edit: 'pencil-line', split: 'columns-2', preview: 'eye' }[mode], size: 14 }), h('span', { className: 'germina-control-label' }, t({ edit: 'viewEdit', split: 'viewSplit', preview: 'viewPreview' }[mode]))))) : null,
          active && !active.readOnly ? h(IconButton, { icon: 'trash-2', label: t('deleteFile'), className: 'germina-danger', onClick: () => deleteFile(active.path) }) : null,
          h('span', { className: 'germina-toolbar-divider', 'aria-hidden': true }),
          active && !active.readOnly ? h(IconButton, { icon: 'history', label: t('versions'), title: t('versions'), onClick: openVersions }) : null,
          active && !active.readOnly ? h('select', { className: 'germina-status-select', 'aria-label': t('docStatus'), value: statusOf(active.path), onChange: (e) => setStatusFor(active.path, e.target.value) },
            [['draft', t('statusDraft')], ['in-progress', t('statusInProgress')], ['done', t('statusDone')]].map(([v, label]) => h('option', { key: v, value: v }, label))) : null,
          active && !active.readOnly ? h(IconButton, { icon: 'git-fork', label: t('deriveFrom'), title: t('deriveFrom'), onClick: () => deriveFrom(active) }) : null,
          active ? h(IconButton, { icon: 'download', label: t('exportMd'), title: t('exportMd'), onClick: () => exportAs('md') }) : null,
          active?.kind === 'markdown' ? h(IconButton, { icon: 'file-code-2', label: t('exportHtml'), title: t('exportHtml'), onClick: () => exportAs('html') }) : null,
          active && derivedFromOf(active.path).length ? h('span', { className: 'germina-derived', title: t('derivedFrom').replace('{0}', derivedFromOf(active.path).join(', ')) },
            h(Icon, { name: 'git-fork', size: 11 }), t('derivedBadge')) : null,
          h('span', { className: 'germina-toolbar-divider', 'aria-hidden': true }),
          h(Button, { 'data-dirty': dirty, onClick: save, disabled: busy || !dirty, size: 'sm' },
            h(Icon, { name: busy ? 'loader-circle' : dirty ? 'save' : 'check', size: 14, className: busy ? 'germina-spin' : '' }),
            busy ? t('saving') : dirty ? t('save') : t('saved')), 
        ),
            tabs.length
              ? h('div', { className: 'germina-tabs' },
                tabs.map((x) =>
                  h('div', { key: x.path, className: 'germina-tab-wrap', 'data-active': x.path === activePath },
                    h('button', {
                      className: 'germina-tab', title: x.path, 'aria-pressed': x.path === activePath,
                      onClick: () => setActivePath(x.path),
                    },
                      h(Icon, { name: fileIcon(x.name), size: 13 }),
                      h('span', { className: 'germina-tab-name' }, x.name),
                      x.content !== x.orig ? h('span', { className: 'germina-tab-dot', title: t('unsaved') }) : null),
                    h(IconButton, { icon: 'x', label: `${t('close')} ${x.name}`, onClick: () => closeTab(x.path) }))))
              : null,
            active
              ? h('div', {
                className: 'germina-editor-pane', key: active.path, ref: containerRef,
                'data-view': layout.mode, style: { gridTemplateColumns: layout.columns },
              },
                // Fixed, distinct pane identities prevent React reusing a source node as a preview.
                // Keep the textarea mounted across mode switches to retain its selection and scroll.
                h('div', { className: 'germina-source-pane', key: 'source', hidden: !layout.editor },
                  h('textarea', {
                    className: 'germina-editor',
                    value: active.content, readOnly: !!active.readOnly, spellCheck: false, 'aria-label': active.name,
                    onSelect: (e) => setSelection(e.target.value.slice(e.target.selectionStart, e.target.selectionEnd)),
                    onChange: (e) => updateDraft(e.target.value),
                  })),
                layout.split ? splitter : null,
                h('div', { className: 'germina-preview-pane', key: 'preview', hidden: !layout.preview },
                  layout.preview
                    ? (active.kind === 'markdown'
                      ? h(MdPreview, { content: active.content })
                      : active.kind === 'json'
                        ? h(JsonPreview, { content: active.content, t })
                        : h(HtmlPreview, { content: active.content, isSvg: isSvgExt(active.name) }))
                    : null))
              : h('div', { className: 'germina-empty' },
                h('div', { className: 'germina-empty-mark' }, h(Icon, { name: 'pencil-line', size: 25 })),
                h('div', { className: 'germina-big' }, t('welcome')),
                h('p', null, t('pickFile')),
                h('div', { className: 'germina-empty-actions' },
                  h('button', { className: 'germina-btn', onClick: openFolder, disabled: busy }, h(Icon, { name: 'folder-open', size: 15 }), t('openFolder')),
                  h('button', { className: 'germina-btn-ghost', onClick: newFile, disabled: !workspace.root }, h(Icon, { name: 'plus', size: 15 }), t('newFile'))),
                h('div', { className: 'germina-empty-steps', 'aria-hidden': true },
                  h('span', null, h(Icon, { name: 'folder', size: 12 }), t('collectStep')),
                  h('span', null, h(Icon, { name: 'pencil-line', size: 12 }), t('writeStep')),
                  h('span', null, h(Icon, { name: 'sparkles', size: 12 }), t('refineStep'))))),
          chatVisible ? h('aside', { className: 'germina-chat', 'aria-label': t('assistant') },
            h('div', { className: 'germina-section-head' }, h(Icon, { name: 'sparkles', size: 15 }), h('strong', null, t('assistant')),
              h(IconButton, { icon: 'panel-right', label: t('hideAssistant'), onClick: () => setChatVisible(false) })),
            h('div', { className: 'germina-session-picker' }, h(Icon, { name: 'message-square', size: 14 }),
              h('span', { title: chatState.reference?.sessionId }, workspace.root ? `${rootName} · ${t('folderSession')}` : t('chooseFolder'))),
            h(DocumentContext.Provider, { value: { active: active?.readOnly ? null : active, selection } },
              chatState.reference && workspace.root && chatVisible
                ? h(SessionProvider, { session: chatState.reference }, renderSlot('germina.assistant', { inputActionsRef: inputActionsBridge }))
                : h('div', { className: 'germina-empty', role: chatState.error ? 'alert' : 'status' },
                  h('div', { className: 'germina-empty-mark' }, h(Icon, { name: chatState.loading ? 'loader-circle' : 'message-square', size: 24, className: chatState.loading ? 'germina-spin' : '' })),
                  h('div', { className: 'germina-big' }, chatState.loading ? t('loading') : t('chatWelcome')),
                  h('p', null, chatState.error || (workspace.root ? t('folderSessionHint') : t('chooseFolder'))),
                  chatState.error ? h('button', { className: 'germina-btn', onClick: () => setChatRetry((value) => value + 1) }, t('retry')) : null))) : null,
        ),
        spaceOpen ? h(SpaceDialog, {
          space, spaceSaving, onClose: () => setSpaceOpen(false), onSave: saveSpace, t,
        }) : null,
        versionsOpen ? h('div', { className: 'germina-modal-veil', onClick: () => setVersionsOpen(false) },
          h('div', { className: 'germina-modal', role: 'dialog', 'aria-label': t('versions'), onClick: (e) => e.stopPropagation() },
            h('div', { className: 'germina-modal-head' },
              h(Icon, { name: 'history', size: 16 }), h('strong', null, t('versions')),
              h('span', { className: 'germina-subtitle' }, active?.name || ''),
              h('span', { style: { flex: 1 } }),
              h(Button, { size: 'sm', variant: 'ghost', onClick: () => makeSnapshot(t('manualSnap')) }, h(Icon, { name: 'camera', size: 14 }), t('snapNow')),
              h(IconButton, { icon: 'x', label: t('close'), onClick: () => setVersionsOpen(false) })),
            versionLoading ? h('div', { className: 'germina-empty' }, t('loading')) :
              versionList.length ? h('div', { className: 'germina-version-list' },
                versionList.map((v) => h('div', { key: v.ts, className: 'germina-version-row' },
                  h('div', { className: 'germina-version-meta' },
                    h('strong', null, v.ts.replaceAll('T', ' ').replaceAll('-', '/').slice(0, 19)),
                    v.label ? h('span', { className: 'germina-version-label' }, v.label) : null,
                    h('span', { className: 'germina-subtitle' }, `${v.bytes} B`)),
                  h('div', { className: 'germina-version-actions' },
                    h(Button, { size: 'sm', variant: 'ghost', onClick: () => previewSnapshot(v.ts) }, t('snapPreview')),
                    h(Button, { size: 'sm', onClick: () => restoreSnapshot(v.ts) }, t('snapRestore')))))) : h('div', { className: 'germina-empty' }, t('noVersions')))) : null,
        /* 状态栏 */
        h('div', { className: 'germina-status' },
          autosaveError ? h('button', { className: 'germina-status-warn', role: 'alert', title: t('autosaveFailedHint'), onClick: save },
            h(Icon, { name: 'triangle-alert', size: 11 }), t('autosaveFailed')) : null,
          h('span', { title: status }, h(Icon, { name: busy ? 'loader-circle' : dirty ? 'pencil-line' : 'check', size: 11, className: busy ? 'germina-spin' : '' }), status || (autosaveError ? '' : dirty ? t('autosaving') : t('ready'))),
          active ? h('span', null, (extOf(active.name) || 'text').toUpperCase()) : null,
          active ? h('span', null, `${active.content.length.toLocaleString()} ${t('characters')}`) : null,
          workspace.root ? h('button', { className: 'germina-status-space', title: t('spaceOpenTitle'), onClick: () => setSpaceOpen(true) },
            h(Icon, { name: 'sprout', size: 12 }), space?.name ? h('strong', null, space.name) : t('spaceUnnamed')) : null,
          h('span', { style: { marginLeft: 'auto' } }, h(Icon, { name: 'keyboard', size: 12 }), h('kbd', null, /Mac/.test(navigator.platform) ? '⌘ S' : 'Ctrl S'))),
      )
    }

    return { WorkspaceShell, ChatPane }
}
