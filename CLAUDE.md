# Wall of Gratitude

A small web app for a company party: guests submit compliments / thank-yous about coworkers, and the organizer reviews them and prints them as anonymous cut-out cards.

## Instructions for Claude
- **Keep this file up to date.** After any meaningful change (feature added, decision made, bug fixed, plan changed), update the Status checklist and add a dated line to the Progress Log below.
- Keep the app zero-dependency (Node built-ins only, no `npm install`) unless the user agrees otherwise.

## Requirements & decisions
- **Guests** only ever see a submit form. They must not be able to see any other submissions.
- **Form fields:** To (required), Message (required, ~500 char cap), From (required, only visible to the organizer).
- **Admin** (organizer only): sees everything including who wrote each message; can delete and export CSV. Protected by `ADMIN_PASSWORD` env var via HTTP Basic Auth; server refuses to start without it.
- **Printing:** cards showing To + message only (author hidden). Cards size to their text and pack tightly (CSS multi-column masonry) to make the most of each page; dashed borders for cutting; optional sort by recipient.
- **Access:** most guests are in the office, some are remote. App runs on the organizer's laptop and is shared via a Cloudflare quick tunnel (`cloudflared`, public `*.trycloudflare.com` URL). Fallback if blocked: VS Code port forwarding set to Public. The URL changes each time the tunnel restarts.
- **Spam protection:** simple per-IP rate limit on submissions, since the link is public.
- **Storage:** `data/compliments.json` (git-ignored), written via temp file + rename. Every add/delete goes through `commit()`, which saves to disk *before* updating memory (failed save → 500, nothing kept), then appends to the backup log `data/compliments.log` (JSONL). `scripts/rebuild.js` recreates the JSON from the log.
- **Hosting decision (in progress):** going live on **Azure App Service** (Linux, Node 22, Free F1, 1 instance) instead of laptop + tunnel. Collection window ~2+ weeks before the party, <200 people. Settings: `ADMIN_PASSWORD`, `DATA_DIR=/home/data`, HTTPS Only. User is meeting IT to stand it up; `AZURE.md` is the handoff guide.
- **Firewall:** company policy (GPO) blocks inbound connections to Node on this laptop, so the office-network IP does not work — the Cloudflare tunnel is required for everyone, not just remote guests.

## Structure
- `server.js` — HTTP server, routes, storage, admin auth, rate limit (20 posts / 10 min / IP, using `cf-connecting-ip` behind the tunnel)
- `scripts/share.js` — starts the server plus `cloudflared` and prints the public link
- `public/submit.html` + `submit.js` — guest form (remembers guest's own name in localStorage)
- `public/admin.html` + `admin.js` — admin entries table, delete, CSV export, print-cards tab (`/admin#print` opens it directly). Admin JS is also behind auth.
- `public/styles.css` — shared + `@media print` styles; G2O palette tokens at the top. `button.cta` = City accent, reserved for one main action per view
- `public/fonts/` — G2O brand fonts (Zodiak Light, Work Sans 400–700), served by `server.js` at `/fonts/*.woff2`
- `package.json` — `npm start` / `npm run share`, both load `.env` via `--env-file-if-exists`
- `.env.example` — template for `ADMIN_PASSWORD`
- `README.md` — how to run and share

## API
- `POST /api/compliments` — public; `{to, from, message}`, all required
- `GET /api/compliments` — admin; full list including `from`
- `GET /api/compliments.csv` — admin; CSV with formula-injection guard
- `DELETE /api/compliments/:id` — admin

## Status
- [x] Plan approved
- [x] Server + storage + API
- [x] Guest submit page
- [x] Admin page (list, search, delete, CSV)
- [x] Print layout (anonymous packed cards, 2/3/4 columns, text size, sort)
- [x] `npm run share` with Cloudflare tunnel (missing-cloudflared message tested)
- [x] README
- [x] Local tests: all routes, auth, validation, rate limit, CSV, screenshots, print-to-PDF
- [x] Azure-ready code: `DATA_DIR` env var; rate limit reads `X-Forwarded-For` (Azure sends `ip:port`)
- [x] `AZURE.md` handoff guide for IT
- [ ] User: meet IT, create App Service, set app settings, deploy, smoke test, soft launch
- [ ] Optional: submission closing date (offered, not yet requested)
- [ ] ~~Cloudflare tunnel~~ — superseded by Azure (script kept as fallback)
- [x] G2O branding (Zodiak Light headings, Work Sans body, River primary, City only on the main button per view)

## Progress log
- 2026-10-22 — Gathered requirements and approved the plan. Created this CLAUDE.md to track progress.
- 2026-10-22 — Built the full app. Verified via curl (guest/admin auth, validation, rate limit, CSV, delete, path traversal) and headless Edge (guest form, admin table, print PDF with 30 sample cards over 2 pages). Fixed admin fetches so they work when the page URL contains credentials. Test data removed. cloudflared not yet installed on this machine, so the live tunnel is untested.
- 2026-10-22 — User testing locally (`npm start` equivalent on port 3000, temp password `gratitude`); remote/tunnel work paused at user's request. Applied G2O branding via the g2o-brand skill and verified with screenshots.
- 2026-10-22 — Coworker couldn't open the localhost link; found GPO firewall blocks inbound, so tunnel is needed for all guests. Added data safety: save-before-memory `commit()`, append-only backup log (seeded from existing data on startup), `scripts/rebuild.js`. Tested on a scratch copy: save failure returns 500 and keeps nothing; restart persists data; rebuild recovers from a corrupted JSON file and skips a half-written log line. Decided to skip a delete-undo UI (log covers recovery).
- 2026-10-22 — Decided on Azure App Service (Free tier OK for <200 people over 2+ weeks). Added `DATA_DIR` support (server + rebuild script) and fixed rate limiting behind Azure's proxy (was keyed on the proxy IP, which would have throttled everyone together). Tested on scratch data: per-visitor limit works, custom data dir works. Wrote `AZURE.md` for the user's IT meeting.
- 2026-10-22 — Committed all work on branch `wall-of-gratitude-app` (not yet merged to `main` or pushed). Git user.name/email aren't configured on this machine; commits use `rcrawford783 <rcrawford@g2o.com>` from the initial commit.
