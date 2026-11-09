/**
 * [INPUT]: 依赖固定版本 Lucide 上游 SVG 与 germina/client.js 内联标记区
 * [OUTPUT]: 同步本地图标 JSON、ISC 许可与浏览器内联副本
 * [POS]: 开发期维护脚本；不参与插件运行，不引入构建步骤
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const version = '0.468.0'
const upstream = `https://raw.githubusercontent.com/lucide-icons/lucide/${version}`
const names = ['panel-left', 'panel-right', 'panels-top-left', 'folder', 'folder-open', 'folder-plus', 'file-text', 'file-code-2', 'file-json-2', 'file', 'search', 'plus', 'refresh-cw', 'x', 'chevron-right', 'chevron-down', 'save', 'check', 'pencil-line', 'columns-2', 'eye', 'trash-2', 'message-square', 'sparkles', 'quote', 'arrow-up-right', 'circle-alert', 'loader-circle', 'keyboard', 'text-cursor-input']
const root = new URL('../germina/', import.meta.url)
async function get(path) {
  const response = await fetch(`${upstream}/${path}`, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response.text()
}
const icons = {}
// Use official, pinned SVG geometry; only static SVG primitives may enter the subset.
for (let at = 0; at < names.length; at += 4) {
  await Promise.all(names.slice(at, at + 4).map(async (name) => {
    const svg = await get(`icons/${name}.svg`)
    const nodes = [...svg.matchAll(/<(path|rect|circle|line|polyline|polygon|ellipse)\s+([^>]*?)\s*\/>/g)].map(([, tag, raw]) => {
      const attrs = Object.fromEntries([...raw.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value]))
      assert(!Object.keys(attrs).some((key) => /^on/i.test(key)))
      return [tag, attrs]
    })
    assert(nodes.length, `SVG geometry required for ${name}`)
    icons[name] = nodes
  }))
}
const sorted = Object.fromEntries(names.map((name) => [name, icons[name]]))
await mkdir(new URL('vendor/', root), { recursive: true })
await writeFile(new URL('vendor/lucide-icons.json', root), JSON.stringify({ version, source: upstream, icons: sorted }, null, 2) + '\n')
await writeFile(new URL('vendor/lucide.LICENSE', root), await get('LICENSE'))
const clientPath = new URL('client.js', root)
const source = await readFile(clientPath, 'utf8')
const marker = /\/\* LUCIDE_SUBSET_START \*\/[\s\S]*?\/\* LUCIDE_SUBSET_END \*\//
assert(marker.test(source), 'Client must declare the inline Lucide subset markers')
await writeFile(clientPath, source.replace(marker, `/* LUCIDE_SUBSET_START */\n    // Lucide ${version}, ISC; full notice: vendor/lucide.LICENSE.\n    const ICONS = ${JSON.stringify(sorted)}\n    /* LUCIDE_SUBSET_END */`))
console.log(`Vendored ${names.length} Lucide ${version} icons, upstream license, and inline geometry.`)
