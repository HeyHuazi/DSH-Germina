/**
 * [INPUT]: 依赖 node:test、临时文件系统与 germina 的 Host/API 源码
 * [OUTPUT]: 验证品牌、目录与会话状态、过期请求拒绝及 UI 固定资产路由
 * [POS]: Host 集成回归；每例复制插件到临时目录，不触碰用户状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, copyFile, writeFile, readFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Readable } from 'node:stream'

async function fixture(t, states = {}, route, configuredRoot) {
  const base = await mkdtemp(join(tmpdir(), 'germina-host-'))
  t.after(() => rm(base, { recursive: true, force: true }))
  const initial = join(base, 'initial')
  const saved = join(base, 'saved root 中文')
  await mkdir(initial)
  await mkdir(saved)
  await writeFile(join(initial, 'probe.txt'), initial)
  await writeFile(join(saved, 'probe.txt'), saved)
  for (const file of ['index.js', 'api.js', 'workspace-state.js', 'space.js', 'client-workspace.js', 'WELCOME.md', 'package.json']) {
    await copyFile(new URL(`../germina/${file}`, import.meta.url), join(base, file))
  }
  await mkdir(join(base, 'vendor'))
  for (const file of ['client-ui.js', 'client-ui.css']) {
    await copyFile(new URL(`../germina/vendor/${file}`, import.meta.url), join(base, 'vendor', file))
  }
  for (const [file, value] of Object.entries(states)) {
    await writeFile(join(base, file), typeof value === 'function' ? value({ base, initial, saved }) : value)
  }
  const host = await import(pathToFileURL(join(base, 'index.js')))
  assert.equal(host.name, 'germina')
  let registered
  const routes = new Map()
  host.apply({
    logger: { info() {}, warn() {} },
    effect(fn) { fn() },
    webServer: { register(value) { registered = value; routes.set(value.path, value) } },
  }, { root: configuredRoot ?? initial, ...(route ? { route } : {}) })
  assert.equal(registered.path, route || '/plugins/germina/api')
  async function request(body) {
    let status
    let result
    const req = Readable.from([Buffer.from(JSON.stringify(body))])
    req.method = 'POST'
    await registered.handler(req, {
      writeHead(code) { status = code },
      end(raw) { result = JSON.parse(raw) },
    })
    return { status, body: result }
  }
  return { base, initial, saved, request, routes }
}
const state = ({ saved }) => JSON.stringify({ root: saved })
const invalid = ({ base }) => JSON.stringify({ root: join(base, 'DSH-MarkFlow-missing') })

for (const [title, states, expected] of [
  ['no state uses configured root', {}, 'initial'],
  ['legacy state restores an existing directory unchanged', { 'markflow-root.json': state }, 'saved'],
  ['new state takes precedence over legacy state', { 'germina-root.json': state, 'markflow-root.json': invalid }, 'saved'],
  ['missing legacy directory uses configured root', { 'markflow-root.json': invalid }, 'initial'],
  ['malformed legacy state uses configured root', { 'markflow-root.json': '{' }, 'initial'],
  ['invalid new root does not revive a legacy root', { 'germina-root.json': invalid, 'markflow-root.json': state }, 'initial'],
  ['malformed new state does not revive a legacy root', { 'germina-root.json': '{', 'markflow-root.json': state }, 'initial'],
  ['file roots are rejected', { 'markflow-root.json': ({ base }) => JSON.stringify({ root: join(base, 'api.js') }) }, 'initial'],
]) {
  test(title, async (t) => {
    const f = await fixture(t, states)
    const result = await f.request({ op: 'read', path: 'probe.txt' })
    assert.equal(result.status, 200)
    assert.equal(result.body.content, f[expected])
  })
}

test('setRoot writes new state and leaves legacy bytes untouched', async (t) => {
  const f = await fixture(t, { 'markflow-root.json': state })
  const legacy = await readFile(join(f.base, 'markflow-root.json'), 'utf8')
  assert.equal((await f.request({ op: 'setRoot', _root: f.initial })).status, 200)
  assert.deepEqual(JSON.parse(await readFile(join(f.base, 'germina-root.json'), 'utf8')), { root: f.initial })
  assert.equal(await readFile(join(f.base, 'markflow-root.json'), 'utf8'), legacy)
})
test('custom Host route is retained', async (t) => {
  await fixture(t, {}, '/custom/germina/api')
})
test('package, Loader and Client share the Germina identity', async () => {
  const read = (file) => readFile(new URL(`../germina/${file}`, import.meta.url), 'utf8')
  assert.equal(JSON.parse(await read('package.json')).name, 'germina')
  const patch = await read('cordis.patch.yml')
  assert.match(patch, /id: germina/)
  assert.match(patch, /name: germina/)
  const client = await read('client.js')
  assert.match(client, /id: 'germina'/)
  assert.match(client, /const API_ROUTE = '\/plugins\/germina\/api'/)
  assert.match(client, /germina\.assistant/)
  assert.ok(!/markflow|MarkFlow|fv-/.test(client))
})

test('default dot root shows welcome and never exposes host cwd', async (t) => {
  const f = await fixture(t, {}, undefined, '.')
  const state = await f.request({ op: 'workspace' })
  assert.equal(state.body.root, null)
  assert.equal(state.body.sessionId, null)
  assert.match(state.body.welcome, /Where ideas grow\./)
  assert.match(state.body.welcome, /让想法，自由生长/)
  assert.equal((await f.request({ op: 'list' })).status, 409)
})
test('folder sessions survive A/B/A switching and Host reload', async (t) => {
  const f = await fixture(t)
  const bind = (root, sessionId, previousSessionId = null) => f.request({ op: 'bindSession', _workspaceRoot: root, sessionId, previousSessionId })
  assert.equal((await bind(f.initial, 'session-a')).body.sessionId, 'session-a')
  await f.request({ op: 'setRoot', _root: f.saved })
  assert.equal((await f.request({ op: 'workspace' })).body.sessionId, null)
  assert.equal((await bind(f.saved, 'session-b')).body.sessionId, 'session-b')
  assert.equal((await f.request({ op: 'setRoot', _root: f.initial })).body.sessionId, 'session-a')
  const { createWorkspaceHandler } = await import(pathToFileURL(join(f.base, 'workspace-state.js')))
  const restored = await createWorkspaceHandler(f.base)
  assert.equal((await restored({ op: 'workspace' })).body.sessionId, 'session-a')
  assert.deepEqual(JSON.parse(await readFile(join(f.base, 'germina-sessions.json'), 'utf8')).bindings, { [f.initial]: 'session-a', [f.saved]: 'session-b' })
})
test('stale folder operations cannot write or bind in the new folder', async (t) => {
  const f = await fixture(t)
  await f.request({ op: 'setRoot', _root: f.saved })
  for (const op of ['read', 'write', 'delete', 'bindSession', 'setRoot']) {
    const result = await f.request({ op, _workspaceRoot: f.initial, path: 'probe.txt', content: 'wrong folder', sessionId: 'wrong', _root: f.initial })
    assert.equal(result.status, 409, op)
  }
  assert.equal(await readFile(join(f.saved, 'probe.txt'), 'utf8'), f.saved)
})
test('one session cannot bind to two folders and stale binding cannot overwrite', async (t) => {
  const f = await fixture(t)
  await f.request({ op: 'bindSession', _workspaceRoot: f.initial, sessionId: 'a' })
  const stale = await f.request({ op: 'bindSession', _workspaceRoot: f.initial, sessionId: 'orphan' })
  assert.equal(stale.body.sessionId, 'a')
  await f.request({ op: 'setRoot', _root: f.saved })
  assert.equal((await f.request({ op: 'bindSession', _workspaceRoot: f.saved, sessionId: 'a' })).status, 409)
})
test('broken session state is reported and not overwritten', async (t) => {
  const f = await fixture(t, { 'germina-sessions.json': '{broken' })
  assert.ok((await f.request({ op: 'workspace' })).body.sessionError)
  assert.equal((await f.request({ op: 'bindSession', _workspaceRoot: f.initial, sessionId: 'a' })).status, 500)
  assert.equal(await readFile(join(f.base, 'germina-sessions.json'), 'utf8'), '{broken')
})

test('only fixed workspace and coss UI assets are served with matching MIME', async (t) => {
  const f = await fixture(t)
  const asset = f.routes.get('/plugins/germina/api/workspace.js')
  let status, headers, content
  await asset.handler({ method: 'GET' }, { writeHead(code, value) { status = code; headers = value }, end(value) { content = value } })
  assert.equal(status, 200)
  assert.match(headers['content-type'], /^text\/javascript/)
  assert.match(content, /export function createWorkspaceUI/)
  await asset.handler({ method: 'POST' }, { writeHead(code) { status = code }, end() {} })
  assert.equal(status, 405)
  for (const [file, mime] of [['client-ui.js', 'text/javascript'], ['client-ui.css', 'text/css']]) {
    const route = f.routes.get(`/plugins/germina/api/${file}`)
    await route.handler({ method: 'GET' }, { writeHead(code, value) { status = code; headers = value }, end(value) { content = value } })
    assert.equal(status, 200)
    assert.match(headers['content-type'], new RegExp(`^${mime}`))
    assert.ok(content.length > 1000)
    await route.handler({ method: 'POST' }, { writeHead(code) { status = code }, end() {} })
    assert.equal(status, 405)
  }
  assert.equal(f.routes.size, 4)
})
test('invalid legacy root plus default config remains in welcome mode', async (t) => {
  const f = await fixture(t, { 'markflow-root.json': invalid }, undefined, '.')
  assert.equal((await f.request({ op: 'workspace' })).body.root, null)
})
test('failed binding write is not reported as success', async (t) => {
  const f = await fixture(t)
  await mkdir(join(f.base, 'germina-sessions.json.tmp'))
  const result = await f.request({ op: 'bindSession', _workspaceRoot: f.initial, sessionId: 'a' })
  assert.equal(result.status, 500)
  assert.equal((await f.request({ op: 'workspace' })).body.sessionId, null)
})
