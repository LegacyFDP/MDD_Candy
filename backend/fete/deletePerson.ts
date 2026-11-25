import { isSuperuser, personIsSuperuser, removeAccount, removeContact, removeVolunteer } from './personRecords.ts'

type Params = { id: number }

export default async function (req: { params: Params; user: User }) {
  const { id } = req.params
  if (req.user && !isSuperuser(req.user) && await personIsSuperuser(id)) {
    throw new Error('Only the Superuser can remove the Superuser')
  }
  const account = (await retoolDb.query<{ id: number }>('SELECT id FROM fete_users WHERE person_id = $1', [id])).data[0]

  if (account) await removeAccount(account.id)
  await removeVolunteer(id)
  await removeContact(id)
  await retoolDb.query('DELETE FROM person_roles WHERE person_id = $1', [id])
  await retoolDb.query('DELETE FROM people WHERE id = $1', [id])
  return { success: true }
}
