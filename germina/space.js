/**
 * [INPUT]: 依赖 node:fs/promises 与 node:path；无状态
 * [OUTPUT]: SPACE_MANIFEST/SPACE_TEMPLATE 常量、readSpaceManifest（缺失/损坏返回 null 不伪造）、writeSpaceManifest（字段长度上限、name 必填、context 浅合并）
 * [POS]: Space 语义的纯逻辑层；workspace-state.js 的 spaceRead/spaceWrite 调用。裁决：Space = 目录 + 本清单文件，不引入数据库（见 docs/OPTIMIZATION-ROADMAP.md 3.1）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export const SPACE_MANIFEST = 'germina.space.json'
export const SPACE_TEMPLATE = {
  version: 1,
  name: '',
  description: '',
  goal: '',
  context: { audience: '', style: '', terms: '', decisions: [], forbidden: [] },
  works: [],
  createdAt: '',
}
const LIMITS = { name: 80, description: 400, goal: 400 }

export async function readSpaceManifest(dirAbs) {
  try {
    const parsed = JSON.parse(await readFile(resolve(dirAbs, SPACE_MANIFEST), 'utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    if (parsed.version !== 1) return null
    return {
      ...SPACE_TEMPLATE,
      ...parsed,
      context: { ...SPACE_TEMPLATE.context, ...(parsed.context ?? {}) },
      works: Array.isArray(parsed.works) ? parsed.works : [],
      version: 1,
    }
  } catch {
    return null // 缺失/损坏/不可读 = 无 Space 语义，不伪造
  }
}

export async function writeSpaceManifest(dirAbs, patch = {}) {
  const current = (await readSpaceManifest(dirAbs)) ?? { ...SPACE_TEMPLATE, createdAt: new Date().toISOString() }
  const next = {
    ...current,
    ...(typeof patch.name === 'string' ? { name: patch.name.slice(0, LIMITS.name) } : {}),
    ...(typeof patch.description === 'string' ? { description: patch.description.slice(0, LIMITS.description) } : {}),
    ...(typeof patch.goal === 'string' ? { goal: patch.goal.slice(0, LIMITS.goal) } : {}),
    ...(patch.context && typeof patch.context === 'object' && !Array.isArray(patch.context)
      ? { context: { ...current.context, ...patch.context } } : {}),
    ...(Array.isArray(patch.works)
      ? { works: patch.works.slice(0, 500).map((w) => ({
          path: String(w?.path ?? '').slice(0, 300),
          status: ['draft', 'in-progress', 'done'].includes(w?.status) ? w.status : 'draft',
          derivedFrom: Array.isArray(w?.derivedFrom) ? w.derivedFrom.slice(0, 20).map((x) => String(x).slice(0, 300)) : [],
        })).filter((w) => w.path) } : {}),
    version: 1,
  }
  if (!next.name.trim()) throw new Error('Space name is required')
  await writeFile(resolve(dirAbs, SPACE_MANIFEST), `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return next
}
