type Params = {
  id?: number
  name: string
  description: string
}

export default async function (req: { params: Params; user: User }) {
  const { id, name, description } = req.params
  if (id) {
    await retoolDb.query(`
      UPDATE fete_locations SET name=$1, description=$2 WHERE id=$3
    `, [name, description, id])
  } else {
    await retoolDb.query(`
      INSERT INTO fete_locations (name, description) VALUES ($1, $2)
    `, [name, description])
  }
  return { success: true }
}
