/**
 * [INPUT]: 依赖 dev-src/ 的 coss JSX/Tailwind 源码、Base UI、esbuild 与 CSS 作用域工具
 * [OUTPUT]: 产出 vendor/client-ui.js（外部化 React、内置匹配宿主 React 18 模式的官方 JSX runtime）及作用域 CSS；汇总许可；--watch 并行构建 JS/CSS
 * [POS]: scripts 的 coss 构建脚本；开发期运行，宿主使用同源静态产物
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { build } from 'esbuild'
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import postcss from 'postcss'
import prefixSelector from 'postcss-prefix-selector'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const outDir = resolve(root, 'germina/vendor')
const watch = process.argv.includes('--watch')
const require = createRequire(resolve(root, 'package.json'))

await mkdir(outDir, { recursive: true })

/* ---------- JS：esbuild 打包，react 外部化 ---------- */
const jsOptions = {
  entryPoints: [resolve(root, 'dev-src/index.ts')],
  bundle: true,
  jsx: 'automatic',
  format: 'iife',
  globalName: '__germinaUI',
  plugins: [{
    name: 'host-react',
    setup(build) {
      // external: ['react'] 会连带排除子路径；这里只复用宿主 React。
      build.onResolve({ filter: /^react$/ }, () => ({ path: 'react', external: true }))
      build.onLoad({ filter: /[/\\]react[/\\]jsx-runtime\.js$/ }, async ({ path }) => ({
        // React 18 开发元素含 _store；必须匹配宿主，保留静态子元素校验语义。
        contents: (await readFile(path, 'utf8')).replace(
          "process.env.NODE_ENV === 'production'",
          "!require('react').createElement('span')._store",
        ),
        loader: 'js',
      }))
      build.onLoad({ filter: /[/\\]react[/\\]cjs[/\\]react-jsx-runtime\.development\.js$/ }, async ({ path }) => ({
        contents: (await readFile(path, 'utf8')).replace('process.env.NODE_ENV !== "production"', 'true'),
        loader: 'js',
      }))
    },
  }],
  outfile: resolve(outDir, 'client-ui.js'),
  minify: !watch,
  metafile: !watch,
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
  banner: { js: '/* coss/ui (MIT) + Base UI (MIT) 编译产物；许可清单见 client-ui.LICENSES.md */' },
}
let jsContext
let bundledPackages
if (watch) {
  jsContext = await (await import('esbuild')).context(jsOptions)
  await jsContext.watch()
  console.log('[build-client] esbuild watch 已启动')
} else {
  const result = await build(jsOptions)
  bundledPackages = new Set(Object.keys(result.metafile.inputs).flatMap((file) => {
    const matches = [...file.matchAll(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)/g)]
    return matches.length ? [matches.at(-1)[1]] : []
  }))
}

/* ---------- CSS：Tailwind v4 静态编译 ---------- */
const cssSource = resolve(outDir, 'client-ui.css')
const cssArgs = [
  '-i', resolve(root, 'dev-src/styles/tailwind.css'),
  '-o', cssSource,
  '--content', resolve(root, 'dev-src/**/*.{ts,tsx}'),
  ...(watch ? ['-w'] : ['-m']),
]
const scopedCSS = async (css) => (await postcss([prefixSelector({
  prefix: '.germina-root',
  transform(prefix, selector) {
    if (selector === ':root' || selector === ':host') return prefix
    if (selector.startsWith(prefix)) return selector
    return `${prefix} ${selector}`
  },
})]).process(css, { from: undefined })).css
const scopeCSS = async () => writeFile(cssSource, await scopedCSS(await readFile(cssSource, 'utf8')))
if (watch) {
  // Tailwind watch 写入临时文件；每次更新后限域并写入最终 CSS。
  const watchOutput = resolve(outDir, 'client-ui.watch.css')
  cssArgs[cssArgs.indexOf(cssSource)] = watchOutput
  const child = spawn(resolve(root, 'node_modules/.bin/tailwindcss'), cssArgs, { stdio: 'inherit', cwd: root })
  const { watch: watchFile } = await import('node:fs')
  const watcher = watchFile(outDir, async (_event, filename) => {
    if (filename !== 'client-ui.watch.css') return
    try {
      const css = await readFile(watchOutput, 'utf8')
      await writeFile(cssSource, await scopedCSS(css))
    } catch (error) { if (error.code !== 'ENOENT') console.error(error) }
  })
  child.on('exit', (code) => {
    watcher.close()
    void Promise.all([jsContext.dispose(), unlink(watchOutput).catch((error) => {
      if (error.code !== 'ENOENT') throw error
    })]).then(() => { process.exitCode = code ?? 1 })
  })
  process.on('SIGINT', () => child.kill('SIGINT'))
} else {
  const cssResult = spawnSync(resolve(root, 'node_modules/.bin/tailwindcss'), cssArgs, { stdio: 'inherit', cwd: root })
  if (cssResult.status !== 0) process.exit(cssResult.status ?? 1)
  await scopeCSS()
}

/* ---------- 许可汇总 ---------- */
if (!watch) {
  const pkgs = [...bundledPackages].sort()
  const notices = ['# Vendored UI 依赖许可汇总\n\ncoss/ui copy-paste 组件（MIT，https://coss.com/ui）。\n']
  for (const name of pkgs) {
    let dir
    try { dir = dirname(require.resolve(`${name}/package.json`)) } catch {
      dir = resolve(root, 'node_modules', name)
    }
    let license = ''
    for (const f of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENSE-MIT']) {
      try { license = await readFile(resolve(dir, f), 'utf8'); break } catch { /* 尝试下一个 */ }
    }
    let version = ''
    try { version = JSON.parse(await readFile(resolve(dir, 'package.json'), 'utf8')).version } catch { /* 忽略 */ }
    notices.push(`## ${name}${version ? ` v${version}` : ''}\n\n${license || '（未找到 LICENSE 文件，见 npm 包主页）'}\n`)
  }
  await writeFile(resolve(outDir, 'client-ui.LICENSES.md'), notices.join('\n'))
  console.log('[build-client] 许可已汇总到 germina/vendor/client-ui.LICENSES.md')
}
