import 'dotenv/config'
import express from 'express'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRetoolDb, db } from './db.js'

// ---------------------------------------------------------------------------
// 1. Provide the `retoolDb` global the backend functions reference.
//    They read it as a free identifier at call time, so it must exist on the
//    global object before any handler runs.
// ---------------------------------------------------------------------------
;(globalThis as unknown as { retoolDb: unknown }).retoolDb = createRetoolDb()

const here = path.dirname(fileURLToPath(import.meta.url))

function findRepoRoot(startDir: string): string {
  const candidates = [
    startDir,
    path.resolve(startDir, '..'),
    path.resolve(startDir, '..', '..'),
    path.resolve(startDir, '..', '..', '..'),
  ]

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, 'backend', 'fete'))) {
      return candidate
    }
  }

  return path.resolve(startDir, '..', '..')
}

const repoRoot = findRepoRoot(here)
const backendDir = path.join(repoRoot, 'backend', 'fete')
const frontendDist = path.join(repoRoot, 'frontend', 'dist')

type Handler = (req: { params: Record<string, unknown>; user: User }) => Promise<unknown>

// ---------------------------------------------------------------------------
// 2. Auto-discover every backend function and map it to its file name.
//    backend/fete/getAssets.ts  ->  POST /api/getAssets
// ---------------------------------------------------------------------------
async function loadHandlers(): Promise<Record<string, Handler>> {
  if (!existsSync(backendDir)) {
    throw new Error(`Backend handlers directory not found: ${backendDir}`)
  }

  const handlers: Record<string, Handler> = {}
  const files = readdirSync(backendDir).filter(
    (f) => f.endsWith('.ts') && !f.endsWith('.d.ts'),
  )
  for (const file of files) {
    const name = file.replace(/\.ts$/, '')
    const mod = await import(pathToFileURL(path.join(backendDir, file)).href)
    if (typeof mod.default === 'function') {
      handlers[name] = mod.default as Handler
    }
  }
  return handlers
}

async function main() {
  const handlers = await loadHandlers()
  const app = express()
  app.use(express.json())

  // Health check for load balancers / uptime monitors.
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  // Every backend function is reachable at POST /api/<functionName>.
  // The JSON request body becomes `req.params` (matching Retool's convention).
  app.post('/api/:fn', async (req, res) => {
    const handler = handlers[req.params.fn]
    if (!handler) {
      res.status(404).json({ error: `Unknown function: ${req.params.fn}` })
      return
    }
    try {
      const result = await handler({
        params: (req.body ?? {}) as Record<string, unknown>,
        user: null,
      })
      res.json(result ?? null)
    } catch (err) {
      // Handlers throw plain Errors for validation failures (bad PIN, low
      // stock, etc). Surface the message so the UI can show it.
      const message = err instanceof Error ? err.message : 'Request failed'
      res.status(400).json({ error: message })
    }
  })

  // Serve the built frontend and fall back to index.html for client routing.
  app.use(express.static(frontendDist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'))
  })

  const port = Number(process.env.PORT ?? 8080)
  const host = process.env.HOST ?? '127.0.0.1'
  app.listen(port, host, () => {
    console.log(`Fete Store Manager API listening on http://${host}:${port}`)
    console.log(`Loaded ${Object.keys(handlers).length} backend functions`)
  })
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  db.close((closeErr) => {
    if (closeErr) console.error('Error closing database:', closeErr)
    process.exit(1)
  })
})
