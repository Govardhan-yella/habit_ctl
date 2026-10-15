import { useCallback, useMemo, useState } from 'react';
import { useHabitStore } from '../hooks/useHabitStore';
import { Heatmap } from './Heatmap';

export function StreakBadge({ habitId }: { habitId: string }) {
  const { getStreak, getRecentTrend } = useHabitStore();
  const streak = getStreak(habitId);
  const [heatmapOpen, setHeatmapOpen] = useState(false);

  const trend = useMemo(() => getRecentTrend?.(habitId, 7), [habitId, getRecentTrend]);

  if (!streak || streak.current === 0) return null;

  return (
    <>
      <span className="streak-badge" onClick={() => setHeatmapOpen(true)} style={{ cursor: 'pointer', position: 'relative' }}>
        <span className="streak-flame">🔥</span>
        <span className="streak-count">{streak.current}</span>
        {trend && <span className="streak-spark">{trend}</span>}
      </span>
      {heatmapOpen && (
        <Heatmap habitId={habitId} onClose={() => setHeatmapOpen(false)} />
      )}
    </>
  );
}
