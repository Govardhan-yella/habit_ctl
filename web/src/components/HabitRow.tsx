import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Habit, TrackingMode, CheckIn, Routine } from '@shared/types';
import { useHabitStore } from '../hooks/useHabitStore';
import { CheckboxTracking } from '../tracking/CheckboxTracking';
import { CounterTracking } from '../tracking/CounterTracking';
import { NumberTracking } from '../tracking/NumberTracking';
import { HealthTracking } from '../tracking/HealthTracking';
import { TimeTracking } from '../tracking/TimeTracking';
import { StreakBadge } from './StreakBadge';
import { StreakDetail } from './StreakDetail';

interface HabitRowProps {
  habit: Habit;
  checkIn: CheckIn | undefined;
  onToggle: (habitId: string) => void;
  onDelete: (habitId: string) => void;
}

export function HabitRow({ habit, checkIn, onToggle, onDelete }: HabitRowProps) {
  const { getStreak, routines, attachHabitToRoutine, detachHabitFromRoutine } = useHabitStore();
  const streak = getStreak(habit.id);
  const completed = checkIn?.completed ?? false;
  const mode = habit.mode;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);

  const currentRoutine = routines.find(r => r.id === habit.routineId);

  const handleRoutineChange = async (routineId: string) => {
    if (routineId === '') {
      // Detach from current routine
      if (habit.routineId) {
        await detachHabitFromRoutine(habit.routineId, habit.id);
      }
    } else {
      // Attach to new routine
      if (habit.routineId !== routineId) {
        await attachHabitToRoutine(routineId, habit.id);
      }
    }
  };

  return (
    <div className={`habit-row${completed ? ' completed' : ''}`}>
      {/* icon or color dot */}
      <div className="habit-icon">
        {habit.icon ? habit.icon : '○'}
      </div>

      {/* optional color dot — use a wrapper span with inline style for CSS custom property */}
      {habit.color && (
        <span
          className="habit-color-dot"
          style={{ background: habit.color, boxShadow: `0 0 6px ${habit.color}` }}
        />
      )}

      {/* name + mode label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="habit-name">{habit.name}</div>
        <div className="habit-mode-label">
          {mode}
          {streak && streak.current > 0 && (
            <span className="streak-badge" onClick={() => setStreakOpen(true)} style={{ cursor: 'pointer' }}>
              <span className="streak-badge-fire">🔥</span> {streak.current}
            </span>
          )}
        </div>
      </div>

      {/* tracking cell */}
      <div className="tracking-cell">
        {mode === 'checkbox' && (
          <CheckboxTracking checkIn={checkIn} onToggle={() => onToggle(habit.id)} />
        )}
        {mode === 'counter' && (
          <CounterTracking checkIn={checkIn} habitId={habit.id} />
        )}
        {mode === 'number' && (
          <NumberTracking checkIn={checkIn} habitId={habit.id} target={habit.target} />
        )}
        {mode === 'health' && (
          <HealthTracking checkIn={checkIn} habitId={habit.id} />
        )}
        {mode === 'time' && (
          <TimeTracking checkIn={checkIn} habitId={habit.id} />
        )}
      </div>

      {/* routine assignment */}
      <div className="habit-routine-cell">
        <select
          className="habit-routine-select"
          value={habit.routineId ?? ''}
          onChange={e => handleRoutineChange(e.target.value)}
          title={habit.routineId ? `Assigned to: ${currentRoutine?.name}` : 'No routine assigned'}
        >
          <option value="">—</option>
          {routines.map(r => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {/* delete + streak detail */}
      {confirmingDelete ? (
        <div className="habit-delete-confirm" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: 'var(--fg-dim)', lineHeight: 1.4 }}>
            Delete habit? This also deletes check-ins and streak.
          </span>
          <button
            className="btn"
            style={{ padding: '2px 8px', fontSize: '10px', color: 'var(--fg-dim)' }}
            onClick={() => { onDelete(habit.id); setConfirmingDelete(false); }}
          >
            Confirm
          </button>
          <button
            className="btn"
            style={{ padding: '2px 8px', fontSize: '10px', color: 'var(--fg-dim)' }}
            onClick={() => setConfirmingDelete(false)}
          >
            Cancel
          </button>
        </div>
      ) : streakOpen ? (
        <StreakDetail
          habitId={habit.id}
          streak={streak}
          onClose={() => setStreakOpen(false)}
        />
      ) : (
        <button
          className="btn"
          style={{ padding: '2px 8px', fontSize: '10px', color: 'var(--fg-dim)' }}
          onClick={() => setConfirmingDelete(true)}
          title="Delete habit"
        >
          ✕
        </button>
      )}
    </div>
  );
}
