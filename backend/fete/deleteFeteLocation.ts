type Params = { id: number }

export default async function (req: { params: Params; user: User }) {
  await retoolDb.query(`
    DELETE FROM store_locations
    WHERE id = $1
      AND location_type = 'Fetes'
  `, [req.params.id])
  return { success: true }
}
