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
  const volunteerRoles = (await retoolDb.query<{ person_id: number; roles: string }>(`
    SELECT person_id, GROUP_CONCAT(role, '|') AS roles FROM volunteer_roles GROUP BY person_id
  `)).data
  const contactEvents = (await retoolDb.query<{ person_id: number; fete_ids: string; fete_names: string }>(`
    SELECT ce.person_id, GROUP_CONCAT(f.id, '|') AS fete_ids, GROUP_CONCAT(f.name, '|') AS fete_names
    FROM fete_contact_events ce
    JOIN fetes f ON f.id = ce.fete_id
    GROUP BY ce.person_id
  `)).data
  const createdFetes = (await retoolDb.query<{ person_id: number; fete_id: number; fete_name: string }>(`
    SELECT u.person_id, f.id AS fete_id, f.name AS fete_name
    FROM fetes f
    JOIN fete_users u ON u.id = f.created_by
    WHERE u.person_id IS NOT NULL
    ORDER BY f.event_date DESC, f.id DESC
  `)).data

  return people.map(person => {
    const personRoles = roles.filter(row => row.person_id === person.id).map(row => row.role)
    const account = accounts.find(row => row.person_id === person.id)
    const volunteer = volunteerRoles.find(row => row.person_id === person.id)
    const contact = contactEvents.find(row => row.person_id === person.id)
    return {
      ...person,
      roles: personRoles,
      user_id: account?.id ?? null,
      pin: account?.pin ?? '',
      // Volunteers and contacts are identified by their person id.
      volunteer_id: personRoles.includes('Volunteer') ? person.id : null,
      volunteer_roles: volunteer ? volunteer.roles.split('|') : [],
      contact_id: personRoles.includes('Contact') ? person.id : null,
      contact_fete_ids: contact ? contact.fete_ids.split('|').map(Number) : [],
      contact_fete_names: contact ? contact.fete_names.split('|') : [],
      created_fetes: createdFetes.filter(row => row.person_id === person.id)
        .map(row => ({ fete_id: row.fete_id, fete_name: row.fete_name })),
    }
  })
}
