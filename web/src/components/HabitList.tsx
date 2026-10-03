import { useHabitStore } from '../hooks/useHabitStore';
import { HabitRow } from './HabitRow';

export function HabitList() {
  const { habits, todayCheckIns, toggleHabit, deleteHabit } = useHabitStore();

  const empty = habits.length === 0;

  const handleToggle = (habitId: string) => {
    toggleHabit(habitId as any);
  };

  const handleDelete = (habitId: string) => {
    deleteHabit(habitId);
  };

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
    </div>
  );
}
