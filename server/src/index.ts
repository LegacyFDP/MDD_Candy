import 'dotenv/config'
import express from 'express'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { activeDatabaseFile, createRetoolDb, db, ensureRuntimeSchema } from './db.js'

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

type AccountRole = 'user' | 'store keeper' | 'admin' | 'superuser'

// ---------------------------------------------------------------------------
// Who may call which backend function. The server enforces this using the
// signed-in user's session, so hiding a button in the browser is no longer
// the only protection.
//   - loginUser is the only function that works without signing in.
//   - Functions not listed here need Admin (safe default for new handlers).
//   - Handlers make finer checks themselves (e.g. only a Superuser may
//     restore archived records or see them).
// ---------------------------------------------------------------------------
const PUBLIC_FUNCTIONS = new Set(['loginUser'])

const MINIMUM_ROLE: Record<string, AccountRole> = {
  // Read-only lists any signed-in user's pages need.
  getAssets: 'user',
  getAssetCategories: 'user',
  getLocations: 'user',
  getStorageAreas: 'user',
  getFeteLocations: 'user',
  getFetes: 'user',
  getWithdrawals: 'user',
  getFeteWithdrawals: 'user',
  getUsers: 'user',
  getVolunteerShifts: 'user',
  getFeteAssetPickList: 'user',
  getFeteRequirements: 'user',
  // Any user may add an event and manage event venues (as the Fetes page allows).
  // Editing an existing event needs Admin; saveFete checks that itself.
  saveFete: 'user',
  saveFeteLocation: 'user',
  deleteFeteLocation: 'user',
  // Moving stock in and out.
  bookAsset: 'store keeper',
  convertBookingToOut: 'store keeper',
  withdrawAsset: 'store keeper',
  returnAsset: 'store keeper',
  // Permanent deletion of a store.
  deleteLocation: 'superuser',
}

function bearerToken(header: string | undefined): string {
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? '')
  return match?.[1] ?? ''
}

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
  await ensureRuntimeSchema()
  const handlers = await loadHandlers()
  const sessions = await import(pathToFileURL(path.join(backendDir, 'sessions.ts')).href) as {
    getSessionUser(token: string): Promise<NonNullable<User> | null>
    deleteSession(token: string): Promise<void>
  }
  const { meetsRole } = await import(pathToFileURL(path.join(backendDir, 'personRecords.ts')).href) as {
    meetsRole(role: string | null | undefined, minimum: AccountRole): boolean
  }

  const app = express()
  app.use(express.json())

  // Health check for load balancers / uptime monitors.
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, database: activeDatabaseFile })
  })

  // Sign out: forget this session's token.
  app.post('/api/logout', async (req, res) => {
    try {
      await sessions.deleteSession(bearerToken(req.get('authorization')))
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: 'Sign out failed' })
    }
  })

  // Every backend function is reachable at POST /api/<functionName>.
  // The JSON request body becomes `req.params` (matching Retool's convention).
  app.post('/api/:fn', async (req, res) => {
    const fn = req.params.fn
    const handler = handlers[fn]
    if (!handler) {
      res.status(404).json({ error: `Unknown function: ${fn}` })
      return
    }
    try {
      let user: User = null
      if (!PUBLIC_FUNCTIONS.has(fn)) {
        user = await sessions.getSessionUser(bearerToken(req.get('authorization')))
        if (!user) {
          res.status(401).json({ error: 'Your sign-in has expired. Please sign in again.' })
          return
        }
        if (!meetsRole(user.role, MINIMUM_ROLE[fn] ?? 'admin')) {
          res.status(403).json({ error: 'You do not have permission to do that.' })
          return
        }
      }

      const result = await handler({
        params: (req.body ?? {}) as Record<string, unknown>,
        user,
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
