/**
 * [INPUT]: node:test、node:assert/strict、node:fs 临时目录与 germina/space.js
 * [OUTPUT]: Space 清单读写回归：模板合并、缺字段容忍、损坏返回 null、name 必填、长度上限、context 浅合并、再读一致性
 * [POS]: Space 语义回归；文件系统即真相原则的直接验证
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readSpaceManifest, writeSpaceManifest, SPACE_MANIFEST, SPACE_TEMPLATE } from '../germina/space.js'

function scratch() {
  return mkdtempSync(join(tmpdir(), 'germina-space-'))
}
test('empty directory reads as null (no fake space)', async () => {
  const dir = scratch()
  try { assert.equal(await readSpaceManifest(dir), null) } finally { rmSync(dir, { recursive: true, force: true }) }
})
test('corrupt manifest reads as null instead of throwing', async () => {
  const dir = scratch()
  try {
    writeFileSync(join(dir, SPACE_MANIFEST), '{ broken json !!')
    assert.equal(await readSpaceManifest(dir), null)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
test('wrong version reads as null (forward compatibility)', async () => {
  const dir = scratch()
  try {
    writeFileSync(join(dir, SPACE_MANIFEST), JSON.stringify({ version: 99 }))
    assert.equal(await readSpaceManifest(dir), null)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
test('write creates manifest with defaults and persists round-trip', async () => {
  const dir = scratch()
  try {
    const space = await writeSpaceManifest(dir, { name: '研修班 2026', description: '苏州研修班素材与稿件' })
    assert.equal(space.name, '研修班 2026')
    assert.equal(space.version, 1)
    assert.ok(space.createdAt)
    assert.deepEqual(space.context, SPACE_TEMPLATE.context)
    const again = await readSpaceManifest(dir)
    assert.equal(again.name, '研修班 2026')
    assert.equal(again.createdAt, space.createdAt)
    assert.ok(readFileSync(join(dir, SPACE_MANIFEST), 'utf8').includes('"研修班 2026"'))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
test('write without name is rejected and leaves no file', async () => {
  const dir = scratch()
  try {
    await assert.rejects(() => writeSpaceManifest(dir, {}), /Space name is required/)
    assert.equal(await readSpaceManifest(dir), null)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
test('fields are length-capped and context shallow-merges', async () => {
  const dir = scratch()
  try {
    await writeSpaceManifest(dir, { name: 'A', description: 'first' })
    const space = await writeSpaceManifest(dir, {
      name: 'x'.repeat(200),
      description: 'second',
      context: { audience: '继续教育学员', forbidden: ['不得编造学时'] },
    })
    assert.equal(space.name.length, 80)
    assert.equal(space.description, 'second')
    assert.equal(space.context.audience, '继续教育学员')
    assert.deepEqual(space.context.forbidden, ['不得编造学时'])
    assert.equal(space.context.style, '') // 未提供的字段保持模板默认
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
