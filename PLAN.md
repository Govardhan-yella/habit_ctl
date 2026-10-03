# habitctl — Web MVP Feature Plan

## Status
- Working: habits CRUD, 5 tracking modes (checkbox/counter/number/health/time), 7 themes, streaks computation (store-level), streaks display (badge), add habit modal, theme toggle
- **Missing**: streaks detail UI, heatmap, reminders

## Completed (this session)
### 1. Delete confirmation ✓
- HabitRow shows inline confirm: "Delete habit? This also deletes check-ins and streak."
- Confirm/Cancel buttons, only calls onDelete on confirm
- Same pattern in RoutineList for routine deletion

### 2. Settings + Export/Import ✓
- New `SettingsModal` component (src/components/Settings.tsx)
- Gear button (⚙) in header opens settings panel
- Theme section: list all 7 themes as clickable swatches
- Export: downloads `habitctl-export-YYYY-MM-DD.json` via Blob
- Import: file picker, parses JSON, calls `importData()`, refreshes
- Danger zone: reset all data with confirmation
- Reuses existing modal CSS classes

### 3. Routines ✓
- Tab bar in App.tsx: Habits / Routines tabs
- `RoutineList.tsx`: lists all routines as grouped cards with their habits as mini rows
- `AddRoutineModal.tsx`: create routine (name, color, select habits from existing)
- `HabitRow.tsx`: routine assignment dropdown per row (— / routine name)
- Hook updates: `getRoutine`, `deleteRoutine`, `attachHabitToRoutine`, `detachHabitFromRoutine`
- Store updates: `getRoutine`, `attachHabitToRoutine`, `detachHabitFromRoutine`

---

## 1. Routines
- **Data**: `Routine` type already exists in `shared/types.ts` (id, name, color?, habit_ids, reminder?, created_at). Store has `getRoutines`, `saveRoutine`, `deleteRoutine`.
- **Hook**: `useHabitStore` has `addRoutine`. Missing: `getRoutine`, delete routine from hook, attach/detach habits to routine.
- **UI**:
  - New page/section: list all routines, show their habits as mini rows
  - Add routine modal (name, color, select habits from existing)
  - Inline: assign a routine to a habit (dropdown on HabitRow or AddHabitModal)
- **Storage**: routines store already has `habit_ids` array — no schema change needed.

## 2. Streaks Detail UI
- **Data**: `Streak` type has `current`, `longest`, `last_date`, `shield_dates`, `vacation_until`. Store has `getStreak`, `saveStreak`, `computeStreaks` (in hook's `refresh`).
- **Hook**: `getStreak(habitId)` already returns `Streak | undefined`. Missing: `updateStreak` (for shield/vacation edits).
- **UI**:
  - Click streak badge → small popover/modal showing: current streak, longest streak, last checked-in date, shield dates list, vacation-until date
  - Edit: add/remove shield dates, set vacation mode (date range)
- **Note**: `computeStreaks` runs in `refresh()` — streaks update automatically on each check-in.

## 3. Heatmap
- **Data**: No new schema needed — derive from `checkIns` per habit (each check-in = one day).
- **UI**:
  - New component `Heatmap` — GitHub-style grid (7 rows = days of week, columns = weeks)
  - Per-habit view: show 365 days of check-in history as colored cells (intensity based on value for counter/number, binary for checkbox)
  - Color scale: no-check-in = bg, checked = accent color at varying intensity
- **Hook**: needs a `getCheckInsForHabit(habitId)` or filter from existing `checkIns`.
- **Rendering**: SVG or CSS grid — CSS grid is simpler. 53 weeks × 7 days.

## 4. Reminders
- **Data**: `Reminder` type in `shared/types.ts` (enabled, time HH:mm, repeatDays[], routineId?). Stored on `Habit` as `reminder?` and on `Routine` as `reminder?`.
- **UI**:
  - On AddHabitModal / EditHabitModal: add reminder section (toggle enable, time picker, day-of-week checkboxes)
  - Reminders list view: show all scheduled reminders across habits/routines
- **Scheduling**: Web-only — use `setTimeout`/`setInterval` based on current time + reminder time. No push notifications in v1 (purely in-app bell/alert at the scheduled time). Persist next-fire-time in memory only (recompute on load).
- **Note**: No browser Notification API in v1 (avoids permission prompts). In-app visual alert only.

## 5. Export / Import UI
- **Data**: `exportData()` returns `ExportFile` (JSON). `importData(file)` reads it back. Both already in store.
- **UI**:
  - Settings → Export: download JSON file (Browser `blob` + `<a>` download)
  - Settings → Import: file picker (`<input type="file">`), parse JSON, call `importData`, refresh
  - Show export version + habit/routine/checkin counts before download
- **Edge cases**: import should warn if importing into non-empty DB (offer "merge" or "replace"). For v1: replace = reset all then import.

## 6. Settings View
- **Sections**:
  - Theme (already works — show current theme, list all 7 with preview swatches)
  - Data: Export, Import, Reset all data (with confirmation)
  - About: version, "local-first, no data leaves your device" note
- **Route**: Add a settings button in header (next to theme toggle) → modal or inline panel.

## 7. Delete Confirmation
- **Current**: ✕ button on HabitRow calls `onDelete(habit)` directly.
- **Fix**: Add a small confirm step — either a browser `confirm()` (simple, native) or a small inline confirm modal. For v1: inline confirm is more consistent with the aesthetic. Show "Delete habit? This also deletes its check-ins and streak." with Confirm/Cancel buttons.

---

## Execution Order
1. Delete confirmation (smallest, no new deps)
2. Settings + Export/Import (share a settings modal)
3. Routines (new data flow, hook updates)
4. Streaks detail (hook already has data, just UI)
5. Heatmap (depends on check-ins data, no new store deps)
6. Reminders (data exists, UI + in-app scheduling)

## UI/UX Direction (post-features)
- Non-AI web aesthetic: static, opinionated layout, no recommendation engines, no "smart" suggestions, no personalized feeds
- Typography: JetBrains Mono throughout (already set), possibly a sans-serif for body text if readability suffers
- Layout: single-column, max-width ~720px, generous vertical rhythm, no sidebar/left-nav (mobile-first single column that expands)
- Color: dark-first, theme-driven, no custom color per component — everything derives from CSS vars
- Motion: minimal — only state-change feedback (toggle ring, timer pulse, streak badge appear). No ambient animations by default.
- Empty states: hand-drawn-ish SVG icons or simple ASCII-style glyphs (⌘, ○, ○, etc.) — no stock photos, no illustrations
- Density: information-dense but not cramped — monospace numbers, compact rows, clear groupings
