type Params = {
  id?: number
  name: string
  email: string
  role: 'admin' | 'store keeper' | 'user'
  pin?: string
}

export default async function (req: { params: Params; user: User }) {
  const { id, role } = req.params
  const name = (req.params.name ?? '').trim()
  const email = (req.params.email ?? '').trim()
  const pin = (req.params.pin ?? '').trim()

  if (!name) throw new Error('Name is required')
  if (!email) throw new Error('Email is required')
  if (role !== 'admin' && role !== 'store keeper' && role !== 'user') {
    throw new Error('Invalid role')
  }

  if (id) {
    if (pin) {
      await retoolDb.query(`
        UPDATE fete_users SET name=$1, email=$2, role=$3, pin=$4 WHERE id=$5
      `, [name, email, role, pin, id])
    } else {
      await retoolDb.query(`
        UPDATE fete_users SET name=$1, email=$2, role=$3 WHERE id=$4
      `, [name, email, role, id])
    }
  } else {
    if (!pin) throw new Error('PIN is required when creating a user')
    await retoolDb.query(`
      INSERT INTO fete_users (name, email, role, pin) VALUES ($1, $2, $3, $4)
    `, [name, email, role, pin])
  }
  return { success: true }
}

