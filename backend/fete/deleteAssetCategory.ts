type Params = { id: number; move_to_id?: number | null }

/**
 * Delete a category. If it still has assets, `move_to_id` names the category
 * they are moved into first (which also serves as a merge).
 */
export default async function (req: { params: Params; user: User }) {
  const { id, move_to_id } = req.params
  const category = await retoolDb.query<{ id: number }>(
    `SELECT id FROM asset_categories WHERE id = $1`,
    [id],
  )
  if (!category.data[0]) throw new Error('Category not found')

  if (move_to_id) {
    if (move_to_id === id) throw new Error('Choose a different category to move the assets into')
    const target = await retoolDb.query<{ id: number }>(
      `SELECT id FROM asset_categories WHERE id = $1`,
      [move_to_id],
    )
    if (!target.data[0]) throw new Error('Category to move assets into was not found')
    await retoolDb.query(`UPDATE assets SET category_id = $1 WHERE category_id = $2`, [move_to_id, id])
  }

  const inUse = await retoolDb.query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM assets WHERE category_id = $1`,
    [id],
  )
  if ((inUse.data[0]?.count ?? 0) > 0) {
    throw new Error('Move or delete the assets in this category before deleting it')
  }

  await retoolDb.query(`DELETE FROM asset_categories WHERE id = $1`, [id])
  return { success: true }
}
