import type { StreakData } from '../types';

export function formatDate(date: Date, format: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY' = 'YYYY-MM-DD'): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  switch (format) {
    case 'DD/MM/YYYY': return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY': return `${month}/${day}/${year}`;
    default: return `${year}-${month}-${day}`;
  }
}

/** Format an ISO `YYYY-MM-DD` string using the user's chosen date format. */
export function formatDateString(iso: string, format: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY' = 'YYYY-MM-DD'): string {
  if (!iso || format === 'YYYY-MM-DD') return iso;
  return formatDate(parseDate(iso), format);
}

export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getTodayString(format: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY' = 'YYYY-MM-DD'): string {
  return formatDate(new Date(), format);
}

/** Format an `HH:MM` string per the user's 12h/24h preference. */
export function formatTime(hhmm: string, format: '12h' | '24h' = '24h'): string {
  if (format === '24h' || !hhmm) return hhmm;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const period = h < 12 ? 'AM' : 'PM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m ?? 0).padStart(2, '0')} ${period}`;
}

export function getDateString(date: Date): string {
  return formatDate(date, 'YYYY-MM-DD');
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function subDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function getWeekStart(date: Date, weekStartsOn: 0 | 1 = 0): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  result.setDate(result.getDate() - diff);
  return startOfDay(result);
}

export function getWeekEnd(date: Date, weekStartsOn: 0 | 1 = 0): Date {
  return addDays(getWeekStart(date, weekStartsOn), 6);
}

export function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function getYearStart(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

export function getYearEnd(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
}

export function getDaysBetween(date1: Date, date2: Date): number {
  const start = startOfDay(date1);
  const end = startOfDay(date2);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function getHeatmapLevel(count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function isScheduledOn(schedule: { type: string; days?: number[] }, date: Date): boolean {
  const d = date.getDay();
  switch (schedule.type) {
    case 'weekdays': return d >= 1 && d <= 5;
    case 'custom': return schedule.days?.includes(d) ?? false;
    default: return true; // 'daily' and anything unknown
  }
}

export function getStreakData(completions: Map<string, number>, habit: { schedule: { type: string; days?: number[] } }, shields: { usedAt?: string }[], vacation?: { start?: string; end?: string }): StreakData {
  const shieldCount = shields.filter(s => !s.usedAt).length;
  const doneDates = Array.from(completions.keys()).filter(d => (completions.get(d) || 0) > 0).sort();
  const total = doneDates.length;
  if (doneDates.length === 0) return { current: 0, longest: 0, total, shields: shieldCount, isActive: false };

  const vStart = vacation?.start ? parseDate(vacation.start) : null;
  const vEnd = vacation?.end ? parseDate(vacation.end) : null;
  /** Days inside an active vacation window neither count toward nor break a streak. */
  const onVacation = (d: Date): boolean => {
    if (!vStart && !vEnd) return false;
    const t = startOfDay(d).getTime();
    if (vStart && t < startOfDay(vStart).getTime()) return false;
    if (vEnd && t > startOfDay(vEnd).getTime()) return false;
    return true;
  };

  const done = new Set(doneDates);
  const today = startOfDay(new Date());

  // Current streak: walk backwards over scheduled days only.
  // If today is scheduled but not completed yet, don't break the streak — start from yesterday.
  // Vacation days are skipped entirely.
  let current = 0;
  let cursor = new Date(today);
  if (onVacation(cursor)) {
    while (onVacation(cursor)) cursor = subDays(cursor, 1);
  } else if (isScheduledOn(habit.schedule, cursor) && !done.has(getDateString(cursor))) {
    cursor = subDays(cursor, 1);
  }
  let guard = 0;
  while (guard++ < 5000) {
    if (onVacation(cursor)) { cursor = subDays(cursor, 1); continue; }
    if (!isScheduledOn(habit.schedule, cursor)) { cursor = subDays(cursor, 1); continue; }
    if (done.has(getDateString(cursor))) { current++; cursor = subDays(cursor, 1); } else break;
  }

  // Longest streak: scan scheduled-day runs from the first completion to today.
  let longest = 0; let run = 0;
  let day = parseDate(doneDates[0]);
  guard = 0;
  while (day <= today && guard++ < 5000) {
    if (onVacation(day)) { day = addDays(day, 1); continue; }
    if (isScheduledOn(habit.schedule, day)) {
      if (done.has(getDateString(day))) run++; else { longest = Math.max(longest, run); run = 0; }
    }
    day = addDays(day, 1);
  }
  longest = Math.max(longest, run, current);

  const isActive = current > 0;
  return { current, longest, total, shields: shieldCount, isActive };
}