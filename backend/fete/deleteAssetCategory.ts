type Params = { id: number }

export default async function (req: { params: Params; user: User }) {
  const category = await retoolDb.query<{ name: string }>(
    `SELECT name FROM asset_categories WHERE id = $1`,
    [req.params.id],
  )
  const name = category.data[0]?.name
  if (!name) throw new Error('Category not found')

  const inUse = await retoolDb.query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM assets WHERE category = $1 COLLATE NOCASE`,
    [name],
  )
  if ((inUse.data[0]?.count ?? 0) > 0) {
    throw new Error('Move or delete the assets in this category before deleting it')
  }

  await retoolDb.query(`DELETE FROM asset_categories WHERE id = $1`, [req.params.id])
  return { success: true }
}