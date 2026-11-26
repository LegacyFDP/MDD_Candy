import {
  isSuperuser, personIsSuperuser, removeAccount, removeContact, removeVolunteer, removeWithdrawalHistory,
} from './personRecords.ts'

type Params = {
  id: number
  /**
   * Superuser only: also permanently delete the person's withdrawal history,
   * which otherwise blocks removing their login. Meant for demo/test accounts.
   */
  delete_withdrawals?: boolean
}

export default async function (req: { params: Params; user: User }) {
  const { id, delete_withdrawals: deleteWithdrawals = false } = req.params
  if (req.user && !isSuperuser(req.user) && await personIsSuperuser(id)) {
    throw new Error('Only the Superuser can remove the Superuser')
  }
  if (deleteWithdrawals && req.user && !isSuperuser(req.user)) {
    throw new Error('Only the Superuser can delete withdrawal history')
  }
  const account = (await retoolDb.query<{ id: number }>('SELECT id FROM fete_users WHERE person_id = $1', [id])).data[0]

  if (account && deleteWithdrawals) await removeWithdrawalHistory(account.id)
  if (account) await removeAccount(account.id)
  await removeVolunteer(id)
  await removeContact(id)
  await retoolDb.query('DELETE FROM person_roles WHERE person_id = $1', [id])
  await retoolDb.query('DELETE FROM people WHERE id = $1', [id])
  return { success: true }
}
