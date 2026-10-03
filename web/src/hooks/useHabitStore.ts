import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Habit, Routine, CheckIn, Streak, UserProgress } from '@shared/types';
import { uuid } from '@shared/types';
import * as store from '../data/habitStore';

// ── Helpers ────────────────────────────────────────────────────────────────

const todayStr = (): string => new Date().toISOString().slice(0, 10);

function buildTodayMap(checkIns: CheckIn[]): Record<string, CheckIn | null> {
  const map: Record<string, CheckIn | null> = {};
  for (const c of checkIns) {
    if (c.date !== todayStr()) continue;
    if (!map[c.habit_id] || c.timestamp > (map[c.habit_id]?.timestamp ?? '')) {
      map[c.habit_id] = c;
    }
  }
  return map;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useHabitStore() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [streakMap, setStreakMap] = useState<Record<string, Streak>>({});
  const [progress, setProgress] = useState<UserProgress>({
    xp: 0,
    level: 0,
    total_checkins: 0,
    achievement_ids: [],
  });
  const [loading, setLoading] = useState(true);

  // Today's check-in map (derived from checkIns)
  const todayCheckIns = useMemo(
    () => buildTodayMap(checkIns),
    [checkIns],
  );

  // Load all data from IndexedDB
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [h, r, c, p] = await Promise.all([
        store.getHabits(),
        store.getRoutines(),
        store.getCheckIns(),
        store.getProgress(),
      ]);
      setHabits(h.filter((x) => !x.archived_at));
      setRoutines(r);
      setCheckIns(c);
      setProgress(p);

      const map: Record<string, Streak> = {};
      for (const habit of h) {
        try {
          const s = await store.computeAndSaveStreak(habit.id);
          if (s) map[habit.id] = s;
        } catch (e) {
          console.warn(`Failed to compute streak for ${habit.id}:`, e);
          const s = await store.getStreak(habit.id);
          if (s) map[habit.id] = s;
        }
      }
      setStreakMap(map);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Actions ────────────────────────────────────────────────────────────

  /** Atomically upsert a check-in. The compute function receives the existing
   * check-in (or null) and returns the fields to update. Always reads fresh
   * data from IndexedDB so rapid calls don't lose updates. */
  const upsertCheckIn = useCallback(
    async (
      habitId: string,
      compute: (existing: CheckIn | null) => Partial<CheckIn>,
    ): Promise<void> => {
      await store.upsertCheckIn(habitId, compute);
      const [all, streak] = await Promise.all([
        store.getCheckIns(),
        store.computeAndSaveStreak(habitId),
      ]);
      setCheckIns(all);
      setStreakMap(prev => ({ ...prev, [habitId]: streak }));
    },
    [],
  );

  /** Toggle a checkbox habit on/off */
  const toggleHabit = useCallback(
    async (habitId: string) => {
      const habit = habits.find(h => h.id === habitId);
      if (!habit || habit.mode !== 'checkbox') return;
      await upsertCheckIn(habit.id, (existing) => {
        if (existing?.completed) {
          return { _delete: true } as any;
        }
        return { completed: true, timestamp: new Date().toISOString() } as Partial<CheckIn>;
      });

      // Refresh
      const [h, c] = await Promise.all([
        store.getHabits(),
        store.getCheckIns(),
      ]);
      setHabits(h.filter((x) => !x.archived_at));
      setCheckIns(c);

      const map: Record<string, Streak> = {};
      for (const hh of h) {
        const s = await store.getStreak(hh.id);
        if (s) map[hh.id] = s;
      }
      setStreakMap(map);
    },
    [upsertCheckIn, habits],
  );

  /** Delete a habit (and its check-ins, streaks) */
  const deleteHabit = useCallback(
    async (habitId: string) => {
      await store.deleteHabit(habitId);
      const [h, r, c, p] = await Promise.all([
        store.getHabits(),
        store.getRoutines(),
        store.getCheckIns(),
        store.getProgress(),
      ]);
      setHabits(h.filter((x) => !x.archived_at));
      setRoutines(r);
      setCheckIns(c);
      setProgress(p);

      const map: Record<string, Streak> = {};
      for (const hh of h) {
        const s = await store.getStreak(hh.id);
        if (s) map[hh.id] = s;
      }
      setStreakMap(map);
    },
    [],
  );

  /** Add a new habit */
  const addHabit = useCallback(
    async (partial: Omit<Habit, 'id' | 'created_at'>): Promise<Habit> => {
      const habit: Habit = {
        ...partial,
        id: uuid(),
        created_at: new Date().toISOString(),
      };
      const streak: Streak = {
        habit_id: habit.id,
        current: 0,
        longest: 0,
        last_date: undefined,
        shield_dates: [],
        vacation_until: undefined,
      };
      await store.saveHabit(habit);
      await store.saveStreak(streak);

      const [h, r, c, p] = await Promise.all([
        store.getHabits(),
        store.getRoutines(),
        store.getCheckIns(),
        store.getProgress(),
      ]);
      setHabits(h.filter((x) => !x.archived_at));
      setRoutines(r);
      setCheckIns(c);
      setProgress(p);

      const map: Record<string, Streak> = {};
      for (const hh of h) {
        const s = await store.getStreak(hh.id);
        if (s) map[hh.id] = s;
      }
      setStreakMap(map);

      return habit;
    },
    [],
  );

  /** Add a new routine */
  const addRoutine = useCallback(
    async (partial: Omit<Routine, 'id' | 'created_at'>): Promise<Routine> => {
      const routine: Routine = {
        ...partial,
        id: uuid(),
        created_at: new Date().toISOString(),
      };
      await store.saveRoutine(routine);

      const [r] = await Promise.all([store.getRoutines()]);
      setRoutines(r);
      return routine;
    },
    [],
  );

  /** Get a routine by id */
  const getRoutine = useCallback(
    (id: string): Routine | undefined => {
      return routines.find(r => r.id === id);
    },
    [routines],
  );

  /** Delete a routine (and detach from its habits) */
  const deleteRoutine = useCallback(
    async (routineId: string) => {
      await store.deleteRoutine(routineId);
      const [r] = await Promise.all([store.getRoutines()]);
      setRoutines(r);
    },
    [],
  );

  /** Attach a habit to a routine */
  const attachHabitToRoutine = useCallback(
    async (routineId: string, habitId: string) => {
      await store.attachHabitToRoutine(routineId, habitId);
      // Refresh routines and the habit's routineId
      const [r, h] = await Promise.all([
        store.getRoutines(),
        store.getHabits(),
      ]);
      setRoutines(r);
      setHabits(h.filter((x) => !x.archived_at));
    },
    [],
  );

  /** Detach a habit from a routine */
  const detachHabitFromRoutine = useCallback(
    async (routineId: string, habitId: string) => {
      await store.detachHabitFromRoutine(routineId, habitId);
      // Refresh routines and the habit's routineId
      const [r, h] = await Promise.all([
        store.getRoutines(),
        store.getHabits(),
      ]);
      setRoutines(r);
      setHabits(h.filter((x) => !x.archived_at));
    },
    [],
  );

  /** Get a streak for a habit (from local state) */
  const getStreak = useCallback(
    (habitId: string): Streak | undefined => {
      return streakMap[habitId];
    },
    [streakMap],
  );

  return {
    habits,
    routines,
    checkIns,
    streakMap,
    progress,
    loading,
    todayCheckIns,
    refresh,
    toggleHabit,
    deleteHabit,
    addHabit,
    addRoutine,
    getRoutine,
    deleteRoutine,
    attachHabitToRoutine,
    detachHabitFromRoutine,
    upsertCheckIn,
    getStreak,
    updateStreak: store.updateStreak,
    computeAndSaveStreak: store.computeAndSaveStreak,
  };
}
