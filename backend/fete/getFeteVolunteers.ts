export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query(`
    SELECT fv.id, fv.fete_id, fv.role, fv.notes, fv.added_at,
           u.id   AS user_id,
           u.name AS user_name,
           u.email,
           u.role AS user_role
    FROM fete_volunteers fv
    JOIN fete_users u ON fv.user_id = u.id
    ORDER BY fv.fete_id, u.name ASC
  `)
  return result.data
}
