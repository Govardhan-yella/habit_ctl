import { useCallback, useState } from 'react';
import type { Streak } from '@shared/types';
import { useHabitStore } from '../hooks/useHabitStore';
import { Heatmap } from './Heatmap';

interface Props {
  habitId: string;
  streak?: Streak;  // Optional: StreakDetail fetches fresh from store internally
  onClose: () => void;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function StreakDetail({ habitId, streak, onClose }: Props) {
  const { updateStreak, getStreak } = useHabitStore();
  const today = new Date().toISOString().slice(0, 10);
  const current = getStreak(habitId);
  const shieldDates = current?.shield_dates ?? [];
  const vacationUntil = current?.vacation_until;
  const [showHeatmap, setShowHeatmap] = useState(false);

  const toggleShield = useCallback((date: string) => {
    const dates = shieldDates.filter(d => d !== date);
    if (!dates.includes(date)) dates.push(date);
    updateStreak(habitId, { shield_dates: dates });
  }, [habitId, shieldDates, updateStreak]);

  const addShield = useCallback((date: string) => {
    if (!date || shieldDates.includes(date)) return;
    updateStreak(habitId, { shield_dates: [...shieldDates, date] });
  }, [habitId, shieldDates, updateStreak]);

  const setVacation = useCallback((date: string) => {
    updateStreak(habitId, { vacation_until: date || undefined });
  }, [habitId, updateStreak]);

  const clearVacation = useCallback(() => {
    updateStreak(habitId, { vacation_until: undefined });
  }, [habitId, updateStreak]);

  return (
    <div className="streak-detail-overlay" onClick={onClose}>
      <div className="streak-detail" onClick={e => e.stopPropagation()}>
        <div className="streak-detail-header">
          <span className="streak-detail-title">Streak</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="streak-detail-body">
          {/* Current + longest */}
          <div className="streak-detail-row">
            <div className="streak-detail-stat">
              <span style={{ fontSize: '28px', color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>
                {current?.current ?? 0}
              </span>
              <div className="streak-detail-stat-label">current</div>
            </div>
            <div className="streak-detail-stat">
              <span style={{ fontSize: '20px', color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)' }}>
                {current?.longest ?? 0}
              </span>
              <div className="streak-detail-stat-label">longest</div>
            </div>
          </div>

          {/* Last check-in */}
          <div style={{ fontSize: '12px', color: 'var(--fg-dim)', marginBottom: '12px' }}>
            Last check-in: {current?.last_date ?? 'never'}
          </div>

          {/* Heatmap toggle */}
          <div style={{ marginBottom: '12px' }}>
            <button
              className="btn"
              style={{ padding: '4px 12px', fontSize: '11px', width: '100%' }}
              onClick={() => setShowHeatmap(!showHeatmap)}
            >
              {showHeatmap ? '− Hide Heatmap' : '+ Show Heatmap'}
            </button>
          </div>

          {showHeatmap && (
            <div style={{ marginBottom: '12px' }}>
              <Heatmap habitId={habitId} onClose={() => setShowHeatmap(false)} />
            </div>
          )}

          {/* Shield */}
          <div className="streak-detail-section">
            <div className="streak-detail-section-title">Shield dates</div>
            <div style={{ fontSize: '11px', color: 'var(--fg-dim)', marginBottom: '6px' }}>
              Shielded dates ({shieldDates.length} set) — streak won't break on these
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
              {shieldDates.length > 0 ? shieldDates.map(d => (
                <button
                  key={d}
                  className="btn"
                  style={{ padding: '2px 8px', fontSize: '10px', color: d === today ? 'var(--accent)' : 'var(--fg-dim)' }}
                  onClick={() => toggleShield(d)}
                >
                  {d}{d === today ? ' •' : ''}
                </button>
              )) : (
                <span style={{ fontSize: '11px', color: 'var(--fg-dim)', fontStyle: 'italic' }}>
                  No shield dates set
                </span>
              )}
              <input
                className="number-input field-input"
                type="date"
                style={{ fontSize: '10px', padding: '2px 4px', width: '90px', fontFamily: 'var(--font-mono)' }}
                aria-label="Add shield date"
              />
              <button
                className="btn"
                style={{ padding: '2px 8px', fontSize: '10px' }}
                onClick={() => {
                  const input = document.querySelector('input[type="date"]') as HTMLInputElement;
                  if (input?.value) addShield(input.value);
                }}
              >
                + Add
              </button>
            </div>
          </div>

          {/* Vacation */}
          <div className="streak-detail-section">
            <div className="streak-detail-section-title">Vacation mode</div>
            <div style={{ fontSize: '11px', color: 'var(--fg-dim)', marginBottom: '6px' }}>
              Freeze the streak — it won't break until this date
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input
                type="date"
                style={{ fontSize: '11px', padding: '3px 6px', fontFamily: 'var(--font-mono)' }}
                min={today}
                aria-label="Vacation end date"
              />
              <button
                className="btn"
                style={{ padding: '3px 10px', fontSize: '11px' }}
                onClick={() => {
                  const input = document.querySelector('input[type="date"]') as HTMLInputElement;
                  if (input?.value) setVacation(input.value);
                }}
              >
                Set
              </button>
              {vacationUntil && (
                <>
                  <span style={{ fontSize: '11px', color: 'var(--accent)' }}>
                    Active until {vacationUntil}
                  </span>
                  <button
                    className="btn"
                    style={{ padding: '3px 8px', fontSize: '10px', color: 'var(--fg-dim)' }}
                    onClick={clearVacation}
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
