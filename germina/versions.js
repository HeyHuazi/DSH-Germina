/**
 * [INPUT]: 依赖 node:fs/promises 与 node:path；复用 api.js 的 resolveWithinRoot 语义（由调用方传入 abs 栅栏后的路径）
 * [OUTPUT]: snapshotVersion（写快照 + 索引维护）、listVersions、readVersion、restoreVersion（恢复前自动备份当前）
 *          快照存储：<root>/.germina/versions/<编码后路径>/<ISO 时间戳>.md，索引 versions.json
 *          路径编码：relPath 的 / 与 . 替换为 __，防目录穿越；恢复前强制生成 restore-backup 快照
 * [POS]: F07 版本管理的纯逻辑层；workspace-state.js 的 versionList/versionSave/versionRestore/versionRead 调用。
 *        裁决依据：文件系统即真相（docs/OPTIMIZATION-ROADMAP.md 3.1）；不用 git，不用数据库
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { readFile, writeFile, mkdir, readdir, rename } from 'node:fs/promises'
import { resolve, join, basename } from 'node:path'

export const VERSIONS_DIR = '.germina'
const INDEX = 'versions.json'
const MAX_SNAPSHOTS_PER_FILE = 50

/** 相对路径 → 快照目录名（不含扩展名歧义：整段替换分隔符） */
export function encodeVersionDir(relPath) {
  return relPath.replaceAll('/', '__').replaceAll('.', '·') || '__root__'
}

function versionsRoot(rootAbs) {
  return resolve(rootAbs, VERSIONS_DIR, 'versions')
}

async function fileVersionsDir(rootAbs, relPath) {
  const dir = join(versionsRoot(rootAbs), encodeVersionDir(relPath))
  await mkdir(dir, { recursive: true })
  return dir
}

async function readIndex(rootAbs) {
  try {
    const parsed = JSON.parse(await readFile(resolve(versionsRoot(rootAbs), INDEX), 'utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed.files)) return { version: 1, files: {} }
    return parsed
  } catch {
    return { version: 1, files: {} }
  }
}

async function writeIndex(rootAbs, index) {
  const dir = versionsRoot(rootAbs)
  await mkdir(dir, { recursive: true })
  await writeFile(resolve(dir, INDEX), `${JSON.stringify(index, null, 2)}\n`, 'utf8')
}

const stamp = () => new Date().toISOString().replaceAll(':', '-')

/** 写一份快照；超量时丢弃最旧的（索引与磁盘同步清理）。 */
export async function snapshotVersion(rootAbs, relPath, content, label = '') {
  const dir = await fileVersionsDir(rootAbs, relPath)
  const ts = stamp()
  const file = join(dir, `${ts}.md`)
  await writeFile(file, content, 'utf8')
  const index = await readIndex(rootAbs)
  const key = encodeVersionDir(relPath)
  const list = index.files[key] ?? []
  list.unshift({ ts, label: String(label).slice(0, 120), bytes: Buffer.byteLength(content, 'utf8') })
  while (list.length > MAX_SNAPSHOTS_PER_FILE) {
    const dropped = list.pop()
    await rename(join(dir, `${dropped.ts}.md`), join(dir, `${dropped.ts}.md.del`)).catch(() => {})
  }
  index.files[key] = list
  await writeIndex(rootAbs, index)
  return { ts, label, total: list.length }
}

export async function listVersions(rootAbs, relPath) {
  const index = await readIndex(rootAbs)
  return index.files[encodeVersionDir(relPath)] ?? []
}

export async function readVersion(rootAbs, relPath, ts) {
  return readFile(join(versionsRoot(rootAbs), encodeVersionDir(relPath), `${ts}.md`), 'utf8')
}

/** 恢复：先把当前内容存为 restore-backup 快照（恢复不覆盖历史），再返回旧内容供调用方写盘。 */
export async function restoreVersion(rootAbs, relPath, ts, currentContent) {
  const old = await readVersion(rootAbs, relPath, ts)
  await snapshotVersion(rootAbs, relPath, currentContent, `restore-backup · 恢复前自动备份 ${ts}`)
  return old
}
