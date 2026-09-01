export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query<{ id: number; name: string; email: string; phone: string; roles: string | null; notes: string; created_at: string }>(`
    SELECT v.id, v.name, v.email, v.phone,
           GROUP_CONCAT(vr.role, '|') AS roles,
           v.notes, v.created_at
    FROM fete_volunteers v
    LEFT JOIN volunteer_roles vr ON vr.volunteer_id = v.id
    GROUP BY v.id
    ORDER BY v.name ASC
  `)
  return result.data.map(volunteer => ({
    ...volunteer,
    roles: volunteer.roles ? volunteer.roles.split('|') : [],
  }))
}
