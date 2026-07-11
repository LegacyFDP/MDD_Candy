type Params = { id: number }

export default async function (req: { params: Params; user: User }) {
  await retoolDb.query(`DELETE FROM assets WHERE id = $1`, [req.params.id])
  return { success: true }
}
