type Params = {
  id?: number
  name: string
  description: string
  address_line1: string
  address_line2?: string
  town_city: string
  county?: string
  postcode: string
}

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/

function clean(value: string | undefined): string {
  return (value ?? '').trim()
}

function formatUkPostcode(postcode: string): string {
  const compact = postcode.toUpperCase().replace(/\s+/g, '')
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`
}

export default async function (req: { params: Params; user: User }) {
  const { id } = req.params
  const name = clean(req.params.name)
  const description = clean(req.params.description)
  const addressLine1 = clean(req.params.address_line1)
  const addressLine2 = clean(req.params.address_line2)
  const townCity = clean(req.params.town_city)
  const county = clean(req.params.county)
  const rawPostcode = clean(req.params.postcode)
  const postcodeCompact = rawPostcode.toUpperCase().replace(/\s+/g, '')

  if (!name) throw new Error('Location name is required')
  if (postcodeCompact && !UK_POSTCODE_REGEX.test(postcodeCompact)) {
    throw new Error('Please enter a valid UK postcode')
  }

  const postcode = postcodeCompact ? formatUkPostcode(rawPostcode) : ''

  if (id) {
    await retoolDb.query(`
      UPDATE store_locations
      SET name=$1,
          description=$2,
          address_line1=$3,
          address_line2=$4,
          town_city=$5,
          county=$6,
          postcode=$7
      WHERE id=$8
    `, [name, description, addressLine1, addressLine2, townCity, county, postcode, id])
  } else {
    await retoolDb.query(`
      INSERT INTO store_locations (
        name,
        description,
        address_line1,
        address_line2,
        town_city,
        county,
        postcode
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [name, description, addressLine1, addressLine2, townCity, county, postcode])
  }
  return { success: true }
}
