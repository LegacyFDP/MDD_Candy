type Params = { id: number }

/**
 * Permanently delete a Store Location and its Storage Areas.
 * Refused while any asset or fete still references the location, so no
 * history is silently detached — archive the location instead in that case.
 */
export default async function (req: { params: Params; user: User }) {
  const { id } = req.params
  if (!Number.isInteger(id) || id <= 0) throw new Error('A valid location id is required')

  const location = await retoolDb.query<{ id: number }>(
    "SELECT id FROM store_locations WHERE id = $1 AND location_type = 'Store'",
    [id],
  )
  if (!location.data[0]) throw new Error('Location not found')

  const assets = await retoolDb.query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM assets
     WHERE location_id = $1
        OR storage_area_id IN (SELECT id FROM storage_areas WHERE location_id = $2)`,
    [id, id],
  )
  const assetCount = assets.data[0]?.count ?? 0

  const fetes = await retoolDb.query<{ count: number }>(
    'SELECT COUNT(*) AS count FROM fetes WHERE location_id = $1',
    [id],
  )
  const feteCount = fetes.data[0]?.count ?? 0

  if (assetCount > 0 || feteCount > 0) {
    const parts = [
      assetCount > 0 ? `${assetCount} asset${assetCount !== 1 ? 's' : ''}` : '',
      feteCount > 0 ? `${feteCount} fete${feteCount !== 1 ? 's' : ''}` : '',
    ].filter(Boolean).join(' and ')
    throw new Error(`Cannot delete — this location is still used by ${parts}. Move them or archive the location instead.`)
  }

  await retoolDb.query('DELETE FROM storage_areas WHERE location_id = $1', [id])
  await retoolDb.query('DELETE FROM store_locations WHERE id = $1', [id])

  return { success: true }
}
