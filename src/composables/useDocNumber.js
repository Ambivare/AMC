// Robust sequential document numbering for billing CRUDs.
//
// Numbering off `items.value.length + 1` (the old approach in every billing
// tab) breaks the moment a document is deleted or the list hasn't finished
// loading yet — both produce a number that collides with an existing
// document. This scans the actual numbers already in use instead, so the
// next number is always the true max + 1.

/** Highest number found for `field` values matching `regex` (capture group 1 = the number), or 0 if none. */
export function maxSeqNumber(items, field, regex) {
  let max = 0
  for (const it of (items || [])) {
    const v = it?.[field]
    if (!v) continue
    const m = regex.exec(v)
    if (!m) continue
    const n = parseInt(m[1], 10)
    if (!isNaN(n) && n > max) max = n
  }
  return max
}

/** Next `${prefix}-${NNN}` number (e.g. "Q-004"), scanning `items` for the current max. */
export function nextDocNumber(items, prefix, pad = 3, field = 'docNumber') {
  const regex = new RegExp(`^${prefix}-(\\d+)$`)
  const next = maxSeqNumber(items, field, regex) + 1
  return `${prefix}-${String(next).padStart(pad, '0')}`
}
