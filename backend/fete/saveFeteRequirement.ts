type Params = {
  id?: number
  fete_id: number
  asset_id: number
  quantity_needed: number
  notes: string
}

export default async function (req: { params: Params; user: User }) {
  const { id, fete_id, asset_id, quantity_needed, notes } = req.params
  if (id) {
    await retoolDb.query(`
      UPDATE fete_requirements SET quantity_needed=$1, notes=$2 WHERE id=$3
    `, [quantity_needed, notes, id])
  } else {
    await retoolDb.query(`
      INSERT INTO fete_requirements (fete_id, asset_id, quantity_needed, notes)
      VALUES ($1, $2, $3, $4)
    `, [fete_id, asset_id, quantity_needed, notes])
  }
  return { success: true }
}
