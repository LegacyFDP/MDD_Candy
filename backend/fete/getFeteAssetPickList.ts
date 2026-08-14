type Params = {
  fete_id?: number
  status?: 'planned' | 'active' | 'completed' | 'all'
}

export default async function (req: { params: Params; user: User }) {
  const { fete_id, status } = req.params

  const conditions: string[] = []
  const values: Array<number | string> = []

  if (typeof fete_id === 'number') {
    values.push(fete_id)
    conditions.push(`f.id = $${values.length}`)
  }

  if (status && status !== 'all') {
    values.push(status)
    conditions.push(`f.status = $${values.length}`)
  } else if (!status) {
    conditions.push(`f.status IN ('planned', 'active')`)
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : ''

  const result = await retoolDb.query(`
    WITH requirements AS (
      SELECT
        fr.fete_id,
        fr.asset_id,
        SUM(fr.quantity_needed) AS quantity_needed,
        COALESCE(MAX(NULLIF(TRIM(fr.notes), '')), '') AS requirement_notes
      FROM fete_requirements fr
      GROUP BY fr.fete_id, fr.asset_id
    ),
    booked_withdrawals AS (
      SELECT
        w.fete_id,
        w.asset_id,
        SUM(w.quantity) AS quantity_booked,
        COALESCE(MAX(NULLIF(TRIM(w.notes), '')), '') AS booking_notes
      FROM withdrawals w
      WHERE w.status = 'booked'
        AND w.fete_id IS NOT NULL
      GROUP BY w.fete_id, w.asset_id
    ),
    out_withdrawals AS (
      SELECT w.fete_id, w.asset_id, SUM(w.quantity) AS quantity_out
      FROM withdrawals w
      WHERE w.status = 'out'
      GROUP BY w.fete_id, w.asset_id
    ),
    pick_keys AS (
      SELECT fete_id, asset_id FROM requirements
      UNION
      SELECT fete_id, asset_id FROM booked_withdrawals
      UNION
      SELECT fete_id, asset_id FROM out_withdrawals
    )
    SELECT
      f.id AS fete_id,
      f.name AS fete_name,
      f.event_date,
      f.status AS fete_status,
      fl.name AS fete_location_name,
      a.id AS asset_id,
      a.name AS asset_name,
      a.category,
      sl.name AS store_location_name,
      COALESCE(r.quantity_needed, 0) AS quantity_needed,
      COALESCE(bw.quantity_booked, 0) AS quantity_booked,
      COALESCE(ow.quantity_out, 0) AS quantity_out,
      CASE
        WHEN COALESCE(bw.quantity_booked, 0) > 0 THEN COALESCE(bw.quantity_booked, 0)
        ELSE COALESCE(r.quantity_needed, 0)
      END AS quantity_required,
      CASE
        WHEN (
          CASE
            WHEN COALESCE(bw.quantity_booked, 0) > 0 THEN COALESCE(bw.quantity_booked, 0)
            ELSE COALESCE(r.quantity_needed, 0)
          END
        ) - COALESCE(ow.quantity_out, 0) > 0
          THEN (
            CASE
              WHEN COALESCE(bw.quantity_booked, 0) > 0 THEN COALESCE(bw.quantity_booked, 0)
              ELSE COALESCE(r.quantity_needed, 0)
            END
          ) - COALESCE(ow.quantity_out, 0)
        ELSE 0
      END AS quantity_to_pick,
      a.quantity_available,
      CASE
        WHEN (
          (
            CASE
              WHEN COALESCE(bw.quantity_booked, 0) > 0 THEN COALESCE(bw.quantity_booked, 0)
              ELSE COALESCE(r.quantity_needed, 0)
            END
          ) - COALESCE(ow.quantity_out, 0)
        ) - a.quantity_available > 0
          THEN (
            (
              CASE
                WHEN COALESCE(bw.quantity_booked, 0) > 0 THEN COALESCE(bw.quantity_booked, 0)
                ELSE COALESCE(r.quantity_needed, 0)
              END
            ) - COALESCE(ow.quantity_out, 0)
          ) - a.quantity_available
        ELSE 0
      END AS quantity_short,
      COALESCE(r.requirement_notes, '') AS requirement_notes,
      COALESCE(bw.booking_notes, '') AS booking_notes
    FROM pick_keys pk
    JOIN fetes f ON pk.fete_id = f.id
    JOIN assets a ON pk.asset_id = a.id
    LEFT JOIN requirements r
      ON r.fete_id = pk.fete_id
     AND r.asset_id = pk.asset_id
    LEFT JOIN booked_withdrawals bw
      ON bw.fete_id = pk.fete_id
     AND bw.asset_id = pk.asset_id
    LEFT JOIN store_locations sl ON a.location_id = sl.id
    LEFT JOIN store_locations fl ON f.location_id = fl.id
    LEFT JOIN out_withdrawals ow
      ON ow.fete_id = pk.fete_id
     AND ow.asset_id = pk.asset_id
    ${whereClause}
    ORDER BY f.event_date ASC, f.name ASC, a.category ASC, a.name ASC
  `, values)

  return result.data
}