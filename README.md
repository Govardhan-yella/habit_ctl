# habitctl

> Run your habits like services. Local-first. No account. No ads. No AI.

A habit tracker that feels like the command line you already live in.

**Current:** Web app (React + TypeScript + IndexedDB)  
**Planned:** iOS (SwiftUI) → Android → Windows/Mac (Tauri)

---

## Philosophy

- **Local-first** — all data lives in your browser's IndexedDB (web) or device storage (mobile). No sign-up, no server.
- **Export your data** — JSON file, yours to keep, importable anywhere.
- **No dark patterns** — no nagging, no streaks weaponised, no endless engagement loop.
- **Open source** — MIT license. Fork it, extend it, ship it.
- **Quiet by default** — monospaced, minimal, dark-first. Seven themes included.

---

## Tech

| Layer | Choice |
|-------|--------|
| Web framework | React 18 + TypeScript + Vite |
| Browser storage | IndexedDB via `idb` |
| Font | JetBrains Mono (Google Fonts) |
| Themes | 7 built-in (Tokyo Night, Dracula, Catppuccin Mocha, Gruvbox Dark, One Dark, GitHub Dark, Light) |
| Deploy target | GitHub Pages / Vercel (free) |

---

## Setup

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:3000`.

---

## Data model

See `shared/types.ts` for the canonical schema — used by web, iOS, Android, and desktop.

Core entities:
- **Habit** — name, tracking mode, optional colour/icon/target/reminder
- **Routine** — named group of habit IDs (Morning, Workout, Evening, …)
- **CheckIn** — one per habit per day (checkbox mode), or a value (counter/number/health/time)
- **Streak** — current, longest, shield dates, vacation freeze
- **UserProgress** — XP, level, total check-ins, achievement IDs

---

## Features (v0.1.0 web)

| Feature | Status |
|---------|--------|
| 5 tracking modes | ✅ checkbox, counter, number, health (manual), time (pomodoro) |
| Habit CRUD | ✅ add / toggle / delete |
| Today view | ✅ all active habits, one tap to log |
| Streaks | ✅ per-habit, displayed inline |
| Theme switching | ✅ 7 themes, persisted to localStorage |
| Local-first | ✅ IndexedDB, works offline |
| JetBrains Mono | ✅ throughout |

## Deferred to later

- Routines
- Streak shields
- Contribution heatmap
- Reminders (browser notifications)
- Stats / XP / achievements
- Export / import JSON
- Vacation mode
- Apple Watch companion
- Live Activity / Dynamic Island
- Siri / Shortcuts
- iCloud / cloud sync
- Apple Health sync
- Widgets
- Passcode / biometric lock
- Additional languages
- iOS / Android / desktop apps

---

## License

MIT © Govardhan Yella
