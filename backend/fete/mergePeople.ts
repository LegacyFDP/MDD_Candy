type Params = { keep_id: number; merge_id: number }

type Links = { account?: { id: number }; volunteer?: { id: number }; contact?: { id: number } }

async function linksFor(personId: number): Promise<Links> {
  const [account, volunteer, contact] = await Promise.all([
    retoolDb.query<{ id: number }>('SELECT id FROM fete_users WHERE person_id = $1', [personId]),
    retoolDb.query<{ id: number }>('SELECT id FROM fete_volunteers WHERE person_id = $1', [personId]),
    retoolDb.query<{ id: number }>('SELECT id FROM fete_contacts WHERE person_id = $1', [personId]),
  ])
  return { account: account.data[0], volunteer: volunteer.data[0], contact: contact.data[0] }
}

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

  const keepLinks = await linksFor(keepId)
  const mergeLinks = await linksFor(mergeId)
  if (keepLinks.account && mergeLinks.account) {
    throw new Error('Both people have login accounts. Remove the login role from one of them first.')
  }

  if (mergeLinks.account) {
    await retoolDb.query('UPDATE fete_users SET person_id = $1 WHERE id = $2', [keepId, mergeLinks.account.id])
  }

  if (mergeLinks.volunteer) {
    if (keepLinks.volunteer) {
      await retoolDb.query(
        'UPDATE volunteer_shifts SET volunteer_id = $1 WHERE volunteer_id = $2',
        [keepLinks.volunteer.id, mergeLinks.volunteer.id],
      )
      await retoolDb.query(
        'INSERT OR IGNORE INTO volunteer_roles (volunteer_id, role) SELECT $1, role FROM volunteer_roles WHERE volunteer_id = $2',
        [keepLinks.volunteer.id, mergeLinks.volunteer.id],
      )
      await retoolDb.query('DELETE FROM volunteer_roles WHERE volunteer_id = $1', [mergeLinks.volunteer.id])
      await retoolDb.query('DELETE FROM fete_volunteers WHERE id = $1', [mergeLinks.volunteer.id])
    } else {
      await retoolDb.query('UPDATE fete_volunteers SET person_id = $1 WHERE id = $2', [keepId, mergeLinks.volunteer.id])
    }
  }

  if (mergeLinks.contact) {
    if (keepLinks.contact) {
      await retoolDb.query(
        'INSERT OR IGNORE INTO fete_contact_events (contact_id, fete_id) SELECT $1, fete_id FROM fete_contact_events WHERE contact_id = $2',
        [keepLinks.contact.id, mergeLinks.contact.id],
      )
      await retoolDb.query('DELETE FROM fete_contact_events WHERE contact_id = $1', [mergeLinks.contact.id])
      await retoolDb.query('DELETE FROM fete_contacts WHERE id = $1', [mergeLinks.contact.id])
    } else {
      await retoolDb.query('UPDATE fete_contacts SET person_id = $1 WHERE id = $2', [keepId, mergeLinks.contact.id])
    }
  }

  await retoolDb.query(
    'INSERT OR IGNORE INTO person_roles (person_id, role) SELECT $1, role FROM person_roles WHERE person_id = $2',
    [keepId, mergeId],
  )
  await retoolDb.query('DELETE FROM person_roles WHERE person_id = $1', [mergeId])
  await retoolDb.query('DELETE FROM people WHERE id = $1', [mergeId])

  await retoolDb.query(
    `UPDATE people SET email = CASE WHEN email = '' THEN $1 ELSE email END,
                       phone = CASE WHEN phone = '' THEN $2 ELSE phone END,
                       notes = CASE WHEN notes = '' THEN $3 ELSE notes END
     WHERE id = $4`,
    [merge.email, merge.phone, merge.notes, keepId],
  )
  for (const table of ['fete_volunteers', 'fete_contacts']) {
    await retoolDb.query(
      `UPDATE ${table}
       SET name = (SELECT name FROM people WHERE id = $1),
           email = (SELECT email FROM people WHERE id = $1),
           phone = (SELECT phone FROM people WHERE id = $1),
           notes = (SELECT notes FROM people WHERE id = $1)
       WHERE person_id = $1`,
      [keepId],
    )
  }

  return { success: true }
}
