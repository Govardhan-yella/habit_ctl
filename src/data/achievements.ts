import { AppState, Achievement, Habit } from '../types';
import { getStreakData, getDateString, parseDate, addDays, startOfDay } from '../utils/date';

function streakOf(habit: Habit, state: AppState): { current: number; longest: number } {
  const m = new Map<string, number>();
  for (const c of state.completions) if (c.habitId === habit.id) m.set(c.date, c.value);
  const shields = state.shields.filter(s => s.habitId === habit.id);
  const s = state.user?.settings;
  const vacation = s?.vacationMode ? { start: s.vacationStartsAt, end: s.vacationEndsAt } : undefined;
  const st = getStreakData(m, habit, shields, vacation);
  return { current: st.current, longest: st.longest };
}

function isScheduledOn(habit: Habit, date: Date): boolean {
  const d = date.getDay();
  switch (habit.schedule.type) {
    case 'weekdays': return d >= 1 && d <= 5;
    case 'custom': return habit.schedule.days?.includes(d) ?? false;
    default: return true;
  }
}

function perfectDayCount(active: Habit[], state: AppState): number {
  const dates = Array.from(new Set(state.completions.map(c => c.date))).sort();
  if (!dates.length) return 0;
  let perfect = 0;
  for (const date of dates) {
    const d = parseDate(date);
    const scheduled = active.filter(h => isScheduledOn(h, d) && h.createdAt.slice(0, 10) <= date);
    if (!scheduled.length) continue;
    const allDone = scheduled.every(h =>
      state.completions.some(c =>
        c.habitId === h.id && c.date === date && (h.mode === 'checkbox' ? true : c.value >= h.target)
      )
    );
    if (allDone) perfect++;
  }
  return perfect;
}

export function computeAchievements(state: AppState): Achievement[] {
  const active = state.habits.filter(h => !h.archivedAt);
  const totalCompletions = state.completions.length;
  const totalXp = totalCompletions * 10;
  const level = Math.floor(Math.sqrt(totalXp / 100)) + 1;

  let maxCurrent = 0;
  let maxLongest = 0;
  for (const h of active) {
    const s = streakOf(h, state);
    if (s.current > maxCurrent) maxCurrent = s.current;
    if (s.longest > maxLongest) maxLongest = s.longest;
  }

  const shields = state.shields.length;
  const routines = state.routines.length;
  const perfect = perfectDayCount(active, state);

  const defs: Array<Omit<Achievement, 'unlockedAt'>> = [
    { id: 'first_habit', name: 'First Step', description: 'Create your first habit', icon: '🌱', progress: state.habits.length, target: 1 },
    { id: 'five_habits', name: 'Multi-tasker', description: 'Keep 5 habits active', icon: '🗂', progress: active.length, target: 5 },
    { id: 'ten_checkins', name: 'Getting Started', description: 'Log 10 check-ins', icon: '✅', progress: totalCompletions, target: 10 },
    { id: 'centurion', name: 'Centurion', description: 'Log 100 check-ins', icon: '💯', progress: totalCompletions, target: 100 },
    { id: 'week_streak', name: 'Week Warrior', description: 'Reach a 7-day streak', icon: '🔥', progress: maxLongest, target: 7 },
    { id: 'month_streak', name: 'Unstoppable', description: 'Reach a 30-day streak', icon: '⚡', progress: maxLongest, target: 30 },
    { id: 'perfect_day', name: 'Perfect Day', description: 'Complete every habit in a day', icon: '🌟', progress: perfect, target: 1 },
    { id: 'routine_builder', name: 'Routine Builder', description: 'Create a routine', icon: '🔁', progress: routines, target: 1 },
    { id: 'shielded', name: 'Shielded', description: 'Earn a streak shield', icon: '🛡️', progress: shields, target: 1 },
    { id: 'level_five', name: 'Rising Star', description: 'Reach level 5', icon: '📈', progress: level, target: 5 },
  ];

  return defs.map(d => ({ ...d, progress: Math.min(d.progress, d.target) }));
}

export function isUnlocked(a: Achievement): boolean {
  return a.progress >= a.target;
}
