import 'dotenv/config'
import { startComplaintListener } from './complaints.js'
import { startSchedules } from './schedule.js'

console.log('[amc-notifications] starting…')

startComplaintListener()
startSchedules()

console.log('[amc-notifications] running. Press Ctrl+C to stop (or let PM2 manage it — see setup.md).')

// Keep the process alive and log unhandled errors instead of crashing silently.
process.on('unhandledRejection', (err) => {
  console.error('[amc-notifications] unhandled rejection:', err)
})
process.on('SIGTERM', () => { console.log('[amc-notifications] SIGTERM received, exiting.'); process.exit(0) })
process.on('SIGINT',  () => { console.log('[amc-notifications] SIGINT received, exiting.');  process.exit(0) })
