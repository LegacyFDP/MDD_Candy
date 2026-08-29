type Params = {
  id?: number
  location_id: number
  name: string
  description?: string
  notes?: string
}

function clean(value: string | undefined): string {
  return (value ?? '').trim()
}

export default async function (req: { params: Params; user: User }) {
  const { id, location_id } = req.params
  const name = clean(req.params.name)
  const description = clean(req.params.description)
  const notes = clean(req.params.notes)

  if (!Number.isInteger(location_id) || location_id <= 0) throw new Error('A valid Store Location is required')
  if (!name) throw new Error('Storage Area name is required')
  if (notes.length > 120) throw new Error('Storage Area notes must be 120 characters or fewer')

  const location = await retoolDb.query<{ id: number }>(
    "SELECT id FROM store_locations WHERE id = $1 AND location_type = 'Store' AND archived_at IS NULL",
    [location_id],
  )
  if (location.data.length === 0) throw new Error('Storage Areas can only belong to active Store Locations')

  const duplicate = await retoolDb.query<{ id: number }>(
    `SELECT id FROM storage_areas
     WHERE location_id = $1 AND name = $2 COLLATE NOCASE ${id ? 'AND id <> $3' : ''}`,
    id ? [location_id, name, id] : [location_id, name],
  )
  if (duplicate.data.length > 0) throw new Error('A Storage Area with this name already exists at this location')

  if (id) {
    await retoolDb.query(
      'UPDATE storage_areas SET location_id = $1, name = $2, description = $3, notes = $4 WHERE id = $5',
      [location_id, name, description, notes, id],
    )
  } else {
    await retoolDb.query(
      'INSERT INTO storage_areas (location_id, name, description, notes) VALUES ($1, $2, $3, $4)',
      [location_id, name, description, notes],
    )
  }

  return { success: true }
}