export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query(`
    SELECT id, name, description FROM store_locations ORDER BY name ASC
  `)
  return result.data
}
