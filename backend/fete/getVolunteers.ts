export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query<{ id: number; name: string; email: string; phone: string; roles: string | null; notes: string; created_at: string }>(`
    SELECT v.id, p.name, p.email, p.phone,
           GROUP_CONCAT(vr.role, '|') AS roles,
           p.notes, v.created_at
    FROM fete_volunteers v
    JOIN people p ON p.id = v.person_id
    LEFT JOIN volunteer_roles vr ON vr.volunteer_id = v.id
    GROUP BY v.id
    ORDER BY p.name ASC
  `)
  return result.data.map(volunteer => ({
    ...volunteer,
    roles: volunteer.roles ? volunteer.roles.split('|') : [],
  }))
}
