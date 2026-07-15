/**
 * Google service account → short-lived OAuth2 access token.
 * Uses crypto.subtle (available in all CF Workers runtimes) to sign
 * a JWT with the service account private key, then exchanges it for
 * a bearer token via the Google token endpoint.
 *
 * The token is cached at module scope for 55 minutes; Workers that
 * stay warm across requests reuse it without re-signing.
 */

let _cachedToken = null
let _cacheExpiry  = 0

export async function getAccessToken(env) {
  if (_cachedToken && Date.now() < _cacheExpiry) return _cachedToken

  const cryptoKey = await importPrivateKey(env.SA_PRIVATE_KEY)

  const now = Math.floor(Date.now() / 1000)
  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({
    iss:   env.SA_EMAIL,
    scope: [
      'https://www.googleapis.com/auth/firebase.messaging',
      'https://www.googleapis.com/auth/datastore',
    ].join(' '),
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }))

  const toSign  = `${header}.${payload}`
  const sigBuf  = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(toSign),
  )
  const jwt = `${toSign}.${b64urlBuf(sigBuf)}`

  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const json = await res.json()
  if (!json.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(json)}`)

  _cachedToken = json.access_token
  _cacheExpiry  = Date.now() + ((json.expires_in || 3600) - 300) * 1000
  return _cachedToken
}

async function importPrivateKey(pem) {
  const clean = pem.replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  const binary = Uint8Array.from(atob(clean), c => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8',
    binary,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

function b64url(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlBuf(buf) {
  const bytes = new Uint8Array(buf)
  let raw = ''
  for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i])
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
