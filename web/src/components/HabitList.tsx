import { useMemo } from 'react';
import { useHabitStore } from '../hooks/useHabitStore';
import { HabitRow } from './HabitRow';

export function HabitList() {
  const { habits, todayCheckIns, toggleHabit, deleteHabit, streakMap } = useHabitStore();

  const empty = habits.length === 0;

  const handleToggle = (habitId: string) => {
    toggleHabit(habitId);
  };

  const handleDelete = (habitId: string) => {
    deleteHabit(habitId);
  };

  // Calculate daily progress
  const progress = useMemo(() => {
    if (habits.length === 0) return { completed: 0, total: 0, percent: 0 };

    const completed = habits.filter(habit => {
      const ci = todayCheckIns[habit.id];
      return ci?.completed ?? false;
    }).length;

    const total = habits.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percent };
  }, [habits, todayCheckIns]);

  // Calculate streak stats for mini visualization
  const streakStats = useMemo(() => {
    const streaks = habits.map(h => streakMap[h.id]).filter(s => s && s.current > 0);
    const activeStreaks = streaks.length;
    const longestOverall = Math.max(0, ...streaks.map(s => s?.longest ?? 0));
    const avgStreak = streaks.length > 0
      ? Math.round(streaks.reduce((sum, s) => sum + (s?.current ?? 0), 0) / streaks.length)
      : 0;

    return { activeStreaks, longestOverall, avgStreak };
  }, [habits, streakMap]);

  // Build ASCII sparkline for overall progress trend
  const progressTrend = useMemo(() => {
    if (habits.length === 0) return '';
    // Generate sparkline from check-in completeness
    return Array.from({ length: 5 }, (_, i) => {
      const idx = progress.completed + i;
      return idx < progress.total ? '░' : (idx < habits.length ? '▒' : '█');
    }).join('');
  }, [progress, habits.length]);

  return (
    <div className="habit-list">
      {empty ? (
        <div className="habit-list-empty">
          <div className="habit-list-empty-icon">⌘</div>
          <div className="habit-list-empty-text">
            No habits yet.<br />
            Press <kbd style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '2px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: '11px' }}>+</kbd> in the corner to add one.
          </div>
        </div>
      ) : (
        habits.map(habit => (
          <HabitRow
            key={habit.id}
            habit={habit}
            checkIn={todayCheckIns[habit.id] ?? undefined}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        ))
      )}

      {/* Daily progress bar */}
      {!empty && (
        <div className="habit-list-progress">
          <div className="habit-list-progress-bar">
            <div
              className="habit-list-progress-fill"
              data-complete={progress.percent === 100 ? 'true' : 'false'}
              style={{
                width: `${progress.percent}%`,
                transition: 'width 0.4s cubic-bezier(0.25, 0.4, 0.25, 1), background-color 0.3s ease',
              }}
            />
          </div>
          <div className="habit-list-progress-stats">
            <span className="habit-list-progress-text">
              <span className="progress-percent">{progress.percent}%</span>
              <span className="progress-count">{progress.completed}/{progress.total} today</span>
            </span>
            {/* Streak overview */}
            {streakStats.activeStreaks > 0 && (
              <span className="habit-list-streak-summary" title={`${streakStats.activeStreaks} active streaks · longest: ${streakStats.longestOverall} days · avg: ${streakStats.avgStreak} days`}>
                <span style={{ fontSize: '9px' }}>🔥</span>
                {streakStats.activeStreaks} active · best {streakStats.longestOverall}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
