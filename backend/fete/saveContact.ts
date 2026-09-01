type Params = {
  id?: number
  name: string
  email?: string
  phone?: string
  notes?: string
  fete_ids?: number[]
}

export default async function (req: { params: Params; user: User }) {
  const { id, fete_ids = [] } = req.params
  const name = req.params.name.trim()
  if (!name) throw new Error('Contact name is required')
  const uniqueFeteIds = [...new Set(fete_ids)]
  if (uniqueFeteIds.length === 0) throw new Error('A contact must be linked to at least one event')

  const contactId = id ?? (await retoolDb.query<{ id: number }>(`
    INSERT INTO fete_contacts (name, email, phone, notes)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `, [name, req.params.email?.trim() ?? '', req.params.phone?.trim() ?? '', req.params.notes?.trim() ?? ''])).data[0]?.id

  if (id) {
    await retoolDb.query(`
      UPDATE fete_contacts SET name=$1, email=$2, phone=$3, notes=$4 WHERE id=$5
    `, [name, req.params.email?.trim() ?? '', req.params.phone?.trim() ?? '', req.params.notes?.trim() ?? '', id])
  }

  await retoolDb.query('DELETE FROM fete_contact_events WHERE contact_id = $1', [contactId])
  for (const feteId of uniqueFeteIds) {
    await retoolDb.query('INSERT INTO fete_contact_events (contact_id, fete_id) VALUES ($1, $2)', [contactId, feteId])
  }
  return { success: true }
}