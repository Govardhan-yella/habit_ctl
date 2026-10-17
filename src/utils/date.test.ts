import { describe, it, expect } from 'vitest';
import {
  formatDate,
  parseDate,
  getDateString,
  addDays,
  subDays,
  isSameDay,
  getWeekStart,
  getWeekEnd,
  getDaysBetween,
  getHeatmapLevel,
  getStreakData,
} from './date';

describe('formatDate', () => {
  const d = new Date(2024, 2, 5); // 5 Mar 2024

  it('formats ISO by default', () => {
    expect(formatDate(d)).toBe('2024-03-05');
  });
  it('formats DD/MM/YYYY', () => {
    expect(formatDate(d, 'DD/MM/YYYY')).toBe('05/03/2024');
  });
  it('formats MM/DD/YYYY', () => {
    expect(formatDate(d, 'MM/DD/YYYY')).toBe('03/05/2024');
  });
  it('pads single-digit months and days', () => {
    expect(formatDate(new Date(2024, 0, 9))).toBe('2024-01-09');
  });
});

describe('parseDate', () => {
  it('round-trips with getDateString', () => {
    const d = parseDate('2024-03-15');
    expect(isSameDay(d, new Date(2024, 2, 15))).toBe(true);
    expect(getDateString(d)).toBe('2024-03-15');
  });
});

describe('addDays / subDays', () => {
  it('adds across month boundaries', () => {
    expect(getDateString(addDays(new Date(2024, 0, 31), 1))).toBe('2024-02-01');
  });
  it('handles leap years', () => {
    expect(getDateString(addDays(new Date(2024, 1, 28), 1))).toBe('2024-02-29');
  });
  it('subDays is the inverse of addDays', () => {
    const d = new Date(2024, 5, 15);
    expect(isSameDay(subDays(addDays(d, 10), 10), d)).toBe(true);
  });
  it('does not mutate the input date', () => {
    const d = new Date(2024, 2, 5);
    addDays(d, 10);
    expect(getDateString(d)).toBe('2024-03-05');
  });
});

describe('getWeekStart / getWeekEnd', () => {
  // 15 Mar 2024 is a Friday
  const fri = new Date(2024, 2, 15);

  it('starts on Sunday by default', () => {
    expect(getDateString(getWeekStart(fri))).toBe('2024-03-10');
  });
  it('supports Monday start', () => {
    expect(getDateString(getWeekStart(fri, 1))).toBe('2024-03-11');
  });
  it('week end is start + 6 days', () => {
    expect(getDateString(getWeekEnd(fri))).toBe('2024-03-16');
    expect(getDateString(getWeekEnd(fri, 1))).toBe('2024-03-17');
  });
  it('returns the same day when already the week start', () => {
    expect(getDateString(getWeekStart(new Date(2024, 2, 10)))).toBe('2024-03-10');
  });
});

describe('getDaysBetween', () => {
  it('counts whole days', () => {
    expect(getDaysBetween(new Date(2024, 2, 10), new Date(2024, 2, 15))).toBe(5);
  });
  it('is order-sensitive and ignores time of day', () => {
    expect(getDaysBetween(new Date(2024, 2, 15, 23), new Date(2024, 2, 16, 1))).toBe(1);
  });
});

describe('getHeatmapLevel', () => {
  it('returns 0 for no completions', () => {
    expect(getHeatmapLevel(0, 10)).toBe(0);
  });
  it('scales across quartiles', () => {
    expect(getHeatmapLevel(1, 10)).toBe(1);
    expect(getHeatmapLevel(3, 10)).toBe(2);
    expect(getHeatmapLevel(6, 10)).toBe(3);
    expect(getHeatmapLevel(8, 10)).toBe(4);
  });
});

describe('getStreakData', () => {
  const daily = { schedule: { type: 'daily' } };
  const today = new Date();

  it('handles no completions', () => {
    const r = getStreakData(new Map(), daily, []);
    expect(r).toMatchObject({ current: 0, longest: 0, total: 0 });
    expect(r.isActive).toBe(false);
  });

  it('counts an unbroken run ending today', () => {
    const m = new Map<string, number>();
    for (let i = 0; i < 3; i++) m.set(getDateString(subDays(today, i)), 1);
    const r = getStreakData(m, daily, []);
    expect(r.current).toBe(3);
    expect(r.total).toBe(3);
    expect(r.isActive).toBe(true);
  });

  it('does not break the streak when today is scheduled but not yet done', () => {
    const m = new Map<string, number>();
    m.set(getDateString(subDays(today, 1)), 1);
    m.set(getDateString(subDays(today, 2)), 1);
    const r = getStreakData(m, daily, []);
    expect(r.current).toBe(2);
  });

  it('breaks the streak on a missed day', () => {
    const m = new Map<string, number>();
    m.set(getDateString(today), 1);
    m.set(getDateString(subDays(today, 2)), 1); // gap yesterday
    const r = getStreakData(m, daily, []);
    expect(r.current).toBe(1);
  });

  it('reports the longest historical run', () => {
    const m = new Map<string, number>();
    // a 4-day run well in the past, then a 1-day run today
    for (let i = 20; i < 24; i++) m.set(getDateString(subDays(today, i)), 1);
    m.set(getDateString(today), 1);
    const r = getStreakData(m, daily, []);
    expect(r.longest).toBeGreaterThanOrEqual(4);
    expect(r.current).toBe(1);
  });

  it('counts only unused shields', () => {
    const r = getStreakData(new Map(), daily, [{}, { usedAt: 'x' }, {}]);
    expect(r.shields).toBe(2);
  });

  it('ignores completions with a zero value', () => {
    const m = new Map<string, number>([['2024-01-01', 0]]);
    const r = getStreakData(m, daily, []);
    expect(r.total).toBe(0);
  });
});
