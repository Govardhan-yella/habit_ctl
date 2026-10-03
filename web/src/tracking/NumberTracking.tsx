import { useState, useCallback } from 'react';
import type { CheckIn } from '@shared/types';
import { useHabitStore } from '../hooks/useHabitStore';

interface Props {
  checkIn: CheckIn | undefined;
  habitId: string;
  target?: number;
}

export function NumberTracking({ checkIn, habitId, target }: Props) {
  const { upsertCheckIn } = useHabitStore();
  const [inputValue, setInputValue] = useState(String(checkIn?.value ?? ''));
  const [focused, setFocused] = useState(false);

  const commit = useCallback(() => {
    const n = parseInt(inputValue, 10);
    if (!isNaN(n)) {
      upsertCheckIn(habitId, (existing) => ({
        value: n,
        completed: true,
      }));
    }
    setFocused(false);
  }, [habitId, inputValue, upsertCheckIn]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') { setInputValue(String(checkIn?.value ?? '')); setFocused(false); }
  }, [commit, checkIn]);

  const remaining = target ? Math.max(0, target - (checkIn?.value ?? 0)) : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <input
        className="number-input field-input"
        type="text"
        inputMode="numeric"
        value={focused ? inputValue : String(checkIn?.value ?? '')}
        onChange={e => setInputValue(e.target.value.replace(/[^0-9\\-]/g, ''))}
        onFocus={() => { setFocused(true); setInputValue(String(checkIn?.value ?? '')); }}
        onBlur={() => { if (focused) commit(); }}
        onKeyDown={handleKeyDown}
        aria-label="Enter value"
        style={{ width: focused ? '70px' : '50px' }}
      />
      {remaining !== null && (
        <span className="small" style={{ marginLeft: '4px' }}>
          {remaining > 0 ? `${remaining} to go` : '✓'}
        </span>
      )}
    </div>
  );
}
