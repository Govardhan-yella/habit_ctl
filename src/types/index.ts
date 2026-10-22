export type HabitMode = 'checkbox' | 'counter' | 'number' | 'timer' | 'health';

export type ScheduleType = 'daily' | 'weekdays' | 'custom';

export interface Schedule {
  type: ScheduleType;
  days?: number[];
}

export interface Reminder {
  id: string;
  time: string;
  days: number[];
  enabled: boolean;
}

/**
 * How a habit/routine name picks its text colour:
 *   default — inherit the theme's text colour
 *   auto    — derive it from the item's accent colour
 *   custom  — use an explicit colour
 */
export type TextColorMode = 'default' | 'auto' | 'custom';

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** Optional override for the habit name's text colour. Only used when textColorMode is 'custom'. */
  textColor?: string;
  /** Text colour strategy. Undefined is treated as 'default'. */
  textColorMode?: TextColorMode;
  mode: HabitMode;
  target: number;
  unit?: string;
  schedule: Schedule;
  reminders: Reminder[];
  routineId?: string;
  createdAt: string;
  archivedAt?: string;
  updatedAt: string;
  order: number;
}

export interface Completion {
  id: string;
  habitId: string;
  date: string;
  value: number;
  createdAt: string;
  synced: boolean;
}

export interface Shield {
  id: string;
  habitId: string;
  earnedAt: string;
  usedAt?: string;
  source: 'streak' | 'manual';
}

export interface Routine {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** Optional override for the routine name's text colour. Only used when textColorMode is 'custom'. */
  textColor?: string;
  /** Text colour strategy. Undefined is treated as 'default'. */
  textColorMode?: TextColorMode;
  schedule: Schedule;
  habitIds: string[];
  createdAt: string;
  updatedAt: string;
  order: number;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  isCustom: boolean;
  isPro: boolean;
  variant?: 'dark' | 'light';
  fontFamily?: string;
  createdAt?: string;
}

export interface ThemeColors {
  bg: string;
  bgSecondary: string;
  fg: string;
  fgMuted: string;
  accent: string;
  accentMuted: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  accentAlt?: string;
  info?: string;
  heatmap: HeatmapColors;
}

export interface HeatmapColors {
  level0: string;
  level1: string;
  level2: string;
  level3: string;
  level4: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: 'apple' | 'email';
  proTier: 'free' | 'monthly' | 'annual' | 'lifetime';
  proExpiresAt?: string;
  settings: UserSettings;
  createdAt: string;
}

export interface MoodLog {
  id: string;
  date: string;
  mood: string;
  createdAt: string;
}

export interface WaterLog {
  id: string;
  date: string;
  glasses: number;
  createdAt: string;
}

export interface Note {
  id: string;
  text: string;
  habitId?: string;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  mode: HabitMode;
  target: number;
  unit?: string;
  schedule: Schedule;
  reminders: Reminder[];
  icon: string;
  color: string;
}

export interface UserSettings {
  themeId: string;
  syncEnabled: boolean;
  iCloudSync: boolean;
  animations: boolean;
  hapticFeedback: boolean;
  weekStartsOn: 0 | 1;
  dateFormat: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';
  timeFormat: '12h' | '24h';
  language: string;
  matteMode: boolean;
  passcodeEnabled: boolean;
  passcode?: string;
  biometricEnabled: boolean;
  vacationMode: boolean;
  vacationStartsAt?: string;
  vacationEndsAt?: string;
  customCSS?: string;
  sortBy?: 'alpha' | 'due' | 'streak' | 'progress' | 'created';
}

export interface StreakData {
  current: number;
  longest: number;
  total: number;
  shields: number;
  isActive: boolean;
}

export interface HeatmapDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  habits: string[];
}

export interface XPData {
  xp: number;
  level: number;
  xpToNext: number;
  totalXp: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  progress: number;
  target: number;
}

export interface SyncState {
  status: 'idle' | 'syncing' | 'error' | 'offline';
  lastSync?: string;
  pendingChanges: number;
  error?: string;
}

export interface AppState {
  user: User | null;
  habits: Habit[];
  routines: Routine[];
  completions: Completion[];
  shields: Shield[];
  themes: Theme[];
  theme: Theme;
  sync: SyncState;
  view: 'list' | 'heatmap' | 'routines' | 'stats' | 'settings';
  selectedHabitId?: string;
  selectedDate: string;
  searchQuery: string;
  filterMode: 'all' | 'active' | 'archived' | 'today';
  moods: MoodLog[];
  waters: WaterLog[];
  notes: Note[];
  templates: Template[];
}