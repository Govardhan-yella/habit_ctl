import { useMemo } from 'react';
import { useHabitStore } from '../hooks/useHabitStore';
import { HabitRow } from './HabitRow';

export function HabitList() {
  const { habits, todayCheckIns, checkIns, toggleHabit, deleteHabit, streakMap, loading } = useHabitStore();

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

  // Aggregated ASCII sparkline: 7-day trend across all habits
  // (█ = >50% of habits done, ░ = <50%). Replaces per-habit sparklines.
  const progressTrend = useMemo(() => {
    if (habits.length === 0) return '';
    const today = new Date();
    const result: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      let completed = 0;
      for (const habit of habits) {
        const ci = checkIns.find(
          (c) => c.habit_id === habit.id && c.date === dateStr && c.completed,
        );
        if (ci) completed++;
      }
      const ratio = completed / habits.length;
      result.push(ratio >= 0.5 ? '█' : '░');
    }
    return result.join('');
  }, [habits, checkIns]);

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

      {/* Daily progress bar — only show after data has loaded */}
      {!empty && !loading && (
        <div className="habit-list-progress">
          <div className="habit-list-progress-bar segmented" data-complete={progress.percent === 100 ? 'true' : 'false'}>
            {habits.map(habit => {
              const done = todayCheckIns[habit.id]?.completed ?? false;
              return (
                <span
                  key={habit.id}
                  className={`seg ${done ? 'done' : 'todo'}`}
                  title={`${habit.name}: ${done ? 'done' : 'not yet'}`}
                />
              );
            })}
          </div>
          <div className="habit-list-progress-stats">
            <span className="habit-list-progress-text">
              <span className="progress-percent">{progress.percent}%</span>
              <span className="progress-count">{progress.completed}/{progress.total} today</span>
            </span>
            {/* ASCII sparkline trend on overall progress */}
            {progressTrend && (
              <span className="progress-trend" title="7-day completion trend">{progressTrend}</span>
            )}
            {/* Streak overview with ASCII sparkline */}
            {streakStats.activeStreaks > 0 && (
              <span className="habit-list-streak-summary" title={`${streakStats.activeStreaks} active streaks · longest: ${streakStats.longestOverall} days · avg: ${streakStats.avgStreak} days`}>
                <span style={{ fontSize: '9px' }}>🔥</span>
                {streakStats.activeStreaks} active · best {streakStats.longestOverall}
                <span className="streak-spark">{Array.from({ length: Math.min(streakStats.activeStreaks, 8) }, (_, i) => '█').join('')}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
