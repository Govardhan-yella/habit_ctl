# habit_ctl

> Run your habits like services. A local-first, terminal-style habit tracker for developers and minimalists.

`habit_ctl` is a single-page web app that looks and feels like your terminal. Everything is stored locally in IndexedDB by default — no account required. Optional cloud sync is available via Appwrite.

## Features

- **Terminal aesthetic** — monospace UI, single-accent themes, minimal chrome.
- **11 built-in themes** plus a custom theme editor.
- **Habit tracking** — checkbox and counter habits, custom schedules (daily / weekdays / selected days), targets, archives.
- **Streaks & shields** — streak calculation with earned shields to protect progress.
- **Heatmap, stats & achievements** — yearly heatmap, completion rates, XP/levels, insights.
- **Routines** — group habits into ordered routines.
- **Dashboard widgets** — progress ring, streaks, heatmap, timer, mood, water, batch actions, quick capture, neofetch.
- **Local-first & offline** — installable PWA, works with no network.
- **Optional sync** — Appwrite-backed accounts and sync (disabled until configured).
- **Extras** — passcode lock, custom CSS, reminders/notifications, JSON export/import.

## Tech stack

- [TypeScript](https://www.typescriptlang.org/) (strict) + [Vite](https://vitejs.dev/)
- Vanilla DOM components (no framework)
- [idb](https://github.com/jakearchibald/idb) for IndexedDB persistence
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) for the service worker + manifest
- [Appwrite](https://appwrite.io/) (optional) for auth + cloud sync
- [Vitest](https://vitest.dev/) for tests

## Getting started

Prerequisites: **Node.js 18+** (see `.nvmrc`).

```bash
npm install
npm run dev        # http://localhost:3000
```

## Scripts

| Script              | Description                          |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start the dev server on port 3000    |
| `npm run build`     | Type-check and build to `dist/`      |
| `npm run preview`   | Preview the production build         |
| `npm run test`      | Run the test suite once              |
| `npm run test:watch`| Run tests in watch mode              |
| `npm run lint`      | Lint `src/` with ESLint              |
| `npm run typecheck` | Type-check without emitting          |

## Configuration

The app is fully functional without any configuration. To enable account sign-in and cloud sync, copy `.env.example` to `.env` and fill it in:

```bash
cp .env.example .env
```

| Variable                   | Required | Description                              |
| -------------------------- | -------- | ---------------------------------------- |
| `VITE_APPWRITE_ENDPOINT`   | No       | Appwrite endpoint (defaults to cloud)    |
| `VITE_APPWRITE_PROJECT_ID` | For sync | Appwrite project ID                       |

When `VITE_APPWRITE_PROJECT_ID` is empty, cloud features are hidden/disabled and the app stays local-only.

## Project structure

```
src/
  components/   # DOM UI components (App shell, HabitList, Stats, Settings, Widgets, ...)
  services/     # storage (IndexedDB), appwrite, pwa, reminders
  stores/       # appStore — state, actions, persistence
  data/         # themes, achievements
  utils/        # date + color helpers
  types/        # shared TypeScript types
  styles/       # main.css
public/         # static assets (icons, favicon)
```

## Data & privacy

All data lives in your browser (IndexedDB) unless you explicitly enable Appwrite sync. Export/import is available in Settings for backups. Never commit a real `.env`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). For security issues, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Govardhan Yella
