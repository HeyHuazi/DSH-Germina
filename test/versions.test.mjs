/**
 * [INPUT]: node:test、node:assert/strict、node:fs 临时目录与 germina/versions.js
 * [OUTPUT]: 版本快照回归：写入/列表/读取、恢复前自动备份（restore-backup 入列且当前内容不丢）、
 *           路径编码防穿越（../ 与子目录）、超量清理到 50
 * [POS]: F07 版本管理回归；文件系统即真相原则验证
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { snapshotVersion, listVersions, readVersion, restoreVersion, encodeVersionDir } from '../germina/versions.js'

function scratch() {
  return mkdtempSync(join(tmpdir(), 'germina-ver-'))
}
test('snapshot, list, and read round-trip', async () => {
  const dir = scratch()
  try {
    const r = await snapshotVersion(dir, '稿件.md', '# v1 内容', '初稿')
    assert.equal(r.label, '初稿')
    const list = await listVersions(dir, '稿件.md')
    assert.equal(list.length, 1)
    assert.equal(await readVersion(dir, '稿件.md', list[0].ts), '# v1 内容')
    assert.ok(existsSync(join(dir, '.germina', 'versions', encodeVersionDir('稿件.md'), `${list[0].ts}.md`)))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
test('restore keeps current content as restore-backup and returns old content', async () => {
  const dir = scratch()
  try {
    await snapshotVersion(dir, 'notes/想法.md', '第一版')
    const backup = await restoreVersion(dir, 'notes/想法.md', (await listVersions(dir, 'notes/想法.md'))[0].ts, '当前未保存内容')
    assert.equal(backup, '第一版')
    const list = await listVersions(dir, 'notes/想法.md')
    assert.equal(list.length, 2)
    assert.ok(list[0].label.includes('restore-backup'))
    assert.equal(await readVersion(dir, 'notes/想法.md', list[0].ts), '当前未保存内容')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
test('path encoding prevents traversal via ..', () => {
  assert.ok(!encodeVersionDir('../../etc/passwd').includes('..'))
  assert.ok(encodeVersionDir('a/b.md').includes('__'))
})
test('snapshot count is capped at 50 per file, oldest dropped', async () => {
  const dir = scratch()
  try {
    for (let i = 0; i < 53; i++) await snapshotVersion(dir, '长寿命.md', `v${i}`)
    const list = await listVersions(dir, '长寿命.md')
    assert.equal(list.length, 50)
    assert.equal(list[0].label, '') // 最新的在前面
    assert.equal(await readVersion(dir, '长寿命.md', list[0].ts), 'v52')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
