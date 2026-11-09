/**
 * [INPUT]: 依赖 germina/vendor/client-ui.js、client-ui.css、client-ui.LICENSES.md 产物与 React 18.3.1
 * [OUTPUT]: 校验 coss 产物可复用宿主 React 渲染、ref 转发、JSX runtime 模式与静态子元素校验、导出齐全、CSS 作用域与许可
 * [POS]: test 的 client-ui 冒烟集；构建脚本改产物结构时此处必须同步
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const vendorDir = resolve(dirname(fileURLToPath(import.meta.url)), '../germina/vendor')

async function loadUI() {
  const source = await readFile(resolve(vendorDir, 'client-ui.js'), 'utf8')
  return new Function('require', `${source}\nreturn __germinaUI;`)((name) => {
    if (name === 'react') return React
    throw new Error(`unexpected require: ${name}`)
  })
}

test('client-ui.js 使用 DSH React 18.3.1 渲染 coss Button 与 Tabs', async () => {
  assert.equal(React.version, '18.3.1')
  const ui = await loadUI()
  for (const key of ['Button', 'Tabs', 'TabsList', 'TabsTab', 'TabsPanel',
    'Dialog', 'DialogTrigger', 'DialogPopup', 'DialogHeader', 'DialogTitle',
    'DialogDescription', 'DialogPanel', 'DialogFooter', 'DialogClose', 'buttonVariants']) {
    assert.ok(ui[key], `产物缺少导出: ${key}`)
  }
  assert.equal(ui.Button.$$typeof, Symbol.for('react.forward_ref'), 'Button 必须向 Base UI 转发 ref')
  const h = React.createElement
  const button = renderToStaticMarkup(h(ui.Button, { size: 'sm', disabled: true }, '保存'))
  assert.match(button, /<button[^>]*disabled/)
  assert.match(button, /保存<\/button>/)
  const tabs = renderToStaticMarkup(h(ui.Tabs, { defaultValue: 'edit' },
    h(ui.TabsList, null, h(ui.TabsTab, { value: 'edit' }, '编辑')),
    h(ui.TabsPanel, { value: 'edit' }, '编辑区')))
  assert.match(tabs, /编辑/)
  assert.match(tabs, /编辑区/)
})

test('官方 JSX runtime 匹配宿主 React 模式并保留静态子元素验证', async () => {
  const ui = await loadUI()
  const popup = ui.DialogPopup({ children: '内容' })
  const development = '_store' in React.createElement('span')
  assert.equal('_store' in popup, development, 'JSX runtime 必须匹配宿主开发/生产模式')
  const children = popup.props.children
  assert.ok(Array.isArray(children), 'Dialog Portal 应组合遮罩与视口')
  if (development) {
    for (const child of children) {
      assert.equal(child._store.validated, true, '静态兄弟元素不能误报缺少 key')
    }
  }
})

test('client-ui.css 限域于 Germina 且无全局 body 重置', async () => {
  const css = await readFile(resolve(vendorDir, 'client-ui.css'), 'utf8')
  assert.ok(css.length > 1000, 'CSS 产物过小')
  assert.ok(css.includes('--primary'), '缺少 --primary 令牌')
  assert.ok(css.includes('--radius'), '缺少 --radius 令牌')
  assert.match(css, /\.germina-root \.flex/)
  assert.match(css, /@layer theme\{\.germina-root/)
  assert.doesNotMatch(css, /\.germina-root :(?:root|host)/)
  assert.doesNotMatch(css, /(^|[,{])body\s*\{/)
})

test('client-ui.LICENSES.md 汇总了依赖许可', async () => {
  const notice = await readFile(resolve(vendorDir, 'client-ui.LICENSES.md'), 'utf8')
  for (const name of ['coss/ui', '## react v18.3.1', '@base-ui/react', 'class-variance-authority', 'clsx', 'tailwind-merge', 'lucide-react']) {
    assert.ok(notice.includes(name), `许可汇总缺少 ${name}`)
  }
})
