type Params = { id?: number; name: string }

export default async function (req: { params: Params; user: User }) {
  const { id } = req.params
  const name = req.params.name.trim()
  if (!name) throw new Error('Category name is required')

  const existing = await retoolDb.query<{ id: number }>(
    `SELECT id FROM asset_categories WHERE name = $1 COLLATE NOCASE`,
    [name],
  )
  if (existing.data.some((category) => category.id !== id)) {
    throw new Error('A category with this name already exists')
  }

  if (id) {
    const current = await retoolDb.query<{ name: string }>(
      `SELECT name FROM asset_categories WHERE id = $1`,
      [id],
    )
    if (!current.data[0]) throw new Error('Category not found')

    await retoolDb.query(`UPDATE assets SET category = $1 WHERE category = $2 COLLATE NOCASE`, [name, current.data[0].name])
    await retoolDb.query(`UPDATE asset_categories SET name = $1 WHERE id = $2`, [name, id])
  } else {
    await retoolDb.query(`INSERT INTO asset_categories (name) VALUES ($1)`, [name])
  }

  return { success: true }
}