type Params = { id: number }

export default async function (req: { params: Params; user: User }) {
  const category = await retoolDb.query<{ id: number }>(
    `SELECT id FROM asset_categories WHERE id = $1`,
    [req.params.id],
  )
  if (!category.data[0]) throw new Error('Category not found')

  const inUse = await retoolDb.query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM assets WHERE category_id = $1`,
    [req.params.id],
  )
  if ((inUse.data[0]?.count ?? 0) > 0) {
    throw new Error('Move or delete the assets in this category before deleting it')
  }

  await retoolDb.query(`DELETE FROM asset_categories WHERE id = $1`, [req.params.id])
  return { success: true }
}