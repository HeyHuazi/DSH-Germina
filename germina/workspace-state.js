/**
 * [INPUT]: 依赖 api.js 的文件语义与包目录内的根目录、会话绑定及欢迎文档
 * [OUTPUT]: createWorkspaceHandler 提供目录选择、状态快照与文件夹会话绑定
 * [POS]: Host 的持久化边界；不创建宿主会话，不访问全局默认聊天
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { readFile, writeFile, rename, stat } from 'node:fs/promises'
import { resolve, basename } from 'node:path'
import { handleApi } from './api.js'
import { readSpaceManifest, writeSpaceManifest } from './space.js'
import { snapshotVersion, listVersions, readVersion, restoreVersion } from './versions.js'

const reply = (status, body) => ({ status, headers: { 'content-type': 'application/json; charset=utf-8' }, body })
const failure = (status, error) => reply(status, { ok: false, error })

export async function createWorkspaceHandler(packageDir, config = {}) {
  const stateFile = resolve(packageDir, 'germina-root.json')
  const legacyFile = resolve(packageDir, 'markflow-root.json')
  const sessionsFile = resolve(packageDir, 'germina-sessions.json')
  const welcome = await readFile(resolve(packageDir, 'WELCOME.md'), 'utf8')
  const directory = async (path) => {
    if (typeof path !== 'string' || !path.trim()) return null
    const abs = resolve(path)
    return (await stat(abs).catch(() => null))?.isDirectory() ? abs : null
  }
  // 默认的点路径不是用户选择，首次使用不读取宿主工作目录。
  let root = config.root && config.root !== '.' ? await directory(config.root) : null
  try {
    const text = await readFile(stateFile, 'utf8').catch((error) => {
      if (error.code !== 'ENOENT') throw error
      return readFile(legacyFile, 'utf8')
    })
    root = await directory(JSON.parse(text)?.root) || root
  } catch { /* 状态缺失或损坏：保留显式配置；无显式配置则进入欢迎页。 */ }

  let bindings = Object.create(null)
  let sessionError = ''
  try {
    const saved = JSON.parse(await readFile(sessionsFile, 'utf8'))
    if (saved.version !== 1 || !saved.bindings || Array.isArray(saved.bindings) || typeof saved.bindings !== 'object') throw new Error('invalid session bindings')
    const ids = new Set()
    for (const [key, id] of Object.entries(saved.bindings)) {
      if (resolve(key) !== key || typeof id !== 'string' || !id.trim() || ids.has(id)) throw new Error('invalid or shared session binding')
      bindings[key] = id
      ids.add(id)
    }
  } catch (error) {
    if (error.code !== 'ENOENT') sessionError = `Cannot read folder session bindings: ${error.message}`
  }
  const snapshot = () => ({ ok: true, root, name: root ? basename(root) || root : '', sessionId: root ? bindings[root] || null : null, sessionError, welcome })
  const persist = async (file, value) => {
    // Host 将请求串行化；临时文件替换避免中断时留下半个 JSON。
    await writeFile(`${file}.tmp`, JSON.stringify(value), 'utf8')
    await rename(`${file}.tmp`, file)
  }

  return async (body) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return failure(400, 'invalid request')
    if (body.op === 'workspace') return reply(200, snapshot())
    if ('_workspaceRoot' in body && body._workspaceRoot !== root) return failure(409, 'Folder changed. Reopen the current folder before continuing.')
    if (body.op === 'setRoot') {
      const checked = await handleApi(root || '.', config.maxFileBytes ?? 1024 * 1024, body)
      if (!checked.body.ok) return checked
      try {
        await persist(stateFile, { root: checked.body.root })
        root = checked.body.root
        return reply(200, snapshot())
      } catch (error) { return failure(500, `Cannot save folder selection: ${error.message}`) }
    }
    if (!root) return failure(409, 'Choose a folder first')
    if (body.op === 'spaceRead') {
      const manifest = await readSpaceManifest(root)
      return reply(200, { ok: true, space: manifest, path: root, initialized: manifest !== null })
    }
    if (body.op === 'spaceWrite') {
      try {
        const space = await writeSpaceManifest(root, body.patch ?? {})
        return reply(200, { ok: true, space })
      } catch (error) { return failure(400, `Cannot write Space manifest: ${error.message}`) }
    }
    // F07 版本管理：快照不经过正文 write 通道，避免与自动保存互相触发
    if (body.op === 'versionList') {
      if (typeof body.path !== 'string' || !body.path.trim()) return failure(400, 'missing path')
      try { return reply(200, { ok: true, versions: await listVersions(root, body.path) }) }
      catch (error) { return failure(500, `Cannot list versions: ${error.message}`) }
    }
    if (body.op === 'versionSave') {
      if (typeof body.path !== 'string' || !body.path.trim()) return failure(400, 'missing path')
      if (typeof body.content !== 'string') return failure(400, 'missing content')
      try {
        const r = await snapshotVersion(root, body.path, body.content, typeof body.label === 'string' ? body.label : '')
        return reply(200, { ok: true, ...r })
      } catch (error) { return failure(500, `Cannot snapshot: ${error.message}`) }
    }
    if (body.op === 'versionRead') {
      if (typeof body.path !== 'string' || typeof body.ts !== 'string') return failure(400, 'missing path or ts')
      try {
        const content = await readVersion(root, body.path, body.ts)
        return reply(200, { ok: true, content })
      } catch { return failure(404, 'version not found') }
    }
    if (body.op === 'versionRestore') {
      if (typeof body.path !== 'string' || typeof body.ts !== 'string') return failure(400, 'missing path or ts')
      if (typeof body.content !== 'string') return failure(400, 'missing current content')
      try {
        const content = await restoreVersion(root, body.path, body.ts, body.content)
        return reply(200, { ok: true, content })
      } catch { return failure(404, 'version not found') }
    }
    // F01 文档状态 + F06 来源关系：挂在 Space 清单的 works 区，不新增真相源
    if (body.op === 'worksWrite') {
      if (!Array.isArray(body.works)) return failure(400, 'missing works array')
      try {
        // Space 未初始化时先以目录名落一个清单，避免 works 无家可归
        const current = await readSpaceManifest(root)
        if (!current) await writeSpaceManifest(root, { name: basename(root) || 'Space' })
        const space = await writeSpaceManifest(root, { works: body.works })
        return reply(200, { ok: true, works: space.works ?? [] })
      } catch (error) { return failure(400, `Cannot save works: ${error.message}`) }
    }
    if (body.op === 'spaceRead') {
      const manifest = await readSpaceManifest(root)
      return reply(200, { ok: true, space: manifest, path: root, initialized: manifest !== null })
    }
    if (body.op === 'spaceWrite') {
      try {
        const space = await writeSpaceManifest(root, body.patch ?? {})
        return reply(200, { ok: true, space })
      } catch (error) { return failure(400, `Cannot write Space manifest: ${error.message}`) }
    }
    if (body.op === 'bindSession') {
      if (sessionError) return failure(500, sessionError)
      if (typeof body.sessionId !== 'string' || !body.sessionId.trim() || body._workspaceRoot !== root) return failure(400, 'invalid folder session binding')
      // 旧请求不得覆盖另一个窗口刚保存的绑定。
      if ((bindings[root] || null) !== (body.previousSessionId || null)) return reply(200, snapshot())
      if (Object.entries(bindings).some(([key, id]) => key !== root && id === body.sessionId)) return failure(409, 'A session cannot be shared across folders')
      const next = Object.assign(Object.create(null), bindings, { [root]: body.sessionId })
      try {
        await persist(sessionsFile, { version: 1, bindings: next })
        bindings = next
        return reply(200, snapshot())
      } catch (error) { return failure(500, `Cannot save folder session: ${error.message}`) }
    }
    return handleApi(root, config.maxFileBytes ?? 1024 * 1024, body)
  }
}
