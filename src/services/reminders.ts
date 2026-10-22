import { store } from '../stores/appStore';
import { Habit, Reminder } from '../types';
import { getTodayString } from '../utils/date';
import { createToast } from '../components/TerminalUI';
import { habitLogoText } from '../components/habitLogo';

const CHECK_INTERVAL_MS = 20_000;
const MAX_FIRED_MEMORY = 500;

let intervalId: number | undefined;
const fired = new Set<string>();

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

function nowHHMM(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function isCompleted(habit: Habit, date: string): boolean {
  const c = store.getState().completions.find(x => x.habitId === habit.id && x.date === date);
  if (!c) return false;
  return habit.mode === 'checkbox' ? true : c.value >= habit.target;
}

function reminderAppliesToday(r: Reminder, day: number): boolean {
  return !r.days || r.days.length === 0 || r.days.includes(day);
}

function notify(habit: Habit, r: Reminder): void {
  const body = habit.mode === 'checkbox'
    ? 'Time to check in'
    : `Target: ${habit.target}${habit.unit ? ' ' + habit.unit : ''}`;
  const title = `${habitLogoText(habit)} ${habit.name}`.replace(/\s+/g, ' ').trim();
  if (notificationsSupported() && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag: `habit-${habit.id}-${r.id}` });
      return;
    } catch {
      // fall through to in-app toast
    }
  }
  createToast(`⏰ ${title} — ${body}`, 'info');
}

function tick(): void {
  const state = store.getState();
  if (store.getSettings().vacationMode) return;
  const date = getTodayString();
  const time = nowHHMM();
  const day = new Date().getDay();

  for (const habit of state.habits) {
    if (habit.archivedAt || !habit.reminders?.length) continue;
    for (const r of habit.reminders) {
      if (!r.enabled || !r.time || r.time !== time || !reminderAppliesToday(r, day)) continue;
      if (isCompleted(habit, date)) continue;
      const key = `${habit.id}|${r.id}|${date}|${time}`;
      if (fired.has(key)) continue;
      fired.add(key);
      notify(habit, r);
    }
  }

  if (fired.size > MAX_FIRED_MEMORY) fired.clear();
}

export function startReminderService(): void {
  if (intervalId !== undefined) return;
  tick();
  intervalId = window.setInterval(tick, CHECK_INTERVAL_MS);
}

export function stopReminderService(): void {
  if (intervalId !== undefined) {
    clearInterval(intervalId);
    intervalId = undefined;
  }
}
