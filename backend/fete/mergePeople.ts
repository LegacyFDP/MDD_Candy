type Params = { keep_id: number; merge_id: number }

/** Folds the `merge_id` person into `keep_id`, keeping shifts, events and roles. */
export default async function (req: { params: Params; user: User }) {
  const { keep_id: keepId, merge_id: mergeId } = req.params
  if (!keepId || !mergeId || keepId === mergeId) throw new Error('Choose two different people to merge')

  const people = (await retoolDb.query<{ id: number; email: string; phone: string; notes: string }>(
    'SELECT id, email, phone, notes FROM people WHERE id IN ($1, $2)',
    [keepId, mergeId],
  )).data
  const keep = people.find(person => person.id === keepId)
  const merge = people.find(person => person.id === mergeId)
  if (!keep || !merge) throw new Error('Person not found')

  const accounts = (await retoolDb.query<{ id: number; person_id: number }>(
    'SELECT id, person_id FROM fete_users WHERE person_id IN ($1, $2)',
    [keepId, mergeId],
  )).data
  const mergeAccount = accounts.find(account => account.person_id === mergeId)
  if (mergeAccount && accounts.some(account => account.person_id === keepId)) {
    throw new Error('Both people have login accounts. Remove the login role from one of them first.')
  }

  if (mergeAccount) {
    await retoolDb.query('UPDATE fete_users SET person_id = $1 WHERE id = $2', [keepId, mergeAccount.id])
  }

  await retoolDb.query('UPDATE volunteer_shifts SET person_id = $1 WHERE person_id = $2', [keepId, mergeId])
  for (const table of ['person_roles', 'volunteer_roles']) {
    await retoolDb.query(
      `INSERT OR IGNORE INTO ${table} (person_id, role) SELECT $1, role FROM ${table} WHERE person_id = $2`,
      [keepId, mergeId],
    )
    await retoolDb.query(`DELETE FROM ${table} WHERE person_id = $1`, [mergeId])
  }
  await retoolDb.query(
    'INSERT OR IGNORE INTO fete_contact_events (person_id, fete_id) SELECT $1, fete_id FROM fete_contact_events WHERE person_id = $2',
    [keepId, mergeId],
  )
  await retoolDb.query('DELETE FROM fete_contact_events WHERE person_id = $1', [mergeId])
  await retoolDb.query('DELETE FROM people WHERE id = $1', [mergeId])

  await retoolDb.query(
    `UPDATE people SET email = CASE WHEN email = '' THEN $1 ELSE email END,
                       phone = CASE WHEN phone = '' THEN $2 ELSE phone END,
                       notes = CASE WHEN notes = '' THEN $3 ELSE notes END
     WHERE id = $4`,
    [merge.email, merge.phone, merge.notes, keepId],
  )

  return { success: true }
}
