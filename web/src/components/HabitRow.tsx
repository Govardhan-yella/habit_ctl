import { useState, useEffect } from 'react';
import type { Habit, TrackingMode, CheckIn } from '@shared/types';
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
  const { getRecentTrend, routines, attachHabitToRoutine, detachHabitFromRoutine } = useHabitStore();
  const completed = checkIn?.completed ?? false;
  const mode = habit.mode;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const currentRoutine = routines.find(r => r.id === habit.routineId);

  const handleRoutineChange = async (routineId: string) => {
    if (routineId === '') {
      if (habit.routineId) {
        await detachHabitFromRoutine(habit.routineId, habit.id);
      }
    } else {
      if (habit.routineId !== routineId) {
        await attachHabitToRoutine(routineId, habit.id);
      }
    }
  };

  const trend = getRecentTrend(habit.id, 7);

  return (
    <div className={`habit-row${completed ? ' completed' : ''}`}>
      {/* icon or color dot */}
      <div className="habit-icon">
        {habit.icon ? habit.icon : '○'}
      </div>

      {/* optional color dot */}
      {habit.color && (
        <span
          className="habit-color-dot"
          style={{ background: habit.color }}
        />
      )}

      {/* name + mode label + streak */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="habit-name">
          <span className="status-dot" style={{
            background: completed ? 'var(--success)' : 'var(--fg-dim)',
            opacity: completed ? 1 : 0.5,
          }}></span>
          {habit.name}
        </div>
        <div className="habit-mode-label">
          {mode}
          {trend && trend !== '░░░░░░░' && (
            <span className="streak-trend-container" title="Last 7 days of completions">
              <span className="streak-spark">{trend}</span>
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

      {/* streak badge + delete / streak detail */}
      <StreakBadge habitId={habit.id} />
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
      ) : detailOpen ? (
        <StreakDetail
          habitId={habit.id}
          onClose={() => setDetailOpen(false)}
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
