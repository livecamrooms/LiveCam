# CamIndex

Static adult cam directory generated from the Chaturbate public affiliate API. 1000 pages. All outbound links use revshare campaign code `T2CSW`.

## Deploy with auto-rebuild (recommended)

1. Create a public GitHub repo.
2. Upload **only** `generate.mjs` and the `.github/` folder from this archive.
3. In Settings → Pages, set Source to **GitHub Actions**.
4. In the Actions tab, run the **Build and Deploy** workflow once. After that it rebuilds every 6 hours.

## Manual deploy

Upload everything except `generate.mjs` and `.github/` to a repo and enable Pages from branch root.

## Settings

Environment variables for `generate.mjs`:
- `TARGET_PAGES` (default 1000)
- `THEME` (`oxblood` or `black`, default `black`)
- `WM` (campaign code, default T2CSW)
- `SITE_URL` (your live URL for sitemap/canonicals)
https://livecamrooms.github.io/LiveCam/
