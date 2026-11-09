/**
 * [INPUT]: 依赖 node:fs/promises 与 node:path 的纯文件操作
 * [OUTPUT]: resolveWithinRoot 路径安全栅栏 + handleApi(list/tree/read/write/delete/setRoot) 纯逻辑；
 *           write/delete 拒绝根自身（400），delete 目标缺失返回 404
 * [POS]: germina 插件的核心语义层；Host 入口(index.js)只做装配，
 *        Client(client.js)经 webServer exact 路由调用 handleApi
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { stat, readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises'
import { resolve, join, relative, isAbsolute, basename } from 'node:path'

/** 文本判定：扩展名白名单 + NUL 字节探测（前 8KB 内出现 NUL 视为二进制）。 */
const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.mdx', '.json', '.jsonc', '.yaml', '.yml', '.toml',
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte',
  '.css', '.scss', '.less', '.html', '.htm', '.xml', '.svg',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift', '.dart', '.lua',
  '.c', '.h', '.cpp', '.hpp', '.sh', '.bash', '.zsh', '.fish', '.ps1',
  '.sql', '.graphql', '.env', '.ini', '.cfg', '.conf', '.properties', '.log', '.csv',
])
const NO_EXTENSION_TEXT = new Set([
  'LICENSE', 'README', 'CHANGELOG', 'NOTICE', 'Makefile', 'Dockerfile',
  'Procfile', 'Vagrantfile', 'Gemfile', 'Rakefile', '.gitignore', '.gitattributes',
  '.editorconfig', '.npmrc', '.nvmrc', '.env',
])

function looksTextual(name, head) {
  if (head.includes(0)) return false
  if (NO_EXTENSION_TEXT.has(name)) return true
  const dot = name.lastIndexOf('.')
  if (dot > 0) return TEXT_EXTENSIONS.has(name.slice(dot).toLowerCase())
  return !head.some((b) => b === 0)
}

/** tree 扫描时跳过的目录名（依赖、版本控制、构建产物）。 */
const SKIP_DIRS = new Set(['node_modules', '.git', '.DS_Store', 'dist', 'build', '.next', '.cache'])

/**
 * 把 root 内的相对路径解析为绝对路径；逃逸、绝对外部路径、非字符串一律抛错。
 * 单参调用（resolveWithinRoot(absolutePath)）把该绝对路径当 root 本身校验。
 * @param {string} root 仓库根（绝对路径）
 * @param {string} [path] 相对路径（'' 或缺省表示根）
 * @returns {string} 绝对路径
 */
export function resolveWithinRoot(root, path = '') {
  if (typeof path !== 'string') throw new Error(`invalid path: ${String(path)}`)
  if (isAbsolute(path)) throw new Error(`absolute path rejected: ${path}`)
  const base = resolve(root)
  const abs = resolve(base, path)
  const rel = relative(base, abs)
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`path outside root: ${path}`)
  return abs
}

/** 扩展名 → 文件类型（决定 Client 端编辑器/预览行为）。 */
const KIND_BY_EXT = {
  md: 'markdown', markdown: 'markdown', mdx: 'markdown',
  json: 'json', jsonc: 'json',
  html: 'html', htm: 'html', svg: 'html',
}

export function kindOf(name) {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return 'text'
  return KIND_BY_EXT[name.slice(dot + 1).toLowerCase()] ?? 'text'
}

function json(res) {
  return { status: res.status, headers: { 'content-type': 'application/json; charset=utf-8' }, body: res.body }
}

/** 递归扫描一棵目录树（深度上限 maxDepth，目录优先排序）。 */
async function scanTree(abs, prefix, maxDepth, out, stats) {
  if (stats.count > 4000) return
  let entries
  try {
    entries = await readdir(abs, { withFileTypes: true })
  } catch {
    return
  }
  const sorted = [...entries].sort((a, b) => {
    const ad = a.isDirectory(), bd = b.isDirectory()
    if (ad !== bd) return ad ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  for (const e of sorted) {
    if (stats.count++ > 4000) return
    const rel = prefix ? `${prefix}/${e.name}` : e.name
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue
      out.push({ path: rel, name: e.name, type: 'dir' })
      if (maxDepth > 1) await scanTree(join(abs, e.name), rel, maxDepth - 1, out, stats)
    } else if (e.isFile()) {
      out.push({ path: rel, name: e.name, type: 'file' })
    }
  }
}

/**
 * 处理一条 vault API 请求（纯逻辑，不触碰 HTTP）。
 * root 信息由 index.js 注入：body._root 存在时校验并使用之（setRoot 流程），
 * 否则使用构造时的 root。
 * @param {string} root
 * @param {number} maxBytes 读写上限
 * @param {{op:string, path?:string, content?:string, _root?:string, maxDepth?:number}} body
 * @returns {Promise<{status:number, headers:object, body:object}>}
 */
export async function handleApi(root, maxBytes, body) {
  try {
    if (!body || typeof body.op !== 'string') {
      return json({ status: 400, body: { ok: false, error: 'missing op' } })
    }

    /* setRoot：切换工作根目录（由用户在 UI 里经 uiWorkspace.pickDirectory 选出，
       Host 端校验存在且为目录后持久化）。 */
    if (body.op === 'setRoot') {
      if (typeof body._root !== 'string' || !body._root.trim()) {
        return json({ status: 400, body: { ok: false, error: 'missing _root' } })
      }
      const candidate = resolve(body._root)
      const info = await stat(candidate).catch(() => undefined)
      if (!info) return json({ status: 404, body: { ok: false, error: 'folder not found' } })
      if (!info.isDirectory()) return json({ status: 400, body: { ok: false, error: 'not a folder' } })
      return json({ status: 200, body: { ok: true, root: candidate, name: basename(candidate) || candidate } })
    }

    const abs = resolveWithinRoot(root, body.path ?? '')
    /* 根自身只许 list/tree/read：write/delete 到根一律 400，杜绝清空整个 vault */
    const isRoot = abs === resolve(root)

    if (body.op === 'list') {
      let entries
      try {
        entries = await readdir(abs, { withFileTypes: true })
      } catch (err) {
        if (err.code === 'ENOENT') return json({ status: 404, body: { ok: false, error: 'not found' } })
        if (err.code === 'ENOTDIR') return json({ status: 400, body: { ok: false, error: 'not a directory' } })
        throw err
      }
      const out = []
      const sorted = [...entries].sort((a, b) => {
        const ad = a.isDirectory(), bd = b.isDirectory()
        if (ad !== bd) return ad ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      for (const e of sorted) {
        if (e.isDirectory()) {
          if (SKIP_DIRS.has(e.name)) continue
          out.push({ name: e.name, type: 'dir' })
        }
      }
      for (const e of sorted) {
        if (e.isFile()) {
          let size
          try {
            size = (await stat(join(abs, e.name))).size
          } catch { size = undefined }
          out.push({ name: e.name, type: 'file', size, kind: kindOf(e.name) })
        }
      }
      return json({ status: 200, body: { ok: true, entries: out } })
    }

    if (body.op === 'tree') {
      const maxDepth = Math.min(Math.max(Number(body.maxDepth) || 6, 1), 12)
      const out = []
      await scanTree(abs, body.path ?? '', maxDepth, out, { count: 0 })
      return json({ status: 200, body: { ok: true, entries: out } })
    }

    if (body.op === 'read') {
      let info
      try {
        info = await stat(abs)
      } catch (err) {
        if (err.code === 'ENOENT') return json({ status: 404, body: { ok: false, error: 'not found' } })
        throw err
      }
      if (info.isDirectory()) return json({ status: 400, body: { ok: false, error: 'is a directory' } })
      if (info.size > maxBytes) return json({ status: 413, body: { ok: false, error: 'file too large' } })
      const buf = await readFile(abs)
      if (!looksTextual(basename(abs), buf.subarray(0, 8192))) {
        return json({ status: 415, body: { ok: false, error: 'binary file not supported' } })
      }
      return json({ status: 200, body: { ok: true, path: body.path, size: info.size, content: buf.toString('utf8'), kind: kindOf(basename(abs)) } })
    }

    if (body.op === 'write') {
      if (typeof body.content !== 'string') {
        return json({ status: 400, body: { ok: false, error: 'missing content' } })
      }
      if (isRoot) return json({ status: 400, body: { ok: false, error: 'cannot write vault root' } })
      if (Buffer.byteLength(body.content, 'utf8') > maxBytes) {
        return json({ status: 413, body: { ok: false, error: 'content too large' } })
      }
      const dir = resolve(abs, '..')
      await mkdir(dir, { recursive: true })
      await writeFile(abs, body.content, 'utf8')
      return json({ status: 200, body: { ok: true, path: body.path } })
    }

    if (body.op === 'delete') {
      if (!body.path) return json({ status: 400, body: { ok: false, error: 'missing path' } })
      if (isRoot) return json({ status: 400, body: { ok: false, error: 'cannot delete vault root' } })
      try {
        await rm(abs, { recursive: true, force: false })
      } catch (err) {
        if (err.code === 'ENOENT') return json({ status: 404, body: { ok: false, error: 'not found' } })
        throw err
      }
      return json({ status: 200, body: { ok: true, path: body.path } })
    }

    return json({ status: 400, body: { ok: false, error: `unknown op: ${body.op}` } })
  } catch (err) {
    const outside = err instanceof Error && /outside|invalid path|absolute path/.test(err.message)
    return json({ status: outside ? 403 : 500, body: { ok: false, error: err.message ?? String(err) } })
  }
}
