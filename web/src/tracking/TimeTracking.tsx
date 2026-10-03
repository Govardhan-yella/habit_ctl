import { useState, useCallback, useEffect, useRef } from 'react';
import type { CheckIn } from '@shared/types';
import { useHabitStore } from '../hooks/useHabitStore';

interface Props {
  checkIn: CheckIn | undefined;
  habitId: string;
}

const PRESETS: { label: string; minutes: number }[] = [
  { label: '15m', minutes: 15 },
  { label: '25m', minutes: 25 },
  { label: '40m', minutes: 40 },
  { label: '60m', minutes: 60 },
];

export function TimeTracking({ checkIn, habitId }: Props) {
  const { upsertCheckIn } = useHabitStore();
  const [active, setActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [presetMinutes, setPresetMinutes] = useState(25);
  const [customMinutes, setCustomMinutes] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsLeftRef = useRef(secondsLeft);
  secondsLeftRef.current = secondsLeft;

  const start = useCallback(() => {
    const minutes = presetMinutes > 0 ? presetMinutes : parseInt(customMinutes, 10) || 25;
    setPresetMinutes(minutes);
    setSecondsLeft(minutes * 60);
    setActive(true);
  }, [presetMinutes, customMinutes]);

  const stop = useCallback(() => {
    setActive(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const reset = useCallback(() => {
    setActive(false);
    setSecondsLeft(presetMinutes * 60);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [presetMinutes]);

  const complete = useCallback(() => {
    const elapsed = (presetMinutes * 60) - secondsLeftRef.current;
    const minutes = Math.max(1, Math.round(elapsed / 60));
    upsertCheckIn(habitId, (existing) => ({
      ...existing!,
      value: minutes,
      duration: minutes,
      completed: true,
      timestamp: new Date().toISOString(),
    }));
    setActive(false);
    setSecondsLeft(presetMinutes * 60);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [habitId, checkIn, presetMinutes, upsertCheckIn]);

  useEffect(() => {
    if (!active) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          complete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, complete]);

  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;
  const alreadyDone = checkIn?.completed && (checkIn?.duration ?? 0) > 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
      {alreadyDone ? (
        <span style={{ fontSize: '12px', color: 'var(--success)', whiteSpace: 'nowrap' }}>
          ✓ {checkIn?.duration}m
        </span>
      ) : (
        <>
          {/* Preset buttons */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {PRESETS.map(p => (
              <button
                key={p.label}
                className={`timer-btn${presetMinutes === p.minutes ? ' active' : ''}`}
                onClick={() => { setPresetMinutes(p.minutes); setSecondsLeft(p.minutes * 60); }}
                title={`Set ${p.label} timer`}
                aria-label={`${p.label} preset`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom input */}
          <input
            className="number-input field-input"
            type="number"
            min={1}
            max={480}
            value={customMinutes}
            onChange={e => setCustomMinutes(e.target.value.replace(/[^0-9]/g, ''))}
            onFocus={() => setPresetMinutes(0)}
            placeholder="custom"
            style={{ width: '50px', fontSize: '11px' }}
            aria-label="Custom minutes"
          />
          <span style={{ fontSize: '10px', color: 'var(--fg-dim)' }}>min</span>

          {/* Controls */}
          <button
            className={`timer-btn${active ? ' active' : ''}`}
            onClick={active ? stop : start}
            aria-label={active ? 'Stop timer' : 'Start timer'}
          >
            {active ? '■' : '▶'}
          </button>

          <button
            className="timer-btn"
            onClick={reset}
            aria-label="Reset timer"
            title="Reset"
            style={{ width: '18px', fontSize: '11px', opacity: 0.6 }}
          >
            ↺
          </button>

          <span className="timer-display">
            {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
          </span>
        </>
      )}
    </div>
  );
}
