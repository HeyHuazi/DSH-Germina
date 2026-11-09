/**
 * [INPUT]: 依赖 node:test 与 node:fs/promises；依赖 germina/api.js 的纯逻辑
 * [OUTPUT]: 路径安全（resolveWithinRoot）与 API 语义（list/read/write）断言
 * [POS]: germina 插件的冒烟测试；node --test test/germina.test.mjs
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm, readdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, basename } from 'node:path'
import { resolveWithinRoot, handleApi } from '../germina/api.js'

let root

test.before(async () => {
  root = await mkdtemp(join(tmpdir(), 'germina-'))
  await mkdir(join(root, 'docs'))
  await mkdir(join(root, 'docs', 'deep'))
  await writeFile(join(root, 'README.md'), '# hello\n')
  await writeFile(join(root, 'docs', 'note.txt'), '第一行\nsecond line\n')
  await writeFile(join(root, 'docs', 'deep', 'x.md'), 'deep content')
  await writeFile(join(root, 'cfg.json'), '{"a":1}')
  await writeFile(join(root, 'blob.bin'), Buffer.from([0x00, 0x01, 0x02]))
})

test.after(async () => {
  await rm(root, { recursive: true, force: true })
})

/* ------------------------------------------------------------------ */
/* resolveWithinRoot：路径安全                                          */
/* ------------------------------------------------------------------ */

test('root 内相对路径解析为绝对路径', () => {
  assert.equal(resolveWithinRoot(root, ''), resolve(root))
  assert.equal(resolveWithinRoot(root, 'docs/note.txt'), join(root, 'docs', 'note.txt'))
})

test('.. 逃逸被拒绝', () => {
  assert.throws(() => resolveWithinRoot(root, '../escape.txt'), /outside/)
  assert.throws(() => resolveWithinRoot(root, 'docs/../../escape'), /outside/)
})

test('指向 root 之外的绝对路径被拒绝', () => {
  assert.throws(() => resolveWithinRoot(root, '/etc/passwd'), /absolute/)
  assert.throws(() => resolveWithinRoot(root, '/'), /absolute/)
})

test('单参调用把绝对路径当作 root 本身，不抛错', () => {
  assert.equal(resolveWithinRoot('/etc'), '/etc')
})

test('null 与非字符串输入被拒绝', () => {
  assert.throws(() => resolveWithinRoot(root, null), /path/)
  assert.throws(() => resolveWithinRoot(root, 42), /path/)
})

/* ------------------------------------------------------------------ */
/* handleApi：list / read / write                                      */
/* ------------------------------------------------------------------ */

test('list 返回目录与文件，目录优先', async () => {
  const r = await handleApi(root, 1024 * 1024, { op: 'list', path: '' })
  assert.equal(r.status, 200)
  assert.deepEqual(r.body.entries.map((e) => e.name), ['docs', 'blob.bin', 'cfg.json', 'README.md'])
  assert.equal(r.body.entries[0].type, 'dir')
  assert.equal(r.body.entries[2].type, 'file')
})

test('list 子目录', async () => {
  const r = await handleApi(root, 1024 * 1024, { op: 'list', path: 'docs' })
  assert.equal(r.status, 200)
  assert.deepEqual(r.body.entries.map((e) => e.name), ['deep', 'note.txt'])
})

test('list 不存在的目录返回 404', async () => {
  const r = await handleApi(root, 1024 * 1024, { op: 'list', path: 'nope' })
  assert.equal(r.status, 404)
  assert.equal(r.body.ok, false)
})

test('read 返回 UTF-8 文本', async () => {
  const r = await handleApi(root, 1024 * 1024, { op: 'read', path: 'docs/note.txt' })
  assert.equal(r.status, 200)
  assert.equal(r.body.content, '第一行\nsecond line\n')
  assert.equal(r.body.path, 'docs/note.txt')
})

test('read 二进制文件被拒绝', async () => {
  const r = await handleApi(root, 1024 * 1024, { op: 'read', path: 'blob.bin' })
  assert.equal(r.status, 415)
  assert.equal(r.body.ok, false)
})

test('read 超过大小上限被拒绝', async () => {
  const r = await handleApi(root, 4, { op: 'read', path: 'docs/note.txt' })
  assert.equal(r.status, 413)
})

test('read 对目录返回 400', async () => {
  const r = await handleApi(root, 1024 * 1024, { op: 'read', path: 'docs' })
  assert.equal(r.status, 400)
})

test('write 在 root 内写入并落盘', async () => {
  const r = await handleApi(root, 1024 * 1024, {
    op: 'write', path: 'docs/new.md', content: '# 新文件',
  })
  assert.equal(r.status, 200)
  assert.equal(r.body.ok, true)
  const saved = await readdir(join(root, 'docs'))
  assert.ok(saved.includes('new.md'))
})

test('write 自动创建父目录', async () => {
  const r = await handleApi(root, 1024 * 1024, {
    op: 'write', path: 'a/b/c.txt', content: '嵌套',
  })
  assert.equal(r.status, 200)
})

test('write 逃逸被拒绝且不落盘', async () => {
  const r = await handleApi(root, 1024 * 1024, {
    op: 'write', path: '../escape.txt', content: 'bad',
  })
  assert.equal(r.status, 403)
  const parent = await readdir(resolve(root, '..'))
  assert.ok(!parent.some((n) => n.startsWith('escape.txt')))
})

test('write 缺少 content 报 400', async () => {
  const r = await handleApi(root, 1024 * 1024, { op: 'write', path: 'x.txt' })
  assert.equal(r.status, 400)
})

test('write 超过大小上限被拒绝', async () => {
  const r = await handleApi(root, 8, { op: 'write', path: 'big.txt', content: 'x'.repeat(64) })
  assert.equal(r.status, 413)
})

test('未知 op 报 400', async () => {
  const r = await handleApi(root, 1024 * 1024, { op: 'frobnicate' })
  assert.equal(r.status, 400)
})

test('缺失 op 报 400', async () => {
  const r = await handleApi(root, 1024 * 1024, {})
  assert.equal(r.status, 400)
})

/* ------------------------------------------------------------------ */
/* v2：tree / delete / setRoot / kind                                  */
/* ------------------------------------------------------------------ */

test('tree 返回嵌套条目并跳过 node_modules', async () => {
  const r = await handleApi(root, 65536, { op: 'tree', path: '' })
  assert.equal(r.status, 200)
  assert.equal(r.body.ok, true)
  const paths = r.body.entries.map((e) => e.path)
  assert.ok(paths.includes('docs/note.txt'))
  assert.ok(paths.includes('docs/deep/x.md'))
  assert.ok(paths.includes('README.md'))
  assert.ok(!paths.some((p) => p.includes('node_modules')))
})

test('read 返回 kind 分类', async () => {
  const r = await handleApi(root, 65536, { op: 'read', path: 'docs/deep/x.md' })
  assert.equal(r.body.kind, 'markdown')
  const j = await handleApi(root, 65536, { op: 'read', path: 'cfg.json' })
  assert.equal(j.body.kind, 'json')
})

test('delete 删除文件', async () => {
  const w = await handleApi(root, 65536, { op: 'write', path: 'tmp/del.txt', content: 'x' })
  assert.equal(w.body.ok, true)
  const d = await handleApi(root, 65536, { op: 'delete', path: 'tmp/del.txt' })
  assert.equal(d.body.ok, true)
  const r = await handleApi(root, 65536, { op: 'read', path: 'tmp/del.txt' })
  assert.equal(r.status, 404)
})

test('setRoot 校验目录存在', async () => {
  const ok = await handleApi(root, 65536, { op: 'setRoot', _root: root })
  assert.equal(ok.body.ok, true)
  assert.equal(ok.body.name, basename(root))
  const missing = await handleApi(root, 65536, { op: 'setRoot', _root: '/nonexistent/xyz' })
  assert.equal(missing.status, 404)
  const file = await handleApi(root, 65536, { op: 'setRoot', _root: join(root, 'README.md') })
  assert.equal(file.status, 400)
})

test('setRoot 缺参报 400', async () => {
  const r = await handleApi(root, 65536, { op: 'setRoot' })
  assert.equal(r.status, 400)
})

/* ------------------------------------------------------------------ */
/* v3：delete 语义护栏 / write 根护栏 / tree 深度限制                    */
/* ------------------------------------------------------------------ */

test('delete 不存在的路径返回 404 而非 500', async () => {
  const r = await handleApi(root, 65536, { op: 'delete', path: 'ghost.txt' })
  assert.equal(r.status, 404)
  assert.equal(r.body.ok, false)
})

test('delete 拒绝删除根自身（path="."）', async () => {
  const r = await handleApi(root, 65536, { op: 'delete', path: '.' })
  assert.equal(r.status, 400)
  assert.equal(r.body.ok, false)
  /* 根目录必须完好 */
  const l = await handleApi(root, 65536, { op: 'list', path: '' })
  assert.equal(l.body.ok, true)
})

test('delete 递归删除目录及其内容', async () => {
  await handleApi(root, 65536, { op: 'write', path: 'dod/a.txt', content: 'x' })
  const d = await handleApi(root, 65536, { op: 'delete', path: 'dod' })
  assert.equal(d.body.ok, true)
  const r = await handleApi(root, 65536, { op: 'read', path: 'dod/a.txt' })
  assert.equal(r.status, 404)
})

test('write 拒绝写入根自身（path="."）', async () => {
  const r = await handleApi(root, 65536, { op: 'write', path: '.', content: 'x' })
  assert.equal(r.status, 400)
})

test('write 绝对路径被拒绝且不落盘', async () => {
  const target = join(tmpdir(), 'germina-escape-test.txt')
  const r = await handleApi(root, 65536, { op: 'write', path: target, content: 'bad' })
  assert.equal(r.status, 403)
  const info = await stat(target).catch(() => undefined)
  assert.equal(info, undefined)
})

test('list 对文件路径返回 400', async () => {
  const r = await handleApi(root, 65536, { op: 'list', path: 'README.md' })
  assert.equal(r.status, 400)
})

test('tree 深度受 maxDepth 限制', async () => {
  let deep = 'chain'
  for (let i = 0; i < 14; i++) deep += `/d${i}`
  await mkdir(join(root, deep), { recursive: true })
  await writeFile(join(root, deep, 'end.txt'), 'x')
  const r = await handleApi(root, 65536, { op: 'tree', path: 'chain', maxDepth: 3 })
  assert.equal(r.status, 200)
  /* 段数含 'chain' 前缀：真实深度 = 段数 - 1，不得超过 maxDepth */
  const maxDepthSeen = Math.max(...r.body.entries.map((e) => e.path.split('/').length - 1))
  assert.ok(maxDepthSeen <= 3, `depth ${maxDepthSeen} > 3`)
})
