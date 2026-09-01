const VOLUNTEER_ROLES = [
  'Lead Volunteer',
  'Helper',
  'Putting Up',
  'Taking Down',
  'Transport',
  'Stall Holder',
] as const

type Params = {
  id?: number
  name: string
  email?: string
  phone?: string
  roles?: string[]
  notes?: string
}

function clean(value: string | undefined): string {
  return (value ?? '').trim()
}

export default async function (req: { params: Params; user: User }) {
  const { id } = req.params
  const name = clean(req.params.name)
  const email = clean(req.params.email)
  const phone = clean(req.params.phone)
  const roles = [...new Set((req.params.roles ?? []).map(clean).filter(Boolean))]
  const notes = clean(req.params.notes)

  if (!name) throw new Error('Volunteer name is required')
  if (!roles.every(role => VOLUNTEER_ROLES.includes(role as typeof VOLUNTEER_ROLES[number]))) {
    throw new Error(`Volunteer roles must be one of: ${VOLUNTEER_ROLES.join(', ')}`)
  }

  if (id) {
    await retoolDb.query(`
      UPDATE fete_volunteers
      SET name=$1,
          email=$2,
          phone=$3,
          role=$4,
          notes=$5
      WHERE id=$6
    `, [name, email, phone, roles[0] ?? '', notes, id])
    await retoolDb.query('DELETE FROM volunteer_roles WHERE volunteer_id = $1', [id])
    for (const role of roles) {
      await retoolDb.query('INSERT INTO volunteer_roles (volunteer_id, role) VALUES ($1, $2)', [id, role])
    }
  } else {
    const created = await retoolDb.query<{ id: number }>(`
      INSERT INTO fete_volunteers (name, email, phone, role, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [name, email, phone, roles[0] ?? '', notes])
    const volunteerId = created.data[0]?.id
    for (const role of roles) {
      await retoolDb.query('INSERT INTO volunteer_roles (volunteer_id, role) VALUES ($1, $2)', [volunteerId, role])
    }
  }

  return { success: true }
}
