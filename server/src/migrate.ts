import 'dotenv/config'
import { db, ensureRuntimeSchema } from './db.js'

async function closeDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    db.close((error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

async function main() {
  await ensureRuntimeSchema()
  await closeDatabase()
  console.log('SQLite schema migration complete')
}

main().catch(async (error) => {
  console.error('SQLite schema migration failed:', error)
  try {
    await closeDatabase()
  } catch (closeError) {
    console.error('Error closing database:', closeError)
  }
  process.exit(1)
})