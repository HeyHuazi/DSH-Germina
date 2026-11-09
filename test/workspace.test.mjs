/**
 * [INPUT]: 依赖 germina/client-workspace.js 的文档引用、布局与目录会话函数
 * [OUTPUT]: 验证草稿引用、布局、会话创建去重及只读欢迎标签
 * [POS]: 工作台逻辑回归；不模拟宿主 UI 或实际聊天发送
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../germina/client-workspace.js', import.meta.url), 'utf8')
function helper(name) {
  const begin = source.indexOf(`    function ${name}(`)
  assert.notEqual(begin, -1, `${name} is available`)
  const end = source.indexOf('\n    }', begin) + 6
  return new Function(`return (${source.slice(begin, end).trim()})`)()
}

test('document reference includes draft content and source, without submitting it', () => {
  const context = helper('documentContext')({ path: 'notes/article.md', content: '# Draft\nUnsaved ideas' }, '')
  assert.ok(context.includes('notes/article.md'))
  assert.ok(context.includes('# Draft\nUnsaved ideas'))
})
test('selected text reference only includes the selected passage', () => {
  const context = helper('documentContext')({ path: 'article.md', content: 'private full draft' }, 'Selected paragraph')
  assert.ok(context.includes('Selected paragraph'))
  assert.ok(!context.includes('private full draft'))
})
test('empty document references are rejected', () => {
  const context = helper('documentContext')
  assert.equal(context(null, ''), '')
  assert.equal(context({ path: 'empty.md', content: '' }, ''), '')
})
test('references preserve document content including delimiter-like text', () => {
  const text = '```\n<document>\n中文 😀'
  assert.ok(helper('documentContext')({ path: '稿件.md', content: text }, '').includes(text))
})

test('repeated edit, split, and preview transitions expose the expected panes', () => {
  const layout = helper('editorLayout')
  for (const kind of ['markdown', 'json', 'html']) {
    for (const mode of ['edit', 'split', 'preview', 'split', 'edit', 'preview', 'edit']) {
      const state = layout(kind, mode, 0.5)
      assert.equal(state.mode, mode)
      assert.equal(state.editor, mode !== 'preview')
      assert.equal(state.preview, mode !== 'edit')
      assert.equal(state.split, mode === 'split')
      assert.ok(state.editor || state.preview, `${kind}/${mode} must never have a blank canvas`)
    }
  }
})
test('opening a plain-text file from preview or split keeps the file editable', () => {
  const layout = helper('editorLayout')
  for (const kind of ['text', 'unknown', undefined]) {
    for (const mode of ['preview', 'split', 'edit']) {
      const state = layout(kind, mode, 0.5)
      assert.equal(state.mode, 'edit')
      assert.equal(state.editor, true)
      assert.equal(state.preview, false)
      assert.equal(state.split, false)
    }
  }
})
test('dragged split widths are finite and bounded, single views use the full column', () => {
  const layout = helper('editorLayout')
  for (const ratio of [0, 0.2, 0.5, 0.8, 1, NaN, Infinity, undefined]) {
    const split = layout('markdown', 'split', ratio)
    assert.ok(split.ratio >= 0.2 && split.ratio <= 0.8)
    assert.ok(!/NaN|Infinity/.test(split.columns))
    assert.equal(layout('markdown', 'edit', ratio).columns, 'minmax(0, 1fr)')
    assert.equal(layout('markdown', 'preview', ratio).columns, 'minmax(0, 1fr)')
  }
})

function sessionFixture() {
  const byId = { global: { id: 'global', cwd: '/a', retainedBy: { mainView: 1 } } }
  let root = '/a'
  const bindings = {}
  let creates = 0
  let failBind = false
  const sessions = {
    list: { getSnapshot: () => ({ phase: 'ready', byId }) },
    async refresh() {},
    async create({ cwd }) {
      const id = `dedicated-${++creates}`
      byId[id] = { id, cwd }
      return id
    },
  }
  const requestApi = async (payload) => {
    if (payload.op === 'workspace') return { body: { ok: true, root, sessionId: bindings[root] || null } }
    if (failBind) return { status: 500, body: { ok: false, error: 'disk full' } }
    if (root !== payload._workspaceRoot) return { status: 409, body: { ok: false, error: 'folder changed' } }
    bindings[root] = payload.sessionId
    return { body: { ok: true, root, sessionId: payload.sessionId } }
  }
  return { byId, bindings, sessions, requestApi, get creates() { return creates }, setRoot(value) { root = value }, failBind(value) { failBind = value } }
}

test('folder session creation never borrows the global selected conversation', async () => {
  const f = sessionFixture()
  const ensure = helper('createFolderSessions')(f)
  assert.equal(await ensure('/a'), 'dedicated-1')
  assert.equal(await ensure('/a'), 'dedicated-1')
  f.setRoot('/b')
  assert.equal(await ensure('/b'), 'dedicated-2')
  f.setRoot('/a')
  assert.equal(await ensure('/a'), 'dedicated-1')
  assert.equal(f.creates, 2)
})
test('concurrent mounts create only one folder conversation', async () => {
  const f = sessionFixture()
  const ensure = helper('createFolderSessions')(f)
  assert.deepEqual(await Promise.all([ensure('/a'), ensure('/a'), ensure('/a')]), ['dedicated-1', 'dedicated-1', 'dedicated-1'])
  assert.equal(f.creates, 1)
})
test('failed persistence retries the created session instead of creating another', async () => {
  const f = sessionFixture()
  const ensure = helper('createFolderSessions')(f)
  f.failBind(true)
  await assert.rejects(ensure('/a'), /disk full/)
  f.failBind(false)
  assert.equal(await ensure('/a'), 'dedicated-1')
  assert.equal(f.creates, 1)
})
test('missing bound conversation is replaced without borrowing unrelated history', async () => {
  const f = sessionFixture()
  f.bindings['/a'] = 'deleted'
  assert.equal(await helper('createFolderSessions')(f)('/a'), 'dedicated-1')
})
test('wrong-directory binding fails closed instead of showing another folder history', async () => {
  const f = sessionFixture()
  f.bindings['/a'] = 'wrong'
  f.byId.wrong = { id: 'wrong', cwd: '/b' }
  await assert.rejects(helper('createFolderSessions')(f)('/a'), /another directory/)
  assert.equal(f.creates, 0)
})
test('welcome and outdated folder requests create no sessions', async () => {
  const f = sessionFixture()
  const ensure = helper('createFolderSessions')(f)
  await assert.rejects(ensure(null), /Choose a folder/)
  await assert.rejects(ensure('/b'), /Folder changed/)
  assert.equal(f.creates, 0)
})
test('pending Host catalog cannot be treated as a deleted session', async () => {
  const f = sessionFixture()
  f.sessions.list.getSnapshot = () => ({ phase: 'pending', byId: {} })
  await assert.rejects(helper('createFolderSessions')(f)('/a'), /not ready/)
  assert.equal(f.creates, 0)
})
test('welcome document is virtual, read-only and clean', () => {
  const tab = helper('welcomeTab')('# Germina\nWhere ideas grow.')
  assert.equal(tab.readOnly, true)
  assert.equal(tab.content, tab.orig)
  assert.equal(tab.path, 'germina:welcome')
  assert.equal(tab.kind, 'markdown')
})
