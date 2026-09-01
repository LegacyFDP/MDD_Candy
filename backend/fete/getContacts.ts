export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query<{
    id: number; name: string; email: string; phone: string; notes: string
    fete_ids: string | null; fete_names: string | null
  }>(`
    SELECT c.id, c.name, c.email, c.phone, c.notes,
           GROUP_CONCAT(f.id, '|') AS fete_ids,
           GROUP_CONCAT(f.name, '|') AS fete_names
    FROM fete_contacts c
    LEFT JOIN fete_contact_events ce ON ce.contact_id = c.id
    LEFT JOIN fetes f ON f.id = ce.fete_id
    GROUP BY c.id
    ORDER BY c.name ASC
  `)
  return result.data.map(contact => ({
    ...contact,
    fete_ids: contact.fete_ids ? contact.fete_ids.split('|').map(Number) : [],
    fete_names: contact.fete_names ? contact.fete_names.split('|') : [],
  }))
}