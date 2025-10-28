# GomiHelper 🦝

Next.js one-page app for trash schedules & bulky-fee lookups in Japan.  
**Data:** 100% JSON (versioned). **Hosting:** GitHub Pages. **Updates:** Weekly via Actions (disabled by default).

## Quick start
```bash
npm i
npm run dev
```

## Build & export
```bash
npm run build
npm run export
# /out contains the static site
```

## Deploy to GitHub Pages
The site deploys automatically from the `main` branch via `.github/workflows/pages.yml`.

1. In GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Add your custom domain, save, and tick **Enforce HTTPS** once the certificate is issued.
3. After each push to `main`, verify the latest deployment under **Settings → Pages** → **Latest deployments**.
4. Configure the required DNS records at your registrar following the [GitHub Pages custom domain guide](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site).

## Weekly data updates
A disabled workflow is included at `.github/workflows/weekly-data.yml`.  
- To enable, remove `if: ${{ false }}` and uncomment the cron schedule.  
- Update script: `scripts/update-data.ts` (stub).

## Data model
- See `public/data/schema.json`. Samples under `public/data/samples/`.
- Code license: MIT (`LICENSE`)
- Data license: CC BY 4.0 (`DATA-LICENSE`) — please attribute “GomiHelper (gomihelper.com)”.

## Localization
- Language toggle (EN/JA) is built-in and stored in `localStorage`.
