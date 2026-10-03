import { useState } from 'react';
import type { Routine } from '@shared/types';
import { useHabitStore } from '../hooks/useHabitStore';

interface RoutineListProps {
  onAddRoutine: () => void;
}

export function RoutineList({ onAddRoutine }: RoutineListProps) {
  const { routines, habits, deleteRoutine } = useHabitStore();
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const habitById = (id: string) => habits.find(h => h.id === id);

  return (
    <div className="routine-list">
      {routines.length === 0 ? (
        <div className="routine-list-empty">
          <div className="routine-list-empty-icon">⟳</div>
          <div className="routine-list-empty-text">
            No routines yet.<br />
            Press{' '}
            <kbd
              style={{
                background: 'var(--bg-elevated)',
                padding: '2px 6px',
                borderRadius: '2px',
                border: '1px solid var(--border)',
                fontFamily: 'inherit',
                fontSize: '11px',
              }}
            >
              +
            </kbd>
           {' '}
            to group habits into a routine.
          </div>
        </div>
      ) : (
        routines.map(routine => (
          <div key={routine.id} className="routine-group">
            {/* Routine header */}
            <div className="routine-header">
              <div className="routine-name-row">
                {routine.color && (
                  <span
                    className="routine-color-dot"
                    style={{
                      background: routine.color,
                      boxShadow: `0 0 6px ${routine.color}`,
                    }}
                  />
                )}
                <span className="routine-name">{routine.name}</span>
                <span className="routine-count small">
                  {routine.habit_ids.length} habit{routine.habit_ids.length !== 1 ? 's' : ''}
                </span>
              </div>
              {confirmingDelete === routine.id ? (
                <div className="routine-delete-confirm" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: 'var(--fg-dim)', lineHeight: 1.4 }}>
                    Delete routine?
                  </span>
                  <button
                    className="btn"
                    style={{ padding: '2px 8px', fontSize: '10px', color: 'var(--fg-dim)' }}
                    onClick={() => {
                      deleteRoutine(routine.id);
                      setConfirmingDelete(null);
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    className="btn"
                    style={{ padding: '2px 8px', fontSize: '10px', color: 'var(--fg-dim)' }}
                    onClick={() => setConfirmingDelete(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="btn"
                  style={{ padding: '2px 8px', fontSize: '10px', color: 'var(--fg-dim)' }}
                  onClick={() => setConfirmingDelete(routine.id)}
                  title="Delete routine"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Habits in this routine */}
            {routine.habit_ids.length === 0 ? (
              <div className="routine-empty-habits">
                <span className="small">No habits assigned.</span>
              </div>
            ) : (
              <div className="routine-habits">
                {routine.habit_ids.map(habitId => {
                  const habit = habitById(habitId);
                  if (!habit) return null;
                  return (
                    <div key={habitId} className="routine-habit-row">
                      <div className="habit-icon" style={{ fontSize: '13px' }}>
                        {habit.icon ?? '○'}
                      </div>
                      <span className="routine-habit-name">{habit.name}</span>
                      {habit.color && (
                        <span
                          className="routine-habit-color-dot"
                          style={{
                            background: habit.color,
                            boxShadow: `0 0 4px ${habit.color}`,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
