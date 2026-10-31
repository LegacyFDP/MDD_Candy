import {
  ACCOUNT_ROLES, PERSON_ROLES, VOLUNTEER_ROLES,
  assertAccountRemovable, removeAccount, removeContact, removeVolunteer,
} from './personRecords.ts'

type Params = {
  id?: number
  name: string
  email?: string
  phone?: string
  notes?: string
  roles: string[]
  pin?: string
  volunteer_roles?: string[]
  contact_fete_ids?: number[]
}

function clean(value: string | undefined): string {
  return (value ?? '').trim()
}

export default async function (req: { params: Params; user: User }) {
  const name = clean(req.params.name)
  const email = clean(req.params.email)
  const phone = clean(req.params.phone)
  const notes = clean(req.params.notes)
  const pin = clean(req.params.pin)
  const roles = [...new Set(req.params.roles ?? [])]
  const volunteerRoles = [...new Set((req.params.volunteer_roles ?? []).map(clean).filter(Boolean))]
  const feteIds = [...new Set(req.params.contact_fete_ids ?? [])]

  if (!name) throw new Error('Name is required')
  if (roles.length === 0) throw new Error('Select at least one role')
  if (!roles.every(role => (PERSON_ROLES as readonly string[]).includes(role))) {
    throw new Error(`Roles must be from: ${PERSON_ROLES.join(', ')}`)
  }
  if (!volunteerRoles.every(role => (VOLUNTEER_ROLES as readonly string[]).includes(role))) {
    throw new Error(`Volunteer roles must be one of: ${VOLUNTEER_ROLES.join(', ')}`)
  }

  const hasAccount = roles.some(role => (ACCOUNT_ROLES as readonly string[]).includes(role))
  const isVolunteer = roles.includes('Volunteer')
  const isContact = roles.includes('Contact')
  if (hasAccount && (!email || !pin)) throw new Error('Email and PIN are required for User, Admin and Store Keeper roles')
  if (isContact && feteIds.length === 0) throw new Error('A contact must be linked to at least one event')

  const existing = req.params.id
    ? (await retoolDb.query<{ id: number }>('SELECT id FROM people WHERE id = $1', [req.params.id])).data[0]
    : undefined
  if (req.params.id && !existing) throw new Error('Person not found')

  const accountRow = existing
    ? (await retoolDb.query<{ id: number }>('SELECT id FROM fete_users WHERE person_id = $1', [existing.id])).data[0]
    : undefined
  const volunteerRow = existing
    ? (await retoolDb.query<{ id: number }>('SELECT id FROM fete_volunteers WHERE person_id = $1', [existing.id])).data[0]
    : undefined
  const contactRow = existing
    ? (await retoolDb.query<{ id: number }>('SELECT id FROM fete_contacts WHERE person_id = $1', [existing.id])).data[0]
    : undefined

  if (hasAccount) {
    const clash = await retoolDb.query<{ id: number }>(
      'SELECT id FROM fete_users WHERE LOWER(email) = LOWER($1) AND id <> $2',
      [email, accountRow?.id ?? 0],
    )
    if (clash.data.length > 0) throw new Error('Another login account already uses this email address')
  } else if (accountRow) {
    await assertAccountRemovable(accountRow.id)
  }

  let personId = existing?.id
  if (personId) {
    await retoolDb.query(
      'UPDATE people SET name=$1, email=$2, phone=$3, notes=$4 WHERE id=$5',
      [name, email, phone, notes, personId],
    )
  } else {
    const created = await retoolDb.query<{ id: number }>(
      'INSERT INTO people (name, email, phone, notes) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, email, phone, notes],
    )
    personId = created.data[0]?.id
  }

  await retoolDb.query('DELETE FROM person_roles WHERE person_id = $1', [personId])
  for (const role of roles) {
    await retoolDb.query('INSERT INTO person_roles (person_id, role) VALUES ($1, $2)', [personId, role])
  }

  // The login's permission level comes from person_roles; see accountRoleSql.
  if (hasAccount) {
    if (accountRow) {
      await retoolDb.query(
        'UPDATE fete_users SET email=$1, pin=$2 WHERE id=$3',
        [email, pin, accountRow.id],
      )
    } else {
      await retoolDb.query(
        'INSERT INTO fete_users (email, pin, person_id) VALUES ($1, $2, $3)',
        [email, pin, personId],
      )
    }
  } else if (accountRow) {
    await removeAccount(accountRow.id)
  }

  if (isVolunteer) {
    let volunteerId = volunteerRow?.id
    if (!volunteerId) {
      const created = await retoolDb.query<{ id: number }>(
        'INSERT INTO fete_volunteers (person_id) VALUES ($1) RETURNING id',
        [personId],
      )
      volunteerId = created.data[0]?.id
    }
    await retoolDb.query('DELETE FROM volunteer_roles WHERE volunteer_id = $1', [volunteerId])
    for (const role of volunteerRoles) {
      await retoolDb.query('INSERT INTO volunteer_roles (volunteer_id, role) VALUES ($1, $2)', [volunteerId, role])
    }
  } else if (volunteerRow) {
    await removeVolunteer(volunteerRow.id)
  }

  if (isContact) {
    let contactId = contactRow?.id
    if (!contactId) {
      const created = await retoolDb.query<{ id: number }>(
        'INSERT INTO fete_contacts (person_id) VALUES ($1) RETURNING id',
        [personId],
      )
      contactId = created.data[0]?.id
    }
    await retoolDb.query('DELETE FROM fete_contact_events WHERE contact_id = $1', [contactId])
    for (const feteId of feteIds) {
      await retoolDb.query('INSERT INTO fete_contact_events (contact_id, fete_id) VALUES ($1, $2)', [contactId, feteId])
    }
  } else if (contactRow) {
    await removeContact(contactRow.id)
  }

  return { success: true, id: personId }
}
