type Params = {
  id?: number
  name: string
  event_date: string
  description: string
  status: string
  created_by: number
  location_id?: number | null
}

export default async function (req: { params: Params; user: User }) {
  const { id, name, event_date, description, status, created_by, location_id } = req.params
  if (id) {
    await retoolDb.query(`
      UPDATE fetes SET name=$1, event_date=$2, description=$3, status=$4, location_id=$5 WHERE id=$6
    `, [name, event_date, description, status, location_id ?? null, id])
  } else {
    await retoolDb.query(`
      INSERT INTO fetes (name, event_date, description, status, created_by, location_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [name, event_date, description, status, created_by, location_id ?? null])
  }
  return { success: true }
}
