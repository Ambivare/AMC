/**
 * FCM HTTP v1 API sender for Cloudflare Workers.
 *
 * The v1 API sends one message per token (no native multicast).
 * For a staff team of <100 people this is perfectly fast as all
 * requests run in parallel via Promise.all.
 */

export async function send(accessToken, projectId, tokens, notification, data = {}) {
  const clean = [...new Set(tokens.filter(Boolean))]
  if (!clean.length) return

  const strData   = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? '')]))
  const channelId = strData.channel || 'sk_general'
  const endpoint  = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`

  await Promise.all(clean.map(token =>
    fetch(endpoint, {
      method:  'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        message: {
          token,
          notification,
          data: strData,
          android: {
            priority:     'high',
            notification: { channel_id: channelId, sound: 'default' },
          },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        },
      }),
    }).catch(e => console.error('[FCM] send error for token:', token.slice(-8), e.message))
  ))
}

/** Send to roles + optional extra user names. */
export async function sendToRoleAndUser(accessToken, projectId, fs, roles, extraNames, notification, data) {
  const { tokensByRole, tokensByUserNames } = fs
  const [roleTokens, nameTokens] = await Promise.all([
    tokensByRole(accessToken, projectId, ...roles),
    tokensByUserNames(accessToken, projectId, extraNames),
  ])
  await send(accessToken, projectId, [...roleTokens, ...nameTokens], notification, data)
}
