type Params = {
  id?: number
  name: string
  description: string
  notes?: string
  address_line1: string
  address_line2?: string
  town_city: string
  county?: string
  postcode: string
}

function clean(value: string | undefined): string {
  return (value ?? '').trim()
}

export default async function (req: { params: Params; user: User }) {
  const { id } = req.params
  const name = clean(req.params.name)
  const description = clean(req.params.description)
  const notes = clean(req.params.notes)
  const addressLine1 = clean(req.params.address_line1)
  const addressLine2 = clean(req.params.address_line2)
  const townCity = clean(req.params.town_city)
  const county = clean(req.params.county)
  const postcode = clean(req.params.postcode)

  if (!name) throw new Error('Location name is required')
  if (notes.length > 120) throw new Error('Location notes must be 120 characters or fewer')

  if (id) {
    await retoolDb.query(`
      UPDATE store_locations
      SET name=$1,
          description=$2,
          notes=$3,
          address_line1=$4,
          address_line2=$5,
          town_city=$6,
          county=$7,
          postcode=$8,
          location_type='Store'
      WHERE id=$9
        AND location_type='Store'
    `, [name, description, notes, addressLine1, addressLine2, townCity, county, postcode, id])
  } else {
    await retoolDb.query(`
      INSERT INTO store_locations (
        name,
        description,
        notes,
        address_line1,
        address_line2,
        town_city,
        county,
        postcode,
        location_type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Store')
    `, [name, description, notes, addressLine1, addressLine2, townCity, county, postcode])
  }
  return { success: true }
}
