import { useState } from 'react';
import type { Routine } from '@shared/types';
import { useHabitStore } from '../hooks/useHabitStore';

const COLORS: string[] = [
  '#fc6c26', // burnt orange
  '#7aa2f7', // blue
  '#9ece6a', // green
  '#e0af68', // orange
  '#f7768e', // pink/red
  '#bb9af7', // purple
  '#565f89', // dark blue
  '#a9dc76', // light green
];

export function AddRoutineModal({ onClose }: { onClose: () => void }) {
  const { addRoutine, habits } = useHabitStore();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [selectedHabitIds, setSelectedHabitIds] = useState<Set<string>>(new Set());

  const toggleHabit = (habitId: string) => {
    const next = new Set(selectedHabitIds);
    if (next.has(habitId)) {
      next.delete(habitId);
    } else {
      next.add(habitId);
    }
    setSelectedHabitIds(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addRoutine({
      name: name.trim(),
      color: color ?? undefined,
      habit_ids: Array.from(selectedHabitIds),
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Add routine</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Name */}
            <div className="field">
              <label className="field-label">Name</label>
              <input
                className="field-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Morning routine"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Escape') onClose();
                  if (e.key === 'Enter' && name.trim()) handleSubmit(e);
                }}
              />
            </div>

            {/* Color */}
            <div className="field">
              <label className="field-label">Colour</label>
              <div className="color-options">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`color-swatch${color === c ? ' selected' : ''}`}
                    style={{
                      background: c,
                      border: '1.5px solid var(--border)',
                    }}
                    onClick={() => setColor(c)}
                    title={c}
                  />
                ))}
                <button
                  type="button"
                  className={`color-swatch${color === null ? ' selected' : ''}`}
                  style={{
                    background: 'transparent',
                    border: '1.5px solid var(--border)',
                  }}
                  onClick={() => setColor(null)}
                  title="No colour"
                >
                  <span style={{ fontSize: '10px', color: 'var(--fg-dim)' }}>−</span>
                </button>
              </div>
            </div>

            {/* Habits to include */}
            <div className="field">
              <label className="field-label">Habits in this routine</label>
              {habits.length === 0 ? (
                <div className="empty-state" style={{ padding: '12px 0' }}>
                  No habits yet. Add some habits first.
                </div>
              ) : (
                <div className="routine-habit-picker">
                  {habits.map(habit => (
                    <label
                      key={habit.id}
                      className={`routine-habit-option${selectedHabitIds.has(habit.id) ? ' selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedHabitIds.has(habit.id)}
                        onChange={() => toggleHabit(habit.id)}
                        className="routine-habit-checkbox"
                      />
                      <span className="routine-habit-option-icon">
                        {habit.icon ?? '○'}
                      </span>
                      <span className="routine-habit-option-name">{habit.name}</span>
                      {habit.color && (
                        <span
                          className="routine-habit-option-color-dot"
                          style={{ background: habit.color }}
                        />
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim()}
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
