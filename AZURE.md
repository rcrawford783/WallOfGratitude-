# Deploying Wall of Gratitude to Azure

A one-page guide for setting this app up with IT.

## What the app is

- A small Node.js web app with no packages to install and no database. Submissions are saved to a JSON file plus a backup log.
- Guests use `/` to submit compliments. The organizer uses `/admin`, protected by a password.
- Expected load: under 200 people over about 2 weeks, a few hundred submissions at most.

## What we need from IT

| Item | Value |
|---|---|
| Service | Azure **App Service** (Web App) |
| OS / runtime | **Linux**, **Node 22 LTS** |
| Plan | **Free (F1)** is enough. Basic (B1) if we want it to never sleep. |
| Instances | **1**. Do not scale out: the app stores data in a single file. |
| Access | Public (works for remote staff), or tell us if it must be VPN-only. |
| Name | e.g. `g2o-wall-of-gratitude` → `https://g2o-wall-of-gratitude.azurewebsites.net` |

## App settings (Configuration → Environment variables)

| Name | Value | Why |
|---|---|---|
| `ADMIN_PASSWORD` | a strong password | Required. The app won't start without it. |
| `DATA_DIR` | `/home/data` | Required. `/home` is permanent storage; without this, redeploys can wipe submissions. |

Also turn on:
- **HTTPS Only** (Settings → Configuration). Without it, the admin password could travel unencrypted.

No other settings are needed. Azure sets `PORT` automatically, and the app starts with `npm start`.

## Deploying the code

Any standard Node deploy works. The simplest options:

- **VS Code:** install the "Azure App Service" extension, right-click the project folder, choose **Deploy to Web App**, and pick the app.
- **Azure CLI**, from the project folder:
  ```
  az webapp up --name <app-name> --runtime "NODE:22-lts" --sku F1
  ```

Do **not** upload the `data/` folder or `.env` (they're git-ignored). Updates are deployed the same way and don't touch saved submissions, because those live in `/home/data`.

## After deploying: smoke test

1. Open the site link on a phone using cellular data and submit a test message.
2. Open `/admin`, log in, confirm the message is there, then delete it.
3. Restart the app from the Azure portal, then check `/admin` again to confirm data persists.
4. Send the link to 2–3 coworkers (including someone remote) before announcing it to everyone.

## Good to know

- **Free tier sleeps after about 20 minutes without visitors.** The next visitor waits 5–15 seconds while it wakes up.
- **Free tier daily limit is 60 minutes of processing.** Expected use is about 1 minute a day. If it's ever reached, the site pauses until the next day with no data lost; switching to B1 brings it back immediately.
- **Backups:** download the CSV from `/admin` weekly. Raw files are in `/home/data` (reachable via the Kudu/SSH console).
- **Recovery:** if `compliments.json` is damaged, run `DATA_DIR=/home/data node scripts/rebuild.js` from the SSH console to rebuild it from the log.
- **Optional:** IT can put `/admin` behind company Microsoft sign-in (App Service "Authentication") instead of relying only on the password.
