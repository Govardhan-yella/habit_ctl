// habitctl — shared data model
// Single source of truth for web, iOS, Android, desktop.
// Import this file directly; do NOT duplicate these shapes.

/**
 * Tracking modes
 * - checkbox  : toggle complete/incomplete (one per day)
 * - counter   : increment / decrement / reset (one accumulated value per day)
 * - number    : enter a numeric value (e.g. "2000 mL water", "7523 steps")
 * - health    : read from Apple Health / Google Health Connect (manual entry in web v1)
 * - time      : pomodoro timer — logs a completed session (duration in minutes)
 */
export type TrackingMode = 'checkbox' | 'counter' | 'number' | 'health' | 'time';

export type DaysOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sun=0 … Sat=6

export interface Reminder {
  enabled: boolean;
  /** HH:mm local time, e.g. "09:00" */
  time: string;
  /** 0=Sun … 6=Sat; -1 means "every day" */
  repeatDays: number[];
  /** If set, this reminder belongs to a routine and fires for all its habits */
  routineId?: string;
}

export interface Habit {
  id: string;
  name: string;
  /** Optional free-text note */
  description?: string;
  mode: TrackingMode;
  /** Which routine this habit belongs to, if any */
  routineId?: string;
  /** Hex colour tag, e.g. "#fc6c26" */
  color?: string;
  /** Optional emoji/icon shown next to the name */
  icon?: string;
  /** For 'number' mode: the target value you're aiming for (e.g. 10000 steps) */
  target?: number;
  reminder?: Reminder;
  created_at: string; // ISO-8601
  archived_at?: string;
}

export interface Routine {
  id: string;
  name: string;
  color?: string;
  /** Habit IDs in display order */
  habit_ids: string[];
  reminder?: Reminder;
  created_at: string;
}

export interface CheckIn {
  id: string;
  habit_id: string;
  /** The day this check-in belongs to (yyyy-mm-dd, local calendar date) */
  date: string;
  /** For counter/number/time modes: the value recorded */
  value?: number;
  /** For time mode: duration in minutes (default 25) */
  duration?: number;
  /** For checkbox mode: true = completed */
  completed: boolean;
  /** When the user actually tapped it (ISO-8601, for ordering & undo) */
  timestamp: string;
  /** Whether this check-in happened while the habit's streak was shield-protected */
  shield_protected?: boolean;
}

export interface Streak {
  habit_id: string;
  current: number;
  longest: number;
  /** Last day the habit was checked in (yyyy-mm-dd) */
  last_date?: string;
  /** Dates (yyyy-mm-dd) that are shield-protected: a missed day on these dates doesn't break the streak */
  shield_dates: string[];
  /** If set, the streak is frozen and won't break until this date (yyyy-mm-dd) */
  vacation_until?: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Earliest date it was unlocked */
  unlocked_at?: string;
}

export interface UserProgress {
  xp: number;
  level: number;
  total_checkins: number;
  achievement_ids: string[];
}

export interface ExportFile {
  version: number;
  /** Schema version — bump when you change the shape so importers can migrate */
  exported_at: string;
  habits: Habit[];
  routines: Routine[];
  checkins: CheckIn[];
  streaks: Streak[];
  progress: UserProgress;
  /** Recognised theme names included in the export (for UI restore) */
  active_theme?: string;
}

/** XP table — rough, tweakable */
export const XP_PER_CHECKIN = 10;
export const XP_PER_STREAK_DAY = 5;
export const LEVEL_XP_TABLE: number[] = [
  0, 100, 200, 400, 700, 1100, 1600, 2200, 2900, 3700,
  4600, 5600, 6700, 7900, 9200, 10600, 12100, 13700, 15400, 17200,
];

export function xp_for_level(level: number): number {
  return LEVEL_XP_TABLE[level] ?? LEVEL_XP_TABLE[LEVEL_XP_TABLE.length - 1] + level * 1800;
}

export function level_for_xp(xp: number): number {
  let l = 0;
  for (let i = LEVEL_XP_TABLE.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_XP_TABLE[i]) { l = i; break; }
  }
  return l;
}

/** Small helper: generate a UUID v4 string (no dependency) */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
