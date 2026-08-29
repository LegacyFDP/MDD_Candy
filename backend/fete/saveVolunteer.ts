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
  role?: string
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
  const role = clean(req.params.role) || 'Helper'
  const notes = clean(req.params.notes)

  if (!name) throw new Error('Volunteer name is required')
  if (!VOLUNTEER_ROLES.includes(role as typeof VOLUNTEER_ROLES[number])) {
    throw new Error(`Volunteer role must be one of: ${VOLUNTEER_ROLES.join(', ')}`)
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
    `, [name, email, phone, role, notes, id])
  } else {
    await retoolDb.query(`
      INSERT INTO fete_volunteers (name, email, phone, role, notes)
      VALUES ($1, $2, $3, $4, $5)
    `, [name, email, phone, role, notes])
  }

  return { success: true }
}
