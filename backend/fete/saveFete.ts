type Params = {
  id?: number
  name: string
  event_date: string
  description: string
  notes?: string
  status: string
  created_by: number
  location_id?: number | null
}

export default async function (req: { params: Params; user: User }) {
  const { id, name, event_date, description, status, created_by, location_id } = req.params
  const notes = (req.params.notes ?? '').trim()

  if (notes.length > 120) throw new Error('Fete notes must be 120 characters or fewer')

  if (id) {
    await retoolDb.query(`
      UPDATE fetes SET name=$1, event_date=$2, description=$3, notes=$4, status=$5, location_id=$6 WHERE id=$7
    `, [name, event_date, description, notes, status, location_id ?? null, id])
  } else {
    await retoolDb.query(`
      INSERT INTO fetes (name, event_date, description, notes, status, created_by, location_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [name, event_date, description, notes, status, created_by, location_id ?? null])
  }
  return { success: true }
}
