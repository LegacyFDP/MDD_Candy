import { requireAdmin } from './_auth'

type Params = {
  id?: number
  name: string
  email: string
  address_line1?: string
  address_line2?: string
  town_city?: string
  county?: string
  postcode?: string
  phone_home?: string
  phone_mobile?: string
  skills?: string
  notes?: string
}

function clean(value: string | undefined): string {
  return (value ?? '').trim()
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UK_POSTCODE_REGEX = /^([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i
const PHONE_REGEX = /^[0-9+()\-\s]{7,20}$/

export default async function (req: { params: Params; user: User }) {
  requireAdmin(req.user)

  const { id } = req.params
  const name = clean(req.params.name)
  const email = clean(req.params.email).toLowerCase()
  const addressLine1 = clean(req.params.address_line1)
  const addressLine2 = clean(req.params.address_line2)
  const townCity = clean(req.params.town_city)
  const county = clean(req.params.county)
  const postcode = clean(req.params.postcode).toUpperCase()
  const phoneHome = clean(req.params.phone_home)
  const phoneMobile = clean(req.params.phone_mobile)
  const skills = clean(req.params.skills)
  const notes = clean(req.params.notes)

  if (!name) throw new Error('Volunteer name is required')
  if (!email) throw new Error('Volunteer email is required')
  if (!EMAIL_REGEX.test(email)) throw new Error('Please provide a valid email address')

  if (postcode && !UK_POSTCODE_REGEX.test(postcode)) {
    throw new Error('Please provide a valid UK postcode')
  }

  if (phoneHome && !PHONE_REGEX.test(phoneHome)) {
    throw new Error('Home phone contains invalid characters')
  }

  if (phoneMobile && !PHONE_REGEX.test(phoneMobile)) {
    throw new Error('Mobile phone contains invalid characters')
  }

  if (id) {
    await retoolDb.query(
      `
        UPDATE volunteers
        SET name=$1,
            email=$2,
            address_line1=$3,
            address_line2=$4,
            town_city=$5,
            county=$6,
            postcode=$7,
            phone_home=$8,
            phone_mobile=$9,
            skills=$10,
            notes=$11
        WHERE id=$12
      `,
      [
        name,
        email,
        addressLine1,
        addressLine2,
        townCity,
        county,
        postcode,
        phoneHome,
        phoneMobile,
        skills,
        notes,
        id,
      ],
    )
  } else {
    await retoolDb.query(
      `
        INSERT INTO volunteers (
          name,
          email,
          address_line1,
          address_line2,
          town_city,
          county,
          postcode,
          phone_home,
          phone_mobile,
          skills,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        name,
        email,
        addressLine1,
        addressLine2,
        townCity,
        county,
        postcode,
        phoneHome,
        phoneMobile,
        skills,
        notes,
      ],
    )
  }

  return { success: true }
}
