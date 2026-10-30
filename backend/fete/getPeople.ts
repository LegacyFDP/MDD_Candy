type PersonRow = { id: number; name: string; email: string; phone: string; notes: string }

export default async function (_req: { params: Record<string, never>; user: User }) {
  const people = (await retoolDb.query<PersonRow>(
    'SELECT id, name, email, phone, notes FROM people ORDER BY name COLLATE NOCASE ASC, id ASC',
  )).data
  const roles = (await retoolDb.query<{ person_id: number; role: string }>(
    'SELECT person_id, role FROM person_roles',
  )).data
  const accounts = (await retoolDb.query<{ id: number; person_id: number; pin: string }>(
    'SELECT id, person_id, pin FROM fete_users WHERE person_id IS NOT NULL',
  )).data
  const volunteers = (await retoolDb.query<{ id: number; person_id: number; roles: string | null }>(`
    SELECT v.id, v.person_id, GROUP_CONCAT(vr.role, '|') AS roles
    FROM fete_volunteers v
    LEFT JOIN volunteer_roles vr ON vr.volunteer_id = v.id
    WHERE v.person_id IS NOT NULL
    GROUP BY v.id
  `)).data
  const contacts = (await retoolDb.query<{ id: number; person_id: number; fete_ids: string | null; fete_names: string | null }>(`
    SELECT c.id, c.person_id, GROUP_CONCAT(f.id, '|') AS fete_ids, GROUP_CONCAT(f.name, '|') AS fete_names
    FROM fete_contacts c
    LEFT JOIN fete_contact_events ce ON ce.contact_id = c.id
    LEFT JOIN fetes f ON f.id = ce.fete_id
    WHERE c.person_id IS NOT NULL
    GROUP BY c.id
  `)).data
  const createdFetes = (await retoolDb.query<{ person_id: number; fete_id: number; fete_name: string }>(`
    SELECT u.person_id, f.id AS fete_id, f.name AS fete_name
    FROM fetes f
    JOIN fete_users u ON u.id = f.created_by
    WHERE u.person_id IS NOT NULL
    ORDER BY f.event_date DESC, f.id DESC
  `)).data

  return people.map(person => {
    const account = accounts.find(row => row.person_id === person.id)
    const volunteer = volunteers.find(row => row.person_id === person.id)
    const contact = contacts.find(row => row.person_id === person.id)
    return {
      ...person,
      roles: roles.filter(row => row.person_id === person.id).map(row => row.role),
      user_id: account?.id ?? null,
      pin: account?.pin ?? '',
      volunteer_id: volunteer?.id ?? null,
      volunteer_roles: volunteer?.roles ? volunteer.roles.split('|') : [],
      contact_id: contact?.id ?? null,
      contact_fete_ids: contact?.fete_ids ? contact.fete_ids.split('|').map(Number) : [],
      contact_fete_names: contact?.fete_names ? contact.fete_names.split('|') : [],
      created_fetes: createdFetes.filter(row => row.person_id === person.id)
        .map(row => ({ fete_id: row.fete_id, fete_name: row.fete_name })),
    }
  })
}
