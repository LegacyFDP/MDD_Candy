type Params = { id: number }

export default async function (req: { params: Params; user: User }) {
  const { id } = req.params

  await retoolDb.query(`DELETE FROM volunteer_shifts WHERE volunteer_id = $1`, [id])
  await retoolDb.query(`DELETE FROM fete_volunteers WHERE id = $1`, [id])

  return { success: true }
}
