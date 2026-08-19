export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query(`
    SELECT id, name
    FROM asset_categories
    ORDER BY name COLLATE NOCASE ASC
  `)
  return result.data
}