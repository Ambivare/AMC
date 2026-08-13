# AMC Notifications — VPS Deployment Guide

This is a small, standalone Node.js background worker that sends push
notifications (via Firebase Cloud Messaging) for:

- **AMC payment due** — reminders before an installment is due (7/3/1 days by default)
- **AMC maintenance due** — reminders when a contract's scheduled service visit is due/overdue
- **Complaint created / assigned** — pushed to the assigned technician(s) the moment a complaint is logged or reassigned
- **Complaint resolved** — pushed to all admins the moment a complaint's status flips to resolved/closed

It replaces what would normally be Firebase Cloud Functions (which require
the paid "Blaze" plan) — this runs on **your own VPS** instead, for free
beyond the VPS itself.

## Important: no public URL is needed

This worker never receives incoming traffic. It only makes **outbound**
connections to Firebase (a Firestore realtime listener + the FCM send API).
That means:

- No domain name required
- No SSL certificate required
- No nginx/reverse proxy required
- No open inbound port required

It's a background process, not a web server. If your VPS provider asks "what
port does this listen on" — none. You're deploying a script that stays
running, the same way you'd run a chat bot or a cron daemon.

---

## Step 1 — Get a Firebase service account key

This key lets the worker read/write Firestore and send FCM pushes with full
admin rights (it bypasses your Firestore security rules, same as Cloud
Functions would).

1. Go to the [Firebase Console](https://console.firebase.google.com/) → open
   the **avantelevators-dff70** project (the same project ID in
   `src/firebase/config.js`).
2. Click the gear icon → **Project settings** → **Service accounts** tab.
3. Click **Generate new private key** → confirm. A `.json` file downloads.
4. Rename it to `service-account.json` and keep it somewhere safe — you'll
   upload it to the VPS in Step 4. **Never commit this file to git** (it's
   already in `.gitignore` here).

## Step 2 — Get a Web Push VAPID key (only needed for browser/desktop push)

The Android APK's push notifications work without this (Capacitor's native
push plugin handles it). If you only care about notifying technicians on
their phones via the APK, you can **skip this step**.

If you also want notifications to work when someone has the app open in a
regular web browser:

1. Firebase Console → **Project settings** → **Cloud Messaging** tab.
2. Under **Web configuration → Web Push certificates**, click **Generate key pair**.
3. Copy the long key (starts with `B…`).
4. Open `src/firebase/config.js` in the main app repo and replace:
   ```js
   export const VAPID_KEY = 'YOUR_VAPID_KEY_HERE'
   ```
   with your key, then rebuild/redeploy the frontend. This is a one-time
   change to the main app, not to this `notifications/` folder.

## Step 3 — Provision the VPS

Any small VPS works (1 vCPU / 512MB–1GB RAM is plenty — this process is
mostly idle, waiting on Firestore events and cron ticks). Examples:
DigitalOcean, Hetzner, Linode, AWS Lightsail, or any Ubuntu/Debian box you
already have.

SSH in, then install Node.js 18+ (via NodeSource, or `nvm`):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # confirm v18 or newer
```

Install PM2 globally (keeps the worker running, restarts it if it crashes,
restarts it on server reboot):

```bash
sudo npm install -g pm2
```

## Step 4 — Deploy the code

Clone just this repo (or copy the `notifications/` folder up via `scp` if
you don't want the whole app on the VPS):

```bash
git clone https://github.com/Ambivare/AMC.git
cd AMC/notifications
npm install
```

Upload your `service-account.json` from Step 1 into this same
`AMC/notifications/` folder (e.g. `scp service-account.json youruser@your-vps-ip:~/AMC/notifications/`).

Create your `.env` from the example and edit it:

```bash
cp .env.example .env
nano .env
```

The defaults in `.env.example` already point at `./service-account.json` and
use `Asia/Kolkata` — you likely don't need to change anything unless you want
different reminder day offsets.

## Step 5 — Test before trusting it

Run the manual smoke test — it sends one push to every logged-in admin and
runs both scheduled checks immediately (instead of waiting for the cron
time):

```bash
npm run test-notification
```

You should see console output like:

```
Found 2 admin device token(s).
Test push result: { sent: 2 }
Running AMC payment-due check once…
[schedule] AMC payment due check — 1 reminder(s) sent
Running AMC maintenance-due check once…
[schedule] AMC maintenance due check — 0 reminder(s) sent
Done.
```

If `Found 0 admin device token(s)` — log into the app as an admin on a phone
or browser first (that's what writes the `fcmTokens` Firestore doc this
worker reads), then re-run the test.

## Step 6 — Run it permanently with PM2

```bash
pm2 start src/index.js --name amc-notifications
pm2 save
pm2 startup   # follow the one-line command it prints, to survive VPS reboots
```

Useful commands afterward:

```bash
pm2 logs amc-notifications      # tail live logs
pm2 restart amc-notifications   # after editing code or .env
pm2 stop amc-notifications
pm2 status                      # confirm it's "online"
```

## Updating later

```bash
cd ~/AMC
git pull
cd notifications
npm install        # only if package.json changed
pm2 restart amc-notifications
```

---

## What each file does

| File | Purpose |
|---|---|
| `src/firebase.js` | One-time firebase-admin init from your service account key |
| `src/fcm.js` | Looks up device tokens by role/username, sends FCM pushes |
| `src/dates.js` | AMC frequency/date math (installment counts, due dates, service periods) — mirrors the frontend's logic |
| `src/complaints.js` | Real-time Firestore listener → notifies on complaint create/assign/resolve |
| `src/schedule.js` | Daily cron jobs → AMC payment-due and AMC maintenance-due reminders |
| `src/index.js` | Starts everything and keeps the process alive |
| `src/test-notification.js` | One-off manual test (`npm run test-notification`) |

## Notification schedule (all times IST)

| Notification | When | Recipients |
|---|---|---|
| New complaint (unassigned) | Immediately on creation | Admin + all technicians |
| New complaint (pre-assigned) | Immediately on creation | Assigned technician(s) + admin |
| Complaint reassigned | Immediately on change | Newly assigned technician(s) |
| Complaint resolved/closed | Immediately on status change | Admin |
| AMC installment due | Daily 9:00 AM — 7/3/1 days before due | Admin |
| AMC maintenance due | Daily 8:00 AM — due today, 3 & 7 days overdue | Assigned technician(s) + admin |

Adjust the reminder day offsets via `AMC_PAYMENT_REMINDER_DAYS` and
`AMC_MAINTENANCE_REMINDER_DAYS` in `.env`, then `pm2 restart amc-notifications`.

## Troubleshooting

- **"Could not load Firebase service account…"** — `service-account.json`
  isn't where `.env`'s `FIREBASE_SERVICE_ACCOUNT_PATH` points, or the JSON is
  malformed. Re-download it from Firebase Console if unsure.
- **Pushes never arrive on a phone** — confirm that phone has actually
  logged into the app at least once (writes `fcmTokens/{userId}`), and that
  notification permission was granted on the device.
- **`sent: 0` in test output but tokens exist** — the token may be stale
  (app uninstalled/reinstalled without a fresh login). It'll self-correct
  next time that user logs in.
- **Process keeps restarting in `pm2 status`** — check `pm2 logs
  amc-notifications --lines 50` for the actual error, almost always a
  missing/invalid `.env` or service account file.
