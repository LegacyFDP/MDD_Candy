export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query<{ id: number; name: string; email: string; phone: string; role: string; notes: string; created_at: string }>(`
    SELECT id, name, email, phone, role, notes, created_at
    FROM fete_volunteers
    ORDER BY name ASC
  `)
  return result.data
}
