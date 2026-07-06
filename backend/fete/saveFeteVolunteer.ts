type Params = {
  id?: number
  fete_id: number
  user_id: number
  role: string
  notes: string
}

export default async function (req: { params: Params; user: User }) {
  const { id, fete_id, user_id, role, notes } = req.params

  if (id) {
    await retoolDb.query(
      `UPDATE fete_volunteers SET role = $1, notes = $2 WHERE id = $3`,
      [role, notes, id]
    )
  } else {
    await retoolDb.query(`
      INSERT INTO fete_volunteers (fete_id, user_id, role, notes)
      VALUES ($1, $2, $3, $4)
    `, [fete_id, user_id, role, notes])
  }
  return { success: true }
}
