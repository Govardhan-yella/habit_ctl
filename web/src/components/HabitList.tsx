import { useMemo } from 'react';
import { useHabitStore } from '../hooks/useHabitStore';
import { HabitRow } from './HabitRow';

export function HabitList() {
  const { habits, todayCheckIns, toggleHabit, deleteHabit } = useHabitStore();

  const empty = habits.length === 0;

  const handleToggle = (habitId: string) => {
    toggleHabit(habitId);
  };

  const handleDelete = (habitId: string) => {
    deleteHabit(habitId);
  };

  // Calculate daily progress
  const progress = useMemo(() => {
    if (habits.length === 0) return { completed: 0, total: 0, percent: 0 };

    // Checkbox habits: completed if checked today
    // Other modes: completed if there's a check-in today with completed=true
    const completed = habits.filter(habit => {
      const ci = todayCheckIns[habit.id];
      if (habit.mode === 'checkbox') {
        return ci?.completed ?? false;
      }
      return ci?.completed ?? false;
    }).length;

    const total = habits.length;
    const percent = Math.round((completed / total) * 100);

    return { completed, total, percent };
  }, [habits, todayCheckIns]);

  return (
    <div className="habit-list">
      {empty ? (
        <div className="habit-list-empty">
          <div className="habit-list-empty-icon">⌘</div>
          <div className="habit-list-empty-text">
            No habits yet.<br />
            Press <kbd style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '2px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: '11px' }}>+</kbd> in the corner to add one.
          </div>
        </div>
      ) : (
        habits.map(habit => (
          <HabitRow
            key={habit.id}
            habit={habit}
            checkIn={todayCheckIns[habit.id] ?? undefined}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        ))
      )}

      {/* Daily progress bar */}
      {!empty && (
        <div className="habit-list-progress">
          <div className="habit-list-progress-bar">
            <div
              className="habit-list-progress-fill"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <span className="habit-list-progress-text">
            {progress.completed}/{progress.total} habits done today
          </span>
        </div>
      )}
    </div>
  );
}
