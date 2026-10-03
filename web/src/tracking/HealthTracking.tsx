import { useState, useCallback, useRef } from 'react';
import type { CheckIn } from '@shared/types';
import { useHabitStore } from '../hooks/useHabitStore';

interface Props {
  checkIn: CheckIn | undefined;
  habitId: string;
}

// Common health-unit manual entries.
const UNITS: { label: string; value: string }[] = [
  { label: 'steps', value: 'steps' },
  { label: 'sleep h', value: 'sleep' },
  { label: 'water mL', value: 'water' },
  { label: 'kcal', value: 'kcal' },
  { label: 'mindful min', value: 'mindful' },
];

export function HealthTracking({ checkIn, habitId }: Props) {
  const { upsertCheckIn } = useHabitStore();
  const [value, setValue] = useState(String(checkIn?.value ?? ''));
  const [unit, setUnit] = useState('steps');
  const checkInRef = useRef(checkIn);
  checkInRef.current = checkIn;

  const commit = useCallback(() => {
    const n = parseInt(value, 10);
    if (!isNaN(n)) {
      upsertCheckIn(habitId, (existing) => ({
        ...existing!,
        value: n,
        completed: true,
        timestamp: new Date().toISOString(),
      }));
    }
  }, [habitId, value, upsertCheckIn]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit();
  }, [commit]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <input
        className="number-input field-input"
        type="text"
        inputMode="numeric"
        value={value}
        onChange={e => setValue(e.target.value.replace(/[^0-9]/g, ''))}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        onFocus={() => {
          setValue(String(checkInRef.current?.value ?? ''));
        }}
        aria-label="Enter value"
        style={{ width: '50px' }}
      />
      <select
        className="field-select"
        value={unit}
        onChange={e => setUnit(e.target.value)}
        style={{ width: '80px', fontSize: '11px', padding: '4px 6px' }}
        aria-label="Unit"
      >
        {UNITS.map(u => (
          <option key={u.value} value={u.value}>{u.label}</option>
        ))}
      </select>
    </div>
  );
}
