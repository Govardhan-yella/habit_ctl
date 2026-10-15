import { useCallback, useState } from 'react';
import { useHabitStore } from '../hooks/useHabitStore';
import { Heatmap } from './Heatmap';

export function StreakBadge({ habitId }: { habitId: string }) {
  const { getStreak } = useHabitStore();
  const streak = getStreak(habitId);
  const [heatmapOpen, setHeatmapOpen] = useState(false);

  if (!streak || streak.current === 0) return null;

  return (
    <>
      <span className="streak-badge" onClick={() => setHeatmapOpen(true)} style={{ cursor: 'pointer', position: 'relative' }}>
        <span className="streak-flame">🔥</span>
        <span className="streak-count">{streak.current}</span>
      </span>
      {heatmapOpen && (
        <Heatmap habitId={habitId} onClose={() => setHeatmapOpen(false)} />
      )}
    </>
  );
}
