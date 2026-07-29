import { requireAdmin } from './_auth'
import { listBackupFiles } from './_backupFs'

type BackupRow = {
  filename: string
  created_at: string
  deleted_at: string | null
  byte_size: number
  reason: string
}

export default async function (req: { params: Record<string, never>; user: User }) {
  requireAdmin(req.user)

  const files = listBackupFiles()
  const rows = await retoolDb.query<BackupRow>(
    `
      SELECT filename, created_at, deleted_at, byte_size, reason
      FROM db_backups
      ORDER BY created_at DESC
    `,
    [],
  )

  const metaByFilename = new Map(rows.data.map((row) => [row.filename, row]))

  return files.map((file) => {
    const meta = metaByFilename.get(file.filename)
    return {
      filename: file.filename,
      absolute_path: file.absolutePath,
      byte_size: file.byteSize,
      created_at: meta?.created_at ?? file.mtime,
      reason: meta?.reason ?? 'manual',
      deleted_at: meta?.deleted_at ?? null,
    }
  })
}
