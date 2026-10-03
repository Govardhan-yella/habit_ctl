import { useState, useCallback, useRef, useEffect } from 'react';
import type { CheckIn } from '@shared/types';
import { useHabitStore } from '../hooks/useHabitStore';

interface Props {
  checkIn: CheckIn | undefined;
  onToggle: () => void;
}

export function CheckboxTracking({ checkIn, onToggle }: Props) {
  const completed = checkIn?.completed ?? false;
  const [justToggled, setJustToggled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleToggle = useCallback(() => {
    onToggle();
    setJustToggled(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setJustToggled(false), 400);
  }, [onToggle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const showRing = justToggled || completed;

  return (
    <button
      className={`checkbox${completed ? ' checked' : ''}`}
      onClick={handleToggle}
      aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
      style={{
        boxShadow: showRing ? `0 0 0 2px var(--accent)` : 'none',
        transition: 'box-shadow 0.15s',
      }}
    />
  );
}
