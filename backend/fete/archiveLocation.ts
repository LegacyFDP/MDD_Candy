import { isSuperuser } from './personRecords.ts'

type Params = {
  id: number
  /** Ignored when signed in: the signed-in user is recorded instead. */
  archived_by?: number
  restore?: boolean
}

export default async function (req: { params: Params; user: User }) {
  const { id, restore = false } = req.params
  const archivedBy = req.user?.id ?? req.params.archived_by

  if (!Number.isInteger(id) || id <= 0) throw new Error('A valid location id is required')
  if (!Number.isInteger(archivedBy) || archivedBy! <= 0) throw new Error('A valid user is required')

  if (restore) {
    // Archived stores are only visible to the Superuser, so only they restore.
    if (req.user && !isSuperuser(req.user)) throw new Error('Only the Superuser can restore an archived location')
    await retoolDb.query(
      "UPDATE store_locations SET archived_at = NULL, archived_by = NULL WHERE id = $1 AND location_type = 'Store'",
      [id],
    )
  } else {
    await retoolDb.query(
      "UPDATE store_locations SET archived_at = CURRENT_TIMESTAMP, archived_by = $1 WHERE id = $2 AND location_type = 'Store' AND archived_at IS NULL",
      [archivedBy, id],
    )
  }

  return { success: true }
}
