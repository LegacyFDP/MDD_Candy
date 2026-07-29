import { requireAdmin } from './_auth'
import { createBackupFile } from './_backupFs'

type Params = { reason?: string }

export default async function (req: { params: Params; user: User }) {
  requireAdmin(req.user)

  const reason = (req.params.reason ?? 'manual').trim() || 'manual'
  const created = createBackupFile()

  await retoolDb.query(
    `
      INSERT INTO db_backups (
        filename,
        absolute_path,
        byte_size,
        reason,
        created_by_user_id,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [created.filename, created.absolutePath, created.byteSize, reason, req.user.id, created.createdAt],
  )

  return {
    success: true,
    backup: {
      filename: created.filename,
      byte_size: created.byteSize,
      created_at: created.createdAt,
    },
  }
}
