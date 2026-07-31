export default async function (req: {
  params: { id: number; status: 'approved' | 'rejected'; notes?: string }
  user: User
}) {
  if (req.user.role !== 'admin') {
    throw new Error('Admin access required.')
  }

  const { id, status, notes = '' } = req.params

  if (!id || !['approved', 'rejected'].includes(status)) {
    throw new Error('id and status (approved or rejected) are required.')
  }

  const existing = await retoolDb.query<{ id: number; fete_id: number; name: string; status: string }>(
    'SELECT id, fete_id, name, status FROM volunteer_booking_requests WHERE id = $1',
    [id],
  )

  if (existing.data.length === 0) {
    throw new Error('Booking request not found.')
  }

  if (existing.data[0].status !== 'pending') {
    throw new Error(`Booking request has already been ${existing.data[0].status}.`)
  }

  await retoolDb.query(
    `UPDATE volunteer_booking_requests
     SET status = $1, notes = $2, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $3
     WHERE id = $4`,
    [status, notes, req.user.id, id],
  )

  return {
    id,
    status,
    volunteer_name: existing.data[0].name,
    message: `Booking request ${status} for ${existing.data[0].name}.`,
  }
}
