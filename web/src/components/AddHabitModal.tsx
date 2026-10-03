import { useState } from 'react';
import type { Habit, TrackingMode, Reminder } from '@shared/types';
import { useHabitStore } from '../hooks/useHabitStore';

const MODES: { value: TrackingMode; label: string }[] = [
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'counter', label: 'Counter' },
  { value: 'number', label: 'Number' },
  { value: 'health', label: 'Health (manual)' },
  { value: 'time', label: 'Time / Pomodoro' },
];

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

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AddHabitModal({ onClose }: { onClose: () => void }) {
  const { addHabit } = useHabitStore();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<TrackingMode>('checkbox');
  const [color, setColor] = useState<string | null>(null);
  const [icon, setIcon] = useState('');
  const [target, setTarget] = useState('');
  const [description, setDescription] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [reminderDays, setReminderDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const reminder: Reminder | undefined = reminderEnabled
      ? { enabled: true, time: reminderTime, repeatDays: reminderDays }
      : undefined;
    addHabit({
      name: name.trim(),
      mode,
      color: color ?? undefined,
      icon: icon.trim() || undefined,
      target: target ? parseInt(target, 10) : undefined,
      description: description.trim() || undefined,
      reminder,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Add habit</span>
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
                placeholder="e.g. Morning pages"
                autoFocus
                onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && name.trim()) handleSubmit(e); }}
              />
            </div>

            {/* Mode */}
            <div className="field">
              <label className="field-label">Tracking mode</label>
              <select
                className="field-select"
                value={mode}
                onChange={e => setMode(e.target.value as TrackingMode)}
              >
                {MODES.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
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

            {/* Icon (emoji) */}
            <div className="field">
              <label className="field-label">Icon (emoji, optional)</label>
              <input
                className="field-input"
                value={icon}
                onChange={e => setIcon(e.target.value)}
                placeholder="☀️"
                maxLength={4}
              />
            </div>

            {/* Target — only for number mode */}
            {mode === 'number' && (
              <div className="field">
                <label className="field-label">Target value</label>
                <input
                  className="field-input"
                  type="number"
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  placeholder="e.g. 10000"
                />
              </div>
            )}

            {/* Reminder */}
            <div className="field">
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={e => setReminderEnabled(e.target.checked)}
                  style={{ accentColor: 'var(--accent)', width: '14px', height: '14px' }}
                />
                Reminder
              </label>
              {reminderEnabled && (
                <div className="reminder-fields" style={{ marginTop: '8px', padding: '10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <label className="field-label" style={{ fontSize: '11px' }}>Time</label>
                    <input
                      className="field-input"
                      type="time"
                      value={reminderTime}
                      onChange={e => setReminderTime(e.target.value)}
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    />
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    <label className="field-label" style={{ fontSize: '11px' }}>Days</label>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {DAYS.map((d, i) => (
                        <label
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '11px',
                            color: 'var(--fg-dim)',
                            cursor: 'pointer',
                            padding: '2px 6px',
                            background: reminderDays.includes(i) ? 'var(--bg-elevated)' : 'transparent',
                            border: reminderDays.includes(i) ? '1px solid var(--accent)' : '1px solid var(--border)',
                            borderRadius: 'var(--radius)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={reminderDays.includes(i)}
                            onChange={e => {
                              const next = e.target.checked
                                ? [...reminderDays, i]
                                : reminderDays.filter(day => day !== i);
                              setReminderDays(next);
                            }}
                            style={{ accentColor: 'var(--accent)', width: '12px', height: '12px' }}
                          />
                          {d}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--fg-dim)', fontStyle: 'italic' }}>
                    In-app alert at {reminderTime} on selected days. No push notifications.
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="field">
              <label className="field-label">Description (optional)</label>
              <input
                className="field-input"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Why this matters"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
