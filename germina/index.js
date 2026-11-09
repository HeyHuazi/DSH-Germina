/**
 * [INPUT]: 依赖 workspace-state.js 的持久化工作区语义；可选注入 webServer 服务
 * [OUTPUT]: 注册工作区 API、/workspace.js 和 /client-ui.js|css 固定同源资源路由
 * [POS]: germina Host 装配；串行执行工作区请求，防止切根与旧请求交叉写入
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { resolve, dirname } from 'node:path'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createWorkspaceHandler } from './workspace-state.js'

export const name = 'germina'
export const inject = ['webServer']

export function apply(ctx, config = {}) {
  const route = config.route ?? '/plugins/germina/api'
  const packageDir = dirname(fileURLToPath(import.meta.url))
  const ready = createWorkspaceHandler(packageDir, config)
  // 记录初始化失败，避免首个请求前产生未捕获的 Promise rejection。
  ready.catch((error) => ctx.logger.warn(`germina: initialization failed: ${error.message}`))
  let queue = Promise.resolve()
  ctx.logger.info(`germina: serving workspace API at ${route}`)
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: `${route}/workspace.js`,
    async handler(req, res) {
      if (req.method !== 'GET') {
        res.writeHead(405, { allow: 'GET' })
        res.end('method not allowed')
        return
      }
      try {
        const source = await readFile(resolve(packageDir, 'client-workspace.js'), 'utf8')
        res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' })
        res.end(source)
      } catch {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('Germina workspace module unavailable')
      }
    },
  }))
  for (const [file, type] of [
    ['client-ui.js', 'text/javascript'],
    ['client-ui.css', 'text/css'],
  ]) {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact', path: `${route}/${file}`,
      async handler(req, res) {
        if (req.method !== 'GET') {
          res.writeHead(405, { allow: 'GET' })
          res.end('method not allowed')
          return
        }
        try {
          const source = await readFile(resolve(packageDir, 'vendor', file))
          res.writeHead(200, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-cache' })
          res.end(source)
        } catch {
          res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
          res.end('Germina UI asset unavailable')
        }
      },
    }))
  }
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: route,
    async handler(req, res) {
      const send = (status, body) => {
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(body))
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { 'content-type': 'application/json; charset=utf-8', allow: 'POST' })
        res.end(JSON.stringify({ ok: false, error: 'method not allowed' }))
        return
      }
      let body
      try {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const text = Buffer.concat(chunks).toString('utf8')
        body = text ? JSON.parse(text) : {}
      } catch { send(400, { ok: false, error: 'invalid JSON body' }); return }
      const task = queue.then(async () => (await ready)(body))
      queue = task.catch(() => {})
      try {
        const result = await task
        send(result.status, result.body)
      } catch (error) {
        ctx.logger.warn(`germina: workspace request failed: ${error.message}`)
        send(500, { ok: false, error: 'Workspace unavailable' })
      }
    },
  }))
}
