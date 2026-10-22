# Wall of Gratitude

Collect compliments and thank-yous for coworkers at the party, then print them as anonymous cut-out cards.

- **Guests** get one link and only see a form: who it's for, the message, and their name.
- **You (admin)** see every message, including who wrote it, and can delete, download CSV, and print.
- **Printed cards** show only the recipient and message. The author is never printed.

No packages to install. Needs Node.js 22.9 or newer.

## 1. Set your admin password (one time)

Copy `.env.example` to `.env` and change the password:

```
ADMIN_PASSWORD=pick-something-good
```

`.env` is git-ignored. The server won't start without it.

## 2. Run it

**Office + remote guests (recommended):**

1. One-time install of Cloudflare's free tunnel tool, then open a **new** terminal:
   ```
   winget install Cloudflare.cloudflared
   ```
2. Start everything:
   ```
   npm run share
   ```
3. Send the `https://....trycloudflare.com` link it prints to everyone. Your admin page is that same link plus `/admin`.

Keep the window open and the laptop awake for the whole party. The link changes each time you restart, so start it once and leave it running. Submissions are saved, so a restart never loses data.

**Office network only:** `npm start`, then share the "Office network" address it prints.

**If `cloudflared` is blocked by IT:** run `npm start`, then in VS Code open the **Ports** panel, forward port `3000`, right-click the port, set *Port Visibility* to **Public**, and share that URL.

## 3. Admin and printing

Go to `/admin` and log in. The username can be anything; the password is your `ADMIN_PASSWORD`.

- **Entries:** search, delete anything inappropriate, or download everything as CSV (includes authors).
- **Print cards:** choose the order (grouped by recipient, newest, or oldest), the number of columns, and the text size, then click **Print**. Cards size to their text and pack together to fill each page; cut along the dashed lines. Choose "Save as PDF" in the print dialog to keep a copy.

## Data

Everything is stored in `data/` (git-ignored):

- `compliments.json` — the live list the app reads.
- `compliments.log` — a backup log with one line for every submission and every delete. It's only ever added to, never rewritten.

If a save fails, the guest is told to try again and nothing half-saved is kept.

**If `compliments.json` is ever damaged or something is deleted by mistake:** stop the app, then run `node scripts/rebuild.js`. It recreates the list from the log and keeps the old file as `compliments.json.bak`. To bring back a deleted message, find its `"type":"delete"` line in the log and remove that line before rebuilding.

Back up the `data/` folder (or download the CSV) after the party.
