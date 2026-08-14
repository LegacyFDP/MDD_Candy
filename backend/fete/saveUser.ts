type Params = {
  id?: number
  name: string
  email: string
  role: 'admin' | 'store keeper' | 'user'
  pin: string
}

export default async function (req: { params: Params; user: User }) {
  const { id, name, email, role, pin } = req.params
  if (role !== 'admin' && role !== 'store keeper' && role !== 'user') {
    throw new Error('Invalid role')
  }

  if (id) {
    await retoolDb.query(`
      UPDATE fete_users SET name=$1, email=$2, role=$3, pin=$4 WHERE id=$5
    `, [name, email, role, pin, id])
  } else {
    await retoolDb.query(`
      INSERT INTO fete_users (name, email, role, pin) VALUES ($1, $2, $3, $4)
    `, [name, email, role, pin])
  }
  return { success: true }
}
