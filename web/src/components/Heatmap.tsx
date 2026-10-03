import { useMemo } from 'react';
import type { CheckIn } from '@shared/types';
import { useHabitStore } from '../hooks/useHabitStore';

interface Props {
  habitId: string;
  onClose: () => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_SHOWN = 365;

export function Heatmap({ habitId, onClose }: Props) {
  const { checkIns, getStreak } = useHabitStore();
  const streak = getStreak(habitId);

  const { cells, startDate } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const start = new Date(today);
    start.setDate(start.getDate() - DAYS_SHOWN + 1);
    const startStr = start.toISOString().slice(0, 10);

    // Build a map: date -> check-in (latest per day)
    const map: Record<string, CheckIn | null> = {};
    for (const c of checkIns ?? []) {
      if (c.habit_id !== habitId) continue;
      if (!map[c.date] || c.timestamp > (map[c.date]?.timestamp ?? '')) {
        map[c.date] = c;
      }
    }

    const cells: { date: string; count: number; level: number; completed: boolean }[] = [];
    const cursor = new Date(start);
    for (let i = 0; i < DAYS_SHOWN; i++) {
      const date = cursor.toISOString().slice(0, 10);
      const ci = map[date];
      const completed = ci?.completed ?? false;
      const count = ci?.value ?? (completed ? 1 : 0);
      // Level 0-4 based on count (log-ish scale)
      let level = 0;
      if (completed && count > 0) {
        if (count >= 100) level = 4;
        else if (count >= 20) level = 3;
        else if (count >= 5) level = 2;
        else level = 1;
      }
      cells.push({ date, count, level, completed });
      cursor.setDate(cursor.getDate() + 1);
    }

    return { cells, startDate: startStr };
  }, [checkIns, habitId]);

  const weeks = useMemo(() => {
    const result: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7));
    }
    return result;
  }, [cells]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="heatmap-overlay" onClick={onClose}>
      <div className="heatmap-panel" onClick={e => e.stopPropagation()}>
        <div className="heatmap-header">
          <span className="heatmap-title">Heatmap</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="heatmap-body">
          {/* Legend */}
          <div className="heatmap-legend">
            {[
              { level: 0, label: 'No activity' },
              { level: 1, label: '1' },
              { level: 2, label: '5+' },
              { level: 3, label: '20+' },
              { level: 4, label: '100+' },
            ].map(l => (
              <div key={l.level} className="heatmap-legend-item" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span
                  className="heatmap-cell"
                  style={{
                    background: l.level === 0
                      ? 'var(--bg-elevated)'
                      : l.level === 1 ? 'rgba(122, 162, 247, 0.2)'
                      : l.level === 2 ? 'rgba(122, 162, 247, 0.4)'
                      : l.level === 3 ? 'rgba(122, 162, 247, 0.6)'
                      : 'var(--accent)',
                  }}
                />
                <span style={{ fontSize: '10px', color: 'var(--fg-dim)' }}>{l.label}</span>
              </div>
            ))}
          </div>

          {/* Month labels + grid */}
          <div className="heatmap-grid-wrap">
            {/* Month labels row */}
            <div className="heatmap-months">
              {(() => {
                const months: { label: string; left: number }[] = [];
                let lastMonth = -1;
                for (let i = 0; i < weeks.length; i++) {
                  const week = weeks[i];
                  if (week.length === 0) continue;
                  const firstDate = week[0].date;
                  const monthIdx = new Date(firstDate).getMonth();
                  if (monthIdx !== lastMonth) {
                    months.push({ label: new Date(firstDate).toLocaleString('en-US', { month: 'short' }), left: (i / 53) * 100 });
                    lastMonth = monthIdx;
                  }
                }
                return months.map(m => (
                  <span
                    key={m.label + m.left}
                    style={{
                      position: 'absolute',
                      left: `${m.left}%`,
                      top: 0,
                      fontSize: '9px',
                      color: 'var(--fg-dim)',
                      transform: 'translateX(2px)',
                    }}
                  >
                    {m.label}
                  </span>
                ));
              })()}
            </div>

            {/* Week rows */}
            <div className="heatmap-grid">
              {weeks.map((week, wi) => (
                <div key={wi} className="heatmap-week">
                  {/* Day label */}
                  <div className="heatmap-week-label" style={{ width: '20px', flexShrink: 0 }}>
                    {WEEKDAYS[wi % 7]}
                  </div>
                  <div className="heatmap-cells">
                    {week.map(cell => (
                      <div
                        key={cell.date}
                        className="heatmap-cell"
                        style={{
                          background: cell.level === 0
                            ? 'var(--bg-elevated)'
                            : cell.level === 1 ? 'rgba(122, 162, 247, 0.2)'
                            : cell.level === 2 ? 'rgba(122, 162, 247, 0.4)'
                            : cell.level === 3 ? 'rgba(122, 162, 247, 0.6)'
                            : 'var(--accent)',
                          outline: cell.date === today ? `1px solid var(--accent)` : 'none',
                        }}
                        title={`${cell.date}${cell.completed ? ` (${cell.count})` : ''}`}
                      />
                    ))}
                    {/* Fill remaining cells in last week */}
                    {week.length < 7 && (
                      Array.from({ length: 7 - week.length }).map((_, i) => (
                        <div key={`empty-${wi}-${i}`} className="heatmap-cell" style={{ background: 'var(--bg-elevated)', opacity: 0.2 }} />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="heatmap-stats">
            <span style={{ fontSize: '11px', color: 'var(--fg-dim)' }}>
              {cells.filter(c => c.completed).length} of {DAYS_SHOWN} days tracked
              {' · '}
              best streak: {streak?.longest ?? 0} days
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
