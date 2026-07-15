/**
 * Minimal Firestore REST API client for Cloudflare Workers.
 * No Node.js SDK — uses the Firestore REST v1 API with a service account bearer token.
 */

function base(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
}

/** Run a structured query, returns array of matched documents as plain JS objects. */
async function runQuery(token, projectId, structuredQuery) {
  const res = await fetch(`${base(projectId)}:runQuery`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ structuredQuery }),
  })
  if (!res.ok) return []
  const rows = await res.json()
  return (Array.isArray(rows) ? rows : [])
    .filter(r => r.document)
    .map(r => ({ _id: r.document.name.split('/').pop(), ...docToObj(r.document) }))
}

/** Fetch a single document by collection + id. Returns plain JS object or null. */
export async function getDoc(token, projectId, collection, docId) {
  const res = await fetch(`${base(projectId)}/${collection}/${docId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const doc = await res.json()
  return { _id: docId, ...docToObj(doc) }
}

/** Write (set/merge) a document. */
export async function setDoc(token, projectId, collection, docId, data) {
  const fields = objToFields(data)
  const url = `${base(projectId)}/${collection}/${docId}?currentDocument.exists=false`
  const res = await fetch(`${base(projectId)}/${collection}/${docId}`, {
    method:  'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields }),
  })
  return res.ok
}

/** Get FCM tokens for one or more roles. */
export async function tokensByRole(token, projectId, ...roles) {
  const unique = [...new Set(roles)]
  const lists  = await Promise.all(unique.map(role =>
    runQuery(token, projectId, {
      from:   [{ collectionId: 'fcmTokens' }],
      where:  fieldEq('role', role),
      select: { fields: [{ fieldPath: 'token' }] },
    })
  ))
  return [...new Set(lists.flat().map(d => d.token).filter(Boolean))]
}

/** Get FCM token for a specific user (by their Firestore document id). */
export async function tokenByUserId(token, projectId, userId) {
  if (!userId) return null
  const doc = await getDoc(token, projectId, 'fcmTokens', userId)
  return doc?.token || null
}

/** Get FCM tokens by display name (userName field). */
export async function tokensByUserName(token, projectId, userName) {
  if (!userName) return []
  const docs = await runQuery(token, projectId, {
    from:   [{ collectionId: 'fcmTokens' }],
    where:  fieldEq('userName', userName),
    select: { fields: [{ fieldPath: 'token' }] },
  })
  return docs.map(d => d.token).filter(Boolean)
}

/** Get FCM tokens for an array of display names. */
export async function tokensByUserNames(token, projectId, names = []) {
  const unique = [...new Set(names.filter(Boolean))]
  if (!unique.length) return []
  const lists = await Promise.all(unique.map(n => tokensByUserName(token, projectId, n)))
  return [...new Set(lists.flat())]
}

/** Query a collection with a single field equality filter. */
export async function queryEqual(token, projectId, collection, field, value) {
  return runQuery(token, projectId, {
    from:  [{ collectionId: collection }],
    where: fieldEq(field, value),
  })
}

/** Query with an explicit where clause. Pass null where to get all docs. Optional limit. */
export async function queryWhere(token, projectId, collection, where, limit) {
  const q = { from: [{ collectionId: collection }] }
  if (where) q.where = where
  if (limit)  q.limit = limit
  return runQuery(token, projectId, q)
}

/** Export docToObj so otp.js can use it (for future map field parsing). */
export { docToObj }

/** Get all documents in a collection (use sparingly — full scan). */
export async function getAll(token, projectId, collection) {
  return runQuery(token, projectId, { from: [{ collectionId: collection }] })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fieldEq(path, value) {
  return {
    fieldFilter: {
      field: { fieldPath: path },
      op:    'EQUAL',
      value: valueToFS(value),
    },
  }
}

function valueToFS(val) {
  if (val === null || val === undefined) return { nullValue: null }
  if (typeof val === 'boolean') return { booleanValue: val }
  if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val }
  if (val instanceof Date) return { timestampValue: val.toISOString() }
  return { stringValue: String(val) }
}

function fsToVal(field) {
  if (!field) return null
  if ('nullValue'      in field) return null
  if ('booleanValue'   in field) return field.booleanValue
  if ('integerValue'   in field) return Number(field.integerValue)
  if ('doubleValue'    in field) return field.doubleValue
  if ('timestampValue' in field) return new Date(field.timestampValue)
  if ('stringValue'    in field) return field.stringValue
  if ('mapValue'       in field) return docToObj({ fields: field.mapValue.fields || {} })
  if ('arrayValue'     in field) return (field.arrayValue.values || []).map(fsToVal)
  return null
}

function docToObj(doc) {
  if (!doc?.fields) return {}
  return Object.fromEntries(Object.entries(doc.fields).map(([k, v]) => [k, fsToVal(v)]))
}

function objToFields(obj) {
  if (!obj || typeof obj !== 'object') return {}
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, valueToFS(v)])
  )
}
