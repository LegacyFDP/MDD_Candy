type Params = {
  id: number
  archived_by: number
  restore?: boolean
}

export default async function (req: { params: Params; user: User }) {
  const { id, archived_by, restore = false } = req.params

  if (!Number.isInteger(id) || id <= 0) throw new Error('A valid fete id is required')
  if (!Number.isInteger(archived_by) || archived_by <= 0) throw new Error('A valid user is required')

  if (restore) {
    await retoolDb.query(
      'UPDATE fetes SET archived_at = NULL, archived_by = NULL WHERE id = $1',
      [id],
    )
  } else {
    await retoolDb.query(
      'UPDATE fetes SET archived_at = CURRENT_TIMESTAMP, archived_by = $1 WHERE id = $2 AND archived_at IS NULL',
      [archived_by, id],
    )
  }

  return { success: true }
}