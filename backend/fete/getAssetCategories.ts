export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query(`
    SELECT c.id, c.name, COUNT(a.id) AS asset_count
    FROM asset_categories c
    LEFT JOIN assets a ON a.category_id = c.id
    GROUP BY c.id, c.name
    ORDER BY c.name COLLATE NOCASE ASC
  `)
  return result.data
}
