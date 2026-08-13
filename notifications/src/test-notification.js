// Manual smoke test — run with `npm run test-notification` after setting up
// .env + service-account.json. Sends one push to every admin token found in
// Firestore, and runs both scheduled checks once (without waiting for cron)
// so you can confirm end-to-end delivery before trusting the live schedule.
import 'dotenv/config'
import { send, tokensByRole } from './fcm.js'
import { checkAmcPaymentsDue, checkAmcMaintenanceDue } from './schedule.js'

async function main() {
  console.log('Looking up admin tokens…')
  const tokens = await tokensByRole('admin')
  console.log(`Found ${tokens.length} admin device token(s).`)

  if (tokens.length) {
    const result = await send(tokens,
      { title: '✅ Notification service test', body: 'If you see this, the VPS notification worker can reach your devices.' },
      { type: 'test', channel: 'sk_general' }
    )
    console.log('Test push result:', result)
  } else {
    console.log('No admin tokens found — log into the app as an admin on a device first, then re-run this.')
  }

  console.log('\nRunning AMC payment-due check once…')
  await checkAmcPaymentsDue()

  console.log('\nRunning AMC maintenance-due check once…')
  await checkAmcMaintenanceDue()

  console.log('\nDone.')
  process.exit(0)
}

main().catch(e => {
  console.error('Test failed:', e)
  process.exit(1)
})
