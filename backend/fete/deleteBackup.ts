import { requireAdmin } from './_auth'
import { deleteBackupFile } from './_backupFs'

type Params = { filename: string }

export default async function (req: { params: Params; user: User }) {
  requireAdmin(req.user)

  const filename = (req.params.filename ?? '').trim()
  if (!filename) {
    throw new Error('Backup filename is required')
  }

  const absolutePath = deleteBackupFile(filename)

  await retoolDb.query(
    `
      UPDATE db_backups
      SET deleted_at = CURRENT_TIMESTAMP,
          deleted_by_user_id = $1
      WHERE filename = $2
    `,
    [req.user.id, filename],
  )

  return {
    success: true,
    deleted: {
      filename,
      absolute_path: absolutePath,
    },
  }
}
