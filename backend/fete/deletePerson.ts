import { removeAccount, removeContact, removeVolunteer } from './personRecords.ts'

type Params = { id: number }

export default async function (req: { params: Params; user: User }) {
  const { id } = req.params
  const account = (await retoolDb.query<{ id: number }>('SELECT id FROM fete_users WHERE person_id = $1', [id])).data[0]
  const volunteer = (await retoolDb.query<{ id: number }>('SELECT id FROM fete_volunteers WHERE person_id = $1', [id])).data[0]
  const contact = (await retoolDb.query<{ id: number }>('SELECT id FROM fete_contacts WHERE person_id = $1', [id])).data[0]

  if (account) await removeAccount(account.id)
  if (volunteer) await removeVolunteer(volunteer.id)
  if (contact) await removeContact(contact.id)
  await retoolDb.query('DELETE FROM person_roles WHERE person_id = $1', [id])
  await retoolDb.query('DELETE FROM people WHERE id = $1', [id])
  return { success: true }
}
