// GitHub Pages'ni taqlid qiluvchi statik server (e2e uchun): site/ papkasi /eduflow-crm/ ostida.
// Pages kabi: fayl bor — 200; papka (oxirida / siz) — 301 bilan "/"ga; papkada index.html — 200;
// boshqa hamma narsa — 404.html, HTTP 404 status bilan. CSP sarlavhasi yo'q (Pages ham yubormaydi)
//
// Ishlatish: node scripts/pages-server.mjs [--dir site] [--base /eduflow-crm/] [--port 4175]
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index > 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const root = resolve(arg('dir', 'site'))
const base = arg('base', '/eduflow-crm/')
const port = Number(arg('port', '4175'))

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.ico': 'image/x-icon',
}

function send(res, status, file) {
  res.writeHead(status, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).pipe(res)
}

function notFound(res) {
  const page = join(root, '404.html')
  if (existsSync(page)) send(res, 404, page)
  else {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('404')
  }
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const pathname = decodeURIComponent(url.pathname)
  if (pathname === base.slice(0, -1)) {
    res.writeHead(301, { Location: `${base}${url.search}` })
    res.end()
    return
  }
  if (!pathname.startsWith(base)) return notFound(res)
  const relative = normalize(pathname.slice(base.length)).replace(/^(\.\.[/\\])+/, '')
  const target = join(root, relative)
  if (!target.startsWith(root)) return notFound(res)
  if (existsSync(target) && statSync(target).isFile()) return send(res, 200, target)
  if (existsSync(target) && statSync(target).isDirectory()) {
    if (!pathname.endsWith('/')) {
      res.writeHead(301, { Location: `${pathname}/${url.search}` })
      res.end()
      return
    }
    const index = join(target, 'index.html')
    if (existsSync(index)) return send(res, 200, index)
  }
  return notFound(res)
}).listen(port, () => {
  console.log(`pages-server: http://localhost:${port}${base} -> ${root}`)
})
