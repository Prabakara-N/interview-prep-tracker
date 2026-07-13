# 🎯 Interview Prep Tracker

A lightweight, single-page web app to track your daily interview preparation across three tracks plus job applications — with streaks, graphs, and a GitHub-style activity heatmap. Pure **HTML + CSS + JavaScript** (no build step), styled with **Tailwind (Play CDN)**, charted with **Chart.js**, and iconned with **Lucide**.

## Features

- **Three tracks + jobs**
  - 🗄️ **SQL / Postgres** — topic, minutes, notes
  - 🧩 **DSA** — problem, pattern/topic, difficulty, minutes, notes
  - 💼 **Jobs** — company, role, status (Applied → OA → Interview → Offer / Rejected), location, notes
- ✅ **Daily checklist — one tick is all it takes.** Each task is bound to a **track** (DSA / SQL / Jobs), so ticking it **feeds its graph directly**: DSA `+1 problem`, SQL `+30 mins`, Jobs `+1 job`. Add your own tasks and pick which graph they count toward, or leave them as habit-only ticks.
- 🔥 **Streaks** — current + longest streak (any logged activity *or* a checked task keeps it alive). **Sundays are rest days** — a missing Sunday never breaks your streak.
- 📈 **Per-track daily graphs** — separate daily-progress charts for SQL minutes, DSA problems, jobs applied, and tasks completed. Each graph sums **checklist quantities + detailed tab entries**, so there's one consistent number everywhere.
- 🟩 **Activity heatmap** with a **range filter** — last 7 / 15 / 30 days, 3 months, or 6 months. The same filter drives the daily graphs.
- 📱 **Fully responsive** — adapts from phone to desktop (scrollable tabs, stacked cards, fluid charts)
- 🌙 **Dark / light mode** — toggle, remembered, respects your OS preference
- ☁️ **Storage** — [jsonbin.io](https://jsonbin.io) cloud sync with a localStorage cache (works offline)
- 🔁 **Export / Import** JSON backups

## Quick start

No install needed. Just serve the folder (a static server avoids CORS/file quirks):

```bash
# any one of these from the project root:
python3 -m http.server 8000
# or
npx serve .
```

Then open <http://localhost:8000>. Out of the box it runs in **localStorage-only** mode — your data is saved in the browser.

## Enable cloud sync (jsonbin.io)

1. Create a free account at <https://jsonbin.io>.
2. Create a new **Bin** with this starter content:
   ```json
   { "sql": [], "dsa": [], "jobs": [], "meta": { "updatedAt": 0 } }
   ```
3. Copy your **Bin ID** (from the bin URL) and **Master Key** (API Keys page).
4. Copy the template and fill it in:
   ```bash
   cp js/config.example.js js/config.js
   ```
   ```js
   window.IPT_CONFIG = {
     JSONBIN_MASTER_KEY: '$2a$10$your_master_key',
     JSONBIN_BIN_ID: 'your_bin_id',
     JSONBIN_BASE: 'https://api.jsonbin.io/v3/b'
   };
   ```
5. Reload the page. The header chip shows **synced ✓**. Use **Sync now** in the footer to push manually.

> ⚠️ **Security note:** `js/config.js` is client-side, so the key is visible to anyone who can open the page. That's fine for a private, personal tracker. Don't deploy it publicly with a sensitive bin, and don't commit `js/config.js` (it's gitignored).

## How it works

| File | Responsibility |
|------|----------------|
| `index.html` | Layout, tabs, forms, CDN includes |
| `css/styles.css` | Custom styling on top of Tailwind |
| `js/config.js` | Your jsonbin keys (gitignored) |
| `js/storage.js` | localStorage cache + jsonbin GET/PUT, graceful fallback |
| `js/state.js` | In-memory state with immutable updates |
| `js/streak.js` | Streak + date math, heatmap activity counts |
| `js/charts.js` | Chart.js rendering (theme-aware) |
| `js/ui.js` | Rendering: stats, lists, heatmap, tabs, theme, toasts |
| `js/app.js` | Bootstrap + event wiring |

**Sync model:** last-write-wins by `meta.updatedAt`. Designed for a single user; opening from multiple devices simultaneously can overwrite. Local writes are instant; cloud sync happens on every save and on demand.

## License

MIT — personal project, use freely.
