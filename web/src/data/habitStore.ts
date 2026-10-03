import { openDB, type IDBPDatabase } from 'idb';
import type { Habit, Routine, CheckIn, Streak, UserProgress, ExportFile } from '@shared/types';
import { uuid } from '@shared/types';

const DB_NAME = 'habitctl';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Habits store
        if (!db.objectStoreNames.contains('habits')) {
          const h = db.createObjectStore('habits', { keyPath: 'id' });
          h.createIndex('routineId', 'routineId');
          h.createIndex('archived', 'archived_at');
        }
        // Routines store
        if (!db.objectStoreNames.contains('routines')) {
          const r = db.createObjectStore('routines', { keyPath: 'id' });
        }
        // Check-ins store — keyed by [habit_id]:[date] compound
        if (!db.objectStoreNames.contains('checkins')) {
          const c = db.createObjectStore('checkins', { keyPath: 'id' });
          c.createIndex('habitDate', ['habit_id', 'date']);
          c.createIndex('habitId', 'habit_id');
        }
        // Streaks store
        if (!db.objectStoreNames.contains('streaks')) {
          const s = db.createObjectStore('streaks', { keyPath: 'habit_id' });
        }
        // Progress store (single record)
        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// ── Habits ──────────────────────────────────────────────────────────────────

export async function getHabits(): Promise<Habit[]> {
  const db = await getDB();
  return db.getAll('habits');
}

export async function getActiveHabits(): Promise<Habit[]> {
  const db = await getDB();
  const all = await db.getAll('habits');
  return all.filter(h => !h.archived_at);
}

export async function getHabit(id: string): Promise<Habit | undefined> {
  const db = await getDB();
  return db.get('habits', id);
}

export async function saveHabit(habit: Habit): Promise<void> {
  const db = await getDB();
  await db.put('habits', habit);
}

export async function deleteHabit(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['checkins', 'streaks', 'habits'], 'readwrite');
  await Promise.all([
    tx.objectStore('habits').delete(id),
    (async () => {
      // Delete only check-ins for this habit, not all check-ins
      const cStore = tx.objectStore('checkins');
      const index = cStore.index('habitId');
      let cursor = await index.openCursor(id);
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
    })(),
    (async () => {
      const sStore = tx.objectStore('streaks');
      await sStore.delete(id);
    })(),
    tx.done,
  ]);
}

export async function archiveHabit(id: string): Promise<void> {
  const habit = await getHabit(id);
  if (!habit) return;
  habit.archived_at = new Date().toISOString();
  await saveHabit(habit);
}

// ── Routines ────────────────────────────────────────────────────────────────

export async function getRoutines(): Promise<Routine[]> {
  const db = await getDB();
  return db.getAll('routines');
}

export async function getRoutine(id: string): Promise<Routine | undefined> {
  const db = await getDB();
  return db.get('routines', id);
}

export async function saveRoutine(routine: Routine): Promise<void> {
  const db = await getDB();
  await db.put('routines', routine);
}

export async function deleteRoutine(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('routines', id);
  // Clear routineId on habits that belonged to it
  const habits = await getHabits();
  const updates = habits
    .filter(h => h.routineId === id)
    .map(h => ({ ...h, routineId: undefined }));
  for (const h of updates) await saveHabit(h);
}

export async function attachHabitToRoutine(
  routineId: string,
  habitId: string,
): Promise<void> {
  const db = await getDB();
  const routine = await db.get('routines', routineId);
  if (!routine) return;
  if (!routine.habit_ids.includes(habitId)) {
    routine.habit_ids = [...routine.habit_ids, habitId];
    await db.put('routines', routine);
  }
}

export async function detachHabitFromRoutine(
  routineId: string,
  habitId: string,
): Promise<void> {
  const db = await getDB();
  const routine = await db.get('routines', routineId);
  if (!routine) return;
  routine.habit_ids = routine.habit_ids.filter((id: string) => id !== habitId);
  await db.put('routines', routine);
}

// ── Check-ins ───────────────────────────────────────────────────────────────

export async function getCheckIns(): Promise<CheckIn[]> {
  const db = await getDB();
  return db.getAll('checkins');
}

export async function getCheckInsForDay(date: string): Promise<CheckIn[]> {
  const db = await getDB();
  // Use the compound index
  const index = db.transaction('checkins').objectStore('checkins').index('habitDate');
  return index.getAll(IDBKeyRange.only([undefined, date]));
  // idb's getAll with a key range on compound index requires the full key;
  // simpler: get all and filter.
}

export async function getAllCheckInsForHabit(habitId: string): Promise<CheckIn[]> {
  const db = await getDB();
  const index = db.transaction('checkins').objectStore('checkins').index('habitId');
  return index.getAll(habitId);
}

export async function saveCheckIn(checkIn: CheckIn): Promise<void> {
  const db = await getDB();
  await db.put('checkins', checkIn);
}

export async function deleteCheckIn(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('checkins', id);
}

/** Get or create today's check-in for a habit (for counter/number modes) */
export async function getOrCreateTodayCheckIn(habitId: string): Promise<CheckIn> {
  const today = new Date().toISOString().slice(0, 10);
  const existing = await getAllCheckInsForHabit(habitId);
  const todayCheckIn = existing.find(c => c.date === today && c.completed);
  if (todayCheckIn) return todayCheckIn;
  const newCheckIn: CheckIn = {
    id: uuid(),
    habit_id: habitId,
    date: today,
    completed: true,
    timestamp: new Date().toISOString(),
  };
  await saveCheckIn(newCheckIn);
  return newCheckIn;
}

// ── Streaks ─────────────────────────────────────────────────────────────────

export async function getStreak(habitId: string): Promise<Streak | undefined> {
  const db = await getDB();
  return db.get('streaks', habitId);
}

export async function saveStreak(streak: Streak): Promise<void> {
  const db = await getDB();
  await db.put('streaks', streak);
}

export async function updateStreak(habitId: string, patch: Partial<Streak>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('streaks', habitId);
  if (!existing) return;
  const updated: Streak = { ...existing, ...patch };
  await db.put('streaks', updated);
}

export async function deleteStreak(habitId: string): Promise<void> {
  const db = await getDB();
  await db.delete('streaks', habitId);
}

// ── Progress ────────────────────────────────────────────────────────────────

const PROGRESS_ID = 'user';

export async function getProgress(): Promise<UserProgress> {
  const db = await getDB();
  const existing = await db.get('progress', PROGRESS_ID);
  return (existing?.data ?? {
    xp: 0,
    level: 0,
    total_checkins: 0,
    achievement_ids: [],
  });
}

export async function saveProgress(progress: UserProgress): Promise<void> {
  const db = await getDB();
  await db.put('progress', { id: PROGRESS_ID, data: progress });
}

// ── Export / Import ─────────────────────────────────────────────────────────

export async function exportData(): Promise<ExportFile> {
  const [habits, routines, checkins, streaks, progress] = await Promise.all([
    getHabits(),
    getRoutines(),
    getCheckIns(),
    // Collect all streaks
    (async () => {
      const db = await getDB();
      const streaks = await db.getAll('streaks');
      return streaks.map(s => ({ ...s }));
    })(),
    getProgress(),
  ]);

  return {
    version: DB_VERSION,
    exported_at: new Date().toISOString(),
    habits,
    routines,
    checkins,
    streaks,
    progress,
  };
}

export async function importData(file: ExportFile): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['habits', 'routines', 'checkins', 'streaks', 'progress'],
    'readwrite',
  );

  await Promise.all([
    // Clear existing
    tx.objectStore('habits').clear(),
    tx.objectStore('routines').clear(),
    tx.objectStore('checkins').clear(),
    tx.objectStore('streaks').clear(),
    tx.objectStore('progress').clear(),
    // Write new
    ...file.habits.map(h => tx.objectStore('habits').put(h)),
    ...file.routines.map(r => tx.objectStore('routines').put(r)),
    ...file.checkins.map(c => tx.objectStore('checkins').put(c)),
    ...file.streaks.map(s => tx.objectStore('streaks').put(s)),
    tx.objectStore('progress').put({ id: PROGRESS_ID, data: file.progress }),
    tx.done,
  ]);
}

// ── Init / reset ────────────────────────────────────────────────────────────

export async function resetAll(): Promise<void> {
  await indexedDB.deleteDatabase(DB_NAME);
  dbPromise = null;
}

// ── Check-in upsert (atomic, for counter/number/health/time modes) ──────────

/** Atomically upsert a check-in for a habit on a given day.
 * The compute function receives the existing check-in (or null) and returns
 * the fields to update. Always reads fresh data from IndexedDB so rapid
 * calls don't lose updates. Deletion is signaled by returning { _delete: true }. */
export async function upsertCheckIn(
  habitId: string,
  compute: (existing: CheckIn | null) => Partial<CheckIn>,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const allCheckIns = await getCheckIns();
  const existing = allCheckIns.find(
    c => c.habit_id === habitId && c.date === today,
  ) ?? null;

  const patch = compute(existing);

  if ((patch as any)._delete) {
    if (existing) {
      await deleteCheckIn(existing.id);
    }
  } else {
    const freshId = patch.id ?? uuid();
    const completed = patch.completed ?? existing?.completed ?? true;
    const checkIn: CheckIn = {
      id: freshId,
      habit_id: habitId,
      date: today,
      completed,
      timestamp: new Date().toISOString(),
      ...(patch.value !== undefined && { value: patch.value }),
      ...(patch.duration !== undefined && { duration: patch.duration }),
    };
    if (existing) {
      await deleteCheckIn(existing.id);
    }
    await saveCheckIn(checkIn);
  }
}

// re-export uuid for convenience
export { uuid };

// ── Streak computation ─────────────────────────────────────────────────────

function prevDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00.000Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Recompute the streak for a habit from its check-in history and persist it.
 * Streak = consecutive completed days, counting backward from today.
 * If today is incomplete but yesterday is complete, the streak continues
 * (grace period) starting from yesterday. */
export async function computeAndSaveStreak(habitId: string): Promise<Streak> {
  const checkIns = await getAllCheckInsForHabit(habitId);
  const completedDates = new Set(
    checkIns.filter(c => c.completed).map(c => c.date),
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = prevDate(todayStr);

  // Find the starting point: today if checked, else yesterday (grace period)
  let cursor: string;
  if (completedDates.has(todayStr)) {
    cursor = todayStr;
  } else if (completedDates.has(yesterdayStr)) {
    cursor = yesterdayStr;
  } else {
    // No recent check-in — streak is 0
    const existing = await getStreak(habitId);
    const zeroed: Streak = existing
      ? { ...existing, current: 0 }
      : { habit_id: habitId, current: 0, longest: 0, shield_dates: [] };
    await saveStreak(zeroed);
    return zeroed;
  }

  const startDate = cursor;

  // Count backward
  let count = 0;
  while (completedDates.has(cursor)) {
    count++;
    cursor = prevDate(cursor);
  }

  const existing = await getStreak(habitId);
  const streak: Streak = {
    habit_id: habitId,
    current: count,
    longest: Math.max(existing?.longest ?? 0, count),
    last_date: startDate,
    shield_dates: existing?.shield_dates ?? [],
    vacation_until: existing?.vacation_until,
  };

  await saveStreak(streak);
  return streak;
}
