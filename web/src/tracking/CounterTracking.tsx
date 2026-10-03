import { useState, useCallback } from 'react';
import type { CheckIn } from '@shared/types';
import { useHabitStore } from '../hooks/useHabitStore';

interface Props {
  checkIn: CheckIn | undefined;
  habitId: string;
}

export function CounterTracking({ checkIn, habitId }: Props) {
  const { upsertCheckIn, todayCheckIns } = useHabitStore();
  const value = checkIn?.value ?? 0;

  const add = useCallback(() => {
    upsertCheckIn(habitId, (existing) => ({
      value: (existing?.value ?? 0) + 1,
      completed: true,
    }));
  }, [habitId, upsertCheckIn]);

  const subtract = useCallback(() => {
    const cur = (todayCheckIns[habitId]?.value ?? 0);
    if (cur <= 0) return;
    upsertCheckIn(habitId, (existing) => ({
      value: Math.max(0, (existing?.value ?? 0) - 1),
      completed: cur > 1,
    }));
  }, [habitId, upsertCheckIn, todayCheckIns]);

  const reset = useCallback(() => {
    upsertCheckIn(habitId, (existing) => ({
      value: 0,
      completed: false,
    }));
  }, [habitId, upsertCheckIn]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <button className="counter-btn" onClick={subtract} aria-label="Decrement">−</button>
      <span className="counter-value">{value}</span>
      <button className="counter-btn" onClick={add} aria-label="Increment">+</button>
      <button className="counter-btn" onClick={reset} aria-label="Reset" style={{ width: '18px', fontSize: '11px', opacity: 0.6 }}>
        ↺
      </button>
    </div>
  );
}
