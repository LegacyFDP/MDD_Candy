export default async function (_req: { params: Record<string, never>; user: User }) {
  // A volunteer is a person with the Volunteer role; their id is the person id.
  const result = await retoolDb.query<{ id: number; name: string; email: string; phone: string; roles: string | null; notes: string; created_at: string }>(`
    SELECT p.id, p.name, p.email, p.phone,
           GROUP_CONCAT(vr.role, '|') AS roles,
           p.notes, p.created_at
    FROM people p
    JOIN person_roles pr ON pr.person_id = p.id AND pr.role = 'Volunteer'
    LEFT JOIN volunteer_roles vr ON vr.person_id = p.id
    GROUP BY p.id
    ORDER BY p.name ASC
  `)
  return result.data.map(volunteer => ({
    ...volunteer,
    roles: volunteer.roles ? volunteer.roles.split('|') : [],
  }))
}
