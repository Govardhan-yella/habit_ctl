import { useEffect, useRef } from 'react';
import type { Habit, Reminder } from '@shared/types';

/** In-app reminder scheduler — fires a visual toast at the scheduled time.
 * No push notifications; purely in-app. Recomputes on load and on habit changes.
 * Does NOT persist next-fire-time to storage (recomputed each session). */

interface ScheduledReminder {
  habit: Habit;
  reminder: Reminder;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

export function useReminders(habits: Habit[]) {
  const remindersRef = useRef<ScheduledReminder[]>([]);

  // Clear all scheduled timeouts
  const clearAll = () => {
    for (const r of remindersRef.current) {
      if (r.timeoutId) clearTimeout(r.timeoutId);
    }
    remindersRef.current = [];
  };

  // Schedule one reminder
  const scheduleOne = (habit: Habit, reminder: Reminder) => {
    if (!reminder.enabled) return;
    const [h, m] = reminder.time.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return;
    const now = new Date();
    const target = new Date(now);
    target.setHours(h, m, 0, 0);

    // If the time has already passed today, schedule for tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    const ms = target.getTime() - now.getTime();
    if (ms < 0) return;

    const timeoutId = setTimeout(() => {
      // Fire the alert (we just re-render to show a toast — handled by parent)
      // For v1, we dispatch a custom event the app can listen to
      window.dispatchEvent(new CustomEvent('habitctl-reminder', {
        detail: { habitId: habit.id, habitName: habit.name, time: reminder.time },
      }));
      // Re-schedule for the next matching day
      scheduleOne(habit, reminder);
    }, ms);

    remindersRef.current.push({ habit, reminder, timeoutId });
  };

  useEffect(() => {
    clearAll();
    const enabledReminders = habits
      .filter(h => h.reminder?.enabled);
    for (const h of enabledReminders) {
      scheduleOne(h, h.reminder!);
    }

    return clearAll;
  }, [habits]);

  return { clearAll };
}
