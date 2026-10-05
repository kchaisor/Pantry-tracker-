# Pantry

A personal pantry tracker you can install on an iPhone from Safari. Add what you have, count it down, and see what is expired or running out — without an account.

Data stays on the device (IndexedDB, with a localStorage fallback). After the first load, the app shell works offline.

## What’s in this version

- Add, edit, and delete pantry items
- Name, quantity + unit, category, expiry date, notes, optional barcode, and optional low-stock threshold
- Scan a product barcode (camera, photo, or typed digits) to find an item or start a new one
- Quick add on the list (name + Add) and one-tap recent items
- Matching names or barcodes bump quantity instead of creating a duplicate
- Kitchen starter categories plus custom labels
- Search by name or barcode, category filter, and stock filters (all / low / expiring / out)
- Sort by name, soonest expiry, or recently updated
- Thumb-friendly +/− quantity and “mark empty”
- Low-stock badges, a Low filter chip, and an in-app banner when you open the app
- Expiry highlighting (expired, use soon)
- Settings: JSON + CSV export, JSON restore (replace or merge)
- Light, dark, and system theme
- First-run welcome + empty states
- PWA: manifest, icons, service worker, iOS Add to Home Screen meta tags

Optional **Google Sheet sync** keeps a shared copy for bots and other editors (see [Google Sheet sync](#google-sheet-sync)). No user accounts.

Out of scope: recipes, shopping lists, App Store builds.

## Barcode scanning

Scan is in the header (barcode icon), on Quick add, in the empty state, and on the item editor.

1. Tap **Scan**. Pantry explains why it wants the camera, then asks Safari for permission.
2. Point the rear camera at a UPC/EAN. Chrome and other browsers use `BarcodeDetector` when the phone has it; iPhone Safari falls back to ZXing in the page.
3. If that item is already in the pantry, the count goes up by one and a toast confirms it.
4. If it is new, the editor opens with the barcode filled. Pantry tries a public Open Food Facts lookup for a name. If nothing comes back, type the name.

Camera is optional. **Type the numbers** or **Use a photo** if the live view fails.

### iPhone camera permission

HTTPS is required (GitHub Pages already is). The first Scan tap shows a short “why” screen, then Safari’s Allow / Don’t Allow prompt.

- Allow: the live view starts. Later visits skip the prompt.
- Don’t Allow: Pantry says so and offers retry plus typing the digits.
- To turn the camera back on after Don’t Allow:
  - Home Screen app: **Settings → Pantry → Camera → Allow**
  - Safari tab: **Settings → Safari → Camera** (or the site settings for `vinboy88.github.io`)
- Then open Scan and tap **Try camera again**.

Hold the barcode in the box with decent light. 1D grocery codes need to be reasonably large in the frame. Nothing from the camera is uploaded. A new item may request a product name from Open Food Facts; that is network-only and fails silently if you are offline.

## Low-stock alerts

Each item can have its own **low-stock threshold**. Leave it blank to use the default of **1** — so a count of 1 (and not 0) is flagged as low. Set `0` to skip the low badge for that item. Quantity `0` is still **Out**, which is a separate filter.

When you open Pantry, a banner lists items that are running low. Tap **Show** to jump to the Low filter. The same items get a **Low** pill on the card. If the Home Screen app supports it, the icon badge updates too.

Pantry does **not** use Web Push. Background push is not reliable for an iPhone Home Screen PWA, and this app has no server. Alerts are in-app (banner, badges, toast when a count crosses the threshold). Settings can optionally request a local reminder when you open the app, once per day — a graceful extra, not a background notification.

## Google Sheet sync

Pantry can sync with a shared Google Sheet so a separate bot (or human) can read and edit the same list. The phone still keeps IndexedDB for offline use; when sync runs, the sheet and local copy merge by `updatedAt` (last write wins).

### One-time setup

1. Open the **Pantry Tracker** spreadsheet → **Extensions** → **Apps Script**.
2. Create script files from this repo: paste `apps-script/Code.gs` and `apps-script/mergeLib.js` (same project).
3. In `Code.gs`, replace `REPLACE_WITH_TOKEN` in `SYNC_TOKEN` with a long random secret.
4. **Deploy** → **New deployment** → type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the web app URL and append `?token=YOUR_SECRET` (same value as `SYNC_TOKEN`).
6. In Pantry **Settings** → **Sheet sync**, paste that full URL and tap **Save sync URL**. Use **Sync now** to verify.

After deploy, add an `onEdit` trigger if you want sheet UI edits to bump `updatedAt` automatically: Apps Script → **Triggers** → add `onEdit` for the spreadsheet (the simple trigger in `Code.gs` runs for the editor only; an installable trigger is optional for bots).

### Bots editing the sheet directly

- Do **not** delete rows — set column **`deleted`** to `TRUE` (or `true`) and bump **`updatedAt`** to current epoch milliseconds.
- On any edit, set **`updatedAt`** to `Date.now()` (or an ISO string — the app and script accept both).
- Leave **`id`** as text; rows without an id get one assigned on the next sync.
- Keep **`expiryDate`** as `YYYY-MM-DD` text, **`barcode`** as text (leading zeros), and **`lowStockThreshold`** blank when unused.

Sync runs when you open the app, when the device goes online, when the tab becomes visible, shortly after local edits, and about once a minute while the app is open. Failures (offline, bad token, Google errors) leave local data unchanged and show an error in Settings.

**Replace pantry** (JSON restore) and **Load sample data** overwrite local rows without tombstones. Anything still on the sheet can reappear on the next sync — use sheet tombstones (`deleted=TRUE`) if you need those rows gone everywhere.

## Backup and restore

Open **Settings** (gear in the header).

- **Export JSON** — full pantry, including ids, thresholds, barcodes, and timestamps. Prefer this for restore.
- **Export CSV** — spreadsheet-friendly copy.
- **Choose JSON backup** then **Replace pantry** (primary restore: two-tap confirm, overwrites everything) or **Merge into pantry** (keeps current items; matching ids update; new ids are added).

On iPhone, export uses the share sheet when it can, so you can save to Files or iCloud Drive.

### Safari storage wipe

Safari can erase website data after unused time, especially if Pantry is **not** on the Home Screen. There is no cloud copy. Export JSON regularly, keep the file in Files/iCloud, and open the Home Screen app now and then so Safari is less likely to treat it as abandoned.

## Live site (GitHub Pages)

After this repo is merged to `main` and Pages is enabled, the app is at:

**https://vinboy88.github.io/Pantry-tracker-/**

The repository name ends with a hyphen (`Pantry-tracker-`). That hyphen is part of the URL.

### One-time setup (required)

GitHub does not start Pages until a repo admin picks the Actions source:

1. Open the repo on GitHub → **Settings** → **Pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions**
3. Save. The next push to `main` (or **Actions** → **Deploy GitHub Pages** → **Run workflow**) publishes `dist/`.

If the URL 404s after merge, this toggle is usually still set to “Deploy from a branch”.

A GitHub Actions workflow (`.github/workflows/pages.yml`) builds with `GITHUB_PAGES=true` so Vite uses the project base `/Pantry-tracker-/`, then deploys `dist/` with `upload-pages-artifact` + `deploy-pages`. Pull requests run the same production build (no deploy) so the Pages prefix stays green.

Local `npm run dev` and `npm run build` still use `/` and are unchanged.

## Local development

Requires Node 20+ and npm.

```bash
npm install
npm run dev
```

Vite prints a local URL (default `http://localhost:5173`). On the same Wi-Fi, the `--host` flag is already enabled so you can open the Network URL from a phone browser. Service workers only register in the production build.

## Production build

```bash
npm run build
npm run preview
```

That local production build uses `base: '/'` (same as `npm run dev`). `dist/` is a static site you can host anywhere that serves HTTPS.

To build the same way GitHub Pages does (prefixed assets):

```bash
npm run build:pages
```

Output then expects to be served under `/Pantry-tracker-/` (for example `http://localhost:4173/Pantry-tracker-/` if you preview that folder with the matching base).

```bash
npm run lint
```

Regenerate PWA icons (optional; PNGs are already committed):

```bash
npm run icons
```

## Put it on an iPhone

Safari can install this as a Home Screen app. **HTTPS is required** (a raw LAN IP does not count).

### Option A — GitHub Pages (no PC after merge)

1. Enable Pages once (see [One-time setup](#one-time-setup-required) above) and wait for the `Deploy GitHub Pages` workflow on `main` to finish.
2. On the iPhone, open **https://vinboy88.github.io/Pantry-tracker-/** in **Safari** (not Chrome).
3. Tap **Share** → **Add to Home Screen**.
4. Keep the name **Pantry**, then tap **Add**.
5. Open it from the Home Screen. It launches full-screen, without Safari chrome.

### Option B — any other static host

Deploy the `dist/` from `npm run build` (root base) to Cloudflare Pages, Netlify, or similar, then use the same Safari Share → Add to Home Screen steps.

### Option C — tunnel from a computer

```bash
npm run build
npm run preview
```

In another terminal, expose port `4173` with a tunnel (`cloudflared`, ngrok, or Tailscale Funnel). Open the HTTPS URL in Safari, then **Share → Add to Home Screen**.

### After install

- Items persist locally and remain available offline after that first visit.
- To refresh after a new deploy, open the Home Screen app once while online.
- Export a JSON backup from Settings and keep it somewhere Safari cannot wipe.
- Scan needs camera permission (see [Barcode scanning](#barcode-scanning)). You can always type the digits.

## Stack

Vite, React, TypeScript. No backend. Persistence is IndexedDB (`pantry-tracker`). Theme, recents, and onboarding flags live in `localStorage`.
