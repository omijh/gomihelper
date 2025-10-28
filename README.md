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
This repo includes a manual workflow:
- Enable **Settings → Pages → Source: GitHub Actions**
- Run the workflow **“Deploy to GitHub Pages (manual)”**

To auto-deploy on push to main, uncomment the `push:` trigger in `.github/workflows/deploy.yml`.

## Weekly data updates
A disabled workflow is included at `.github/workflows/weekly-data.yml`.  
- To enable, remove `if: ${{ false }}` and uncomment the cron schedule.  
- Update script: `scripts/update-data.ts` (stub).

## Data model
- See `data/schema.json`. Samples under `data/samples/`.
- Code license: MIT (`LICENSE`)
- Data license: CC BY 4.0 (`DATA-LICENSE`) — please attribute “GomiHelper (gomihelper.com)”.

## Localization
- Language toggle (EN/JA) is built-in and stored in `localStorage`.
