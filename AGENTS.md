# GomiHelper — Agent Guide

## Project overview
Next.js 16 static site providing trash schedule lookup for Tokyo wards. Data sourced from the Tokyo Open Data API, ward website CSVs, HTML table scraping, and XLSX files. 18 areas: 15 special wards + 3 cities.

## Commands
- `npm run dev` — dev server (localhost:3000)
- `npm run build` — production build + static export via `output: 'export'` config
- `npm run export` — copies `out/` to target directory (wrapped via `scripts/next-wrapper.js`)
- `npm run lint` — ESLint check
- `npm run update:data` — fetches latest data from all sources (API, CSV, HTML, XLSX) and regenerates sample files

## Stack
- **Framework:** Next.js 16 (App Router, Turbopack dev)
- **Language:** TypeScript (strict mode)
- **Styling:** CSS Modules (`app/page.module.css`) + global CSS vars (`app/globals.css`)
- **Build output:** Static HTML export (no SSR/API routes)

## Project structure
```
gomihelper/
├── app/
│   ├── globals.css          # CSS variables, base reset
│   ├── layout.tsx           # Root layout (metadata, font)
│   ├── not-found.tsx        # Custom 404 page
│   ├── page.module.css      # Home page styles (CSS Modules)
│   └── page.tsx             # Home page (client component)
├── public/
│   ├── data/
│   │   ├── index.json       # Dataset index (ward → file mapping)
│   │   ├── schema.json      # JSON Schema for dataset files
│   │   └── samples/         # Individual ward dataset files
│   └── raccoon-favicon.svg  # Favicon (raccoon)
├── scripts/
│   ├── update-data.ts       # Data fetcher from Tokyo Open Data API
│   ├── setup-next-export.js # Postinstall: wraps `next` binary for export
│   └── next-wrapper.js      # Custom `next export` wrapper
├── AGENTS.md                # This file
└── next.config.js           # output: 'export', trailingSlash, unoptimized images
```

## Data model
Calendar `Schedule` type at `app/page.tsx:9-15`:
```typescript
type Schedule = {
  ward: string;
  station?: string;
  version: string; // ISO date
  pickups: { day: string; type: PickupType }[];
  bulkyFees?: { item: string; feeYen: number; notes?: string }[];
};
```
PickupType: `'burnable' | 'plastic' | 'cans' | 'bottles' | 'paper' | 'bulk'`

Dataset index (`public/data/index.json`):
```json
{
  "version": "2025-10-28",
  "areas": [
    { "ward": "Chuo-ku", "aliases": ["chuo", "中央区"], "file": "samples/chuo-ku@2026-06-07.json" }
  ]
}
```

## Data sources
Base URL: `https://service.api.metro.tokyo.lg.jp`

### Ward / City data sources (18 areas)
| Ward / City | Source | Type |
|------|--------|------|
| Chuo-ku | `t131024d...` | API |
| Bunkyo-ku | `t131059d...` | API |
| Nakano-ku | `t131148d...` | API |
| Koto-ku | `t131083d...` | API |
| Shinagawa-ku | `t131091d...` | API |
| Taito-ku | `t131067d...` | API |
| Sumida-ku | `t131075d...` | API |
| Kiyose-shi | `t132217d...` | API |
| Suginami-ku | [CSV](https://www.city.suginami.tokyo.jp/documents/12125/garbage.csv) | CSV |
| Adachi-ku | [HTML](https://www.city.adachi.tokyo.jp/seso/kurashi/sche.html) | HTML |
| Nerima-ku | [HTML](https://www.city.nerima.tokyo.jp/kurashi/gomi/wakekata/ichiran/) (7 subpages) | HTML |
| Shinjuku-ku | [HTML](https://www.city.shinjuku.lg.jp/seikatsu/file09_01_00001.html) | HTML |
| Setagaya-ku | [HTML](https://www.city.setagaya.lg.jp/02241/416.html) | HTML |
| Edogawa-ku | [HTML](https://www.city.edogawa.tokyo.jp/e025/kurashi/gomi_recycle/kategomi/yobihyo.html) (6 tables) | HTML |
| Arakawa-ku | [HTML](https://www.city.arakawa.tokyo.jp/a025/recycle/shuushuubi/syusyubi.html) | HTML |
| Ota-ku | [XLSX](https://www.opendata.metro.tokyo.lg.jp/ootaku/131113_shigengomiyoubi.xlsx) | XLSX |
| Tachikawa | [HTML](https://www.city.tachikawa.lg.jp/kurashi/gomi/1001716/1027202/1027203.html) (4 areas) | HTML |
| Higashikurume | [HTML](https://www.city.higashikurume.lg.jp/kurashi/kankyo/shigen/1018874/1000817.html) (2 areas) | HTML |

Usage: `POST https://service.api.metro.tokyo.lg.jp/api/{apiId}/json?limit=100`
Headers: `accept: application/json`, `Content-Type: application/json`
Body: `{}` (empty object fetches all rows)

All data is fetched live from the Tokyo Open Data API, ward website CSVs, HTML table scraping, and XLSX files. No static/sample data is included. Run `npm run update:data` to refresh all ward datasets.

### Data source types
Wards use one of four data source types:
- **`api`** — Tokyo Open Data API (POST JSON)
- **`csv`** — CSV file or XLSX from a ward/city website
- **`html-table`** — HTML table scraped from a ward/city website
- **custom** — Custom parser for specific HTML layouts (Tachikawa, Higashikurume, Nerima, Shinjuku, Setagaya, Edogawa, Arakawa, Ota)

### Adding a new ward
1. Find a data source (API, CSV, HTML table, or XLSX with collection schedules)
2. Add a `WardConfig` entry in `scripts/update-data.ts` with the ward name, aliases, source, and column mapping
3. If using an API, find the API ID on the [Tokyo Open Data API Catalog](https://spec.api.metro.tokyo.lg.jp/)
4. If using an HTML table, check whether the generic `fetchHTMLTable` (Adachi-ku style `table.datatable`) works, or write a custom fetcher for the specific layout
5. Add the custom fetcher function (returning `Schedule` directly or `Record<string, string>[]`) and register it in `fetchWardSchedule`'s name switch
6. Run `npm run update:data`

### Column mapping notes
- Each ward's API has different column names for garbage types
- Common columns: `燃やすごみ` (burnable), `可燃ごみ` (burnable), `プラマーク` / `プラスチック` / `容器包装プラスチック` (plastic), `粗大ごみ` (bulk), `不燃ごみ` (non-burnable), `資源` (recyclables)
- Day format varies: full (`月曜日・金曜日`), abbreviated (`火・金` or `水曜`), or semicolon (`火曜日;金曜日`)
- Special patterns: `隔週` (alternating weeks), `第N` (N-th week of month), `その月のN回目` — these are simplified to just the base day
- Mapping values can be `string | string[]` — arrays combine multiple API columns for the same type (e.g., Sumida-ku burnable split across `燃やすごみの収集曜日` and `燃やすごみの収集曜日1`)

## Key behaviors for agents
- **Search:** Looks up the user's query (case-insensitive, alias match) in `index.json`, fetches the matching dataset, displays it. Falls back to hint text if not found.
- **Geolocation:** "Detect my location" button uses `navigator.geolocation` + Nominatim reverse geocoding to auto-detect the ward.
- **Language toggle:** EN/JA stored in `localStorage` key `gh_lang`.
- **Static export:** Generated into `out/`. GitHub Actions deploys via `.github/workflows/pages.yml`.
- **`page.tsx` is a `'use client'` component** — client-side fetch for data, client-side state for language/location.
- **Data sources**: Three types — `api` (Tokyo Open Data API), `csv` (ward website CSV), `html-table` (scraped HTML table from ward website). The `WardConfig.source` field determines which fetcher is used.

## Current limitations
- Schedule data uses the first neighborhood's schedule from each ward's data source as a representative sample
- "1st and 3rd Thursday" style patterns are simplified to just "Thu"
- Only 7 of 23 special wards have live schedule APIs; 9 more added via CSV/HTML/XLSX
- 8 special wards have no machine-readable data (Chiyoda, Minato, Meguro, Shibuya, Toshima, Kita, Itabashi, Katsushika)
- Suginami-ku CSV data covers grouped areas (e.g., "阿佐谷北1～6丁目") — first row used as sample
- Sumida-ku data is from 2015 (API not updated since)
- Ota-ku XLSX has complex merged-cell layout; first area group used as sample
- Tachikawa uses first of 4 area groups (富士見・柴崎・錦・羽衣町) as representative sample
- Higashikurume uses east area (東地区) as representative sample
- Column mapping supports `string | string[]` for wards where a type is split across columns (e.g., Sumida-ku burnable in two columns)
