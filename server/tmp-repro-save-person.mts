import sqlite3 from 'sqlite3'
import path from 'node:path'

const dbPath = path.resolve(process.argv[2])
const database = new sqlite3.Database(dbPath)

function createRetoolDb(database) {
  return {
    async query(text, params = []) {
      const sqliteParams = []
      const sqliteText = text.replace(/\$(\d+)/g, (_m, i) => { sqliteParams.push(params[Number(i) - 1]); return '?' })
      return new Promise((resolve, reject) => {
        database.all(sqliteText, sqliteParams, (err, rows) => err ? reject(err) : resolve({ data: rows ?? [] }))
      })
    },
  }
}
;(globalThis as any).retoolDb = createRetoolDb(database)

const savePerson = (await import('file:///D:/Code/MDD_Candy_staging/backend/fete/savePerson.ts')).default
const getPeople = (await import('file:///D:/Code/MDD_Candy_staging/backend/fete/getPeople.ts')).default

const before = (await getPeople({ params: {}, user: null })) as any[]
const target = before.find(p => p.id === 8)
console.log('TARGET BEFORE:', JSON.stringify(target, null, 2))

try {
  const result = await savePerson({
    params: {
      id: target.id,
      name: target.name,
      email: target.email,
      phone: target.phone,
      notes: target.notes,
      roles: target.roles,
      pin: target.pin,
      volunteer_roles: target.volunteer_roles,
      contact_fete_ids: target.contact_fete_ids,
    },
    user: null,
  })
  console.log('SAVE RESULT:', JSON.stringify(result))
} catch (err) {
  console.log('SAVE ERROR:', err instanceof Error ? err.message : String(err))
}

const after = (await getPeople({ params: {}, user: null })) as any[]
const afterTarget = after.find(p => p.id === 8)
console.log('TARGET AFTER:', JSON.stringify(afterTarget, null, 2))

const shifts = await new Promise<any[]>((res, rej) => database.all('SELECT * FROM volunteer_shifts WHERE volunteer_id = 2', (e, r) => e ? rej(e) : res(r)))
console.log('SHIFTS AFTER:', JSON.stringify(shifts, null, 2))
database.close()
