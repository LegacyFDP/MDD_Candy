type Params = { id: number }

export default async function (req: { params: Params; user: User }) {
  const { id } = req.params

  const applyDelete = async () => {
    await retoolDb.query(`DELETE FROM volunteer_shifts WHERE volunteer_id = $1`, [id])
    await retoolDb.query(`DELETE FROM fete_volunteers WHERE id = $1`, [id])
  }

  if (retoolDb.transaction) {
    await retoolDb.transaction(applyDelete)
  } else {
    await applyDelete()
  }

  return { success: true }
}
