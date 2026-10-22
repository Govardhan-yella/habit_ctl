import { describe, it, expect } from 'vitest';
import { mergeSnapshots, mergeTombstones, emptySnapshot, completionKey } from './merge';
import { SyncSnapshot, SyncTombstone } from './types';
import { Habit, Completion } from '../../types';

function habit(id: string, updatedAt: string, name = id): Habit {
  return {
    id, name, icon: 'tabler:run', color: '#7aa2f7', mode: 'checkbox', target: 1,
    schedule: { type: 'daily' }, reminders: [], createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt, order: 0,
  };
}

function completion(habitId: string, date: string, value: number, updatedAt: string): Completion {
  return { id: `${habitId}-${date}`, habitId, date, value, createdAt: updatedAt, updatedAt, synced: false };
}

function snap(partial: Partial<SyncSnapshot> = {}): SyncSnapshot {
  return { ...emptySnapshot('device-a'), ...partial };
}

describe('completionKey', () => {
  it('keys a completion by habit and date', () => {
    expect(completionKey({ habitId: 'h1', date: '2024-05-01' })).toBe('h1|2024-05-01');
  });
});

describe('mergeTombstones', () => {
  it('keeps the newest deletion per entity', () => {
    const older: SyncTombstone = { type: 'habit', id: 'h1', deletedAt: '2024-01-01T00:00:00.000Z' };
    const newer: SyncTombstone = { type: 'habit', id: 'h1', deletedAt: '2024-06-01T00:00:00.000Z' };
    const merged = mergeTombstones([older], [newer]);
    expect(merged).toHaveLength(1);
    expect(merged[0].deletedAt).toBe(newer.deletedAt);
  });

  it('keeps tombstones for different entities', () => {
    const merged = mergeTombstones(
      [{ type: 'habit', id: 'h1', deletedAt: '2024-01-01T00:00:00.000Z' }],
      [{ type: 'routine', id: 'r1', deletedAt: '2024-01-01T00:00:00.000Z' }],
    );
    expect(merged).toHaveLength(2);
  });

  it('ignores malformed entries', () => {
    expect(mergeTombstones([null as any, { type: 'habit' } as any], [])).toHaveLength(0);
  });
});

describe('mergeSnapshots', () => {
  it('takes the newer copy of a habit', () => {
    const local = snap({ habits: [habit('h1', '2024-01-01T00:00:00.000Z', 'old')] });
    const remote = snap({ habits: [habit('h1', '2024-09-01T00:00:00.000Z', 'new')] });
    const { snapshot, stats } = mergeSnapshots(local, remote);
    expect(snapshot.habits).toHaveLength(1);
    expect(snapshot.habits[0].name).toBe('new');
    expect(stats.habits).toBe(1);
  });

  it('keeps the local copy when it is newer', () => {
    const local = snap({ habits: [habit('h1', '2024-09-01T00:00:00.000Z', 'new')] });
    const remote = snap({ habits: [habit('h1', '2024-01-01T00:00:00.000Z', 'old')] });
    const { snapshot, stats } = mergeSnapshots(local, remote);
    expect(snapshot.habits[0].name).toBe('new');
    expect(stats.habits).toBe(0);
  });

  it('unions habits from both sides', () => {
    const local = snap({ habits: [habit('h1', '2024-01-01T00:00:00.000Z')] });
    const remote = snap({ habits: [habit('h2', '2024-01-01T00:00:00.000Z')] });
    const { snapshot } = mergeSnapshots(local, remote);
    expect(snapshot.habits.map(h => h.id).sort()).toEqual(['h1', 'h2']);
  });

  it('drops a habit that a tombstone deleted after the last write', () => {
    const local = snap({ habits: [habit('h1', '2024-01-01T00:00:00.000Z')] });
    const remote = snap({ tombstones: [{ type: 'habit', id: 'h1', deletedAt: '2024-05-01T00:00:00.000Z' }] });
    const { snapshot, stats } = mergeSnapshots(local, remote);
    expect(snapshot.habits).toHaveLength(0);
    expect(stats.habits).toBe(1);
  });

  it('keeps a habit that was edited after the deletion', () => {
    const local = snap({ habits: [habit('h1', '2024-09-01T00:00:00.000Z', 'edited')] });
    const remote = snap({ tombstones: [{ type: 'habit', id: 'h1', deletedAt: '2024-05-01T00:00:00.000Z' }] });
    const { snapshot } = mergeSnapshots(local, remote);
    expect(snapshot.habits).toHaveLength(1);
    expect(snapshot.habits[0].name).toBe('edited');
  });

  it('collapses two completions of the same habit and date into one', () => {
    const local = snap({ completions: [completion('h1', '2024-05-01', 1, '2024-05-01T10:00:00.000Z')] });
    const remote = snap({ completions: [completion('h1', '2024-05-01', 3, '2024-05-01T12:00:00.000Z')] });
    const { snapshot } = mergeSnapshots(local, remote);
    expect(snapshot.completions).toHaveLength(1);
    expect(snapshot.completions[0].value).toBe(3);
  });

  it('keeps the higher counter value when both sides changed at the same time', () => {
    const local = snap({ completions: [completion('h1', '2024-05-01', 2, '2024-05-01T10:00:00.000Z')] });
    const remote = snap({ completions: [completion('h1', '2024-05-01', 5, '2024-05-01T10:00:00.000Z')] });
    const { snapshot } = mergeSnapshots(local, remote);
    expect(snapshot.completions[0].value).toBe(5);
  });

  it('keeps completions for different days apart', () => {
    const local = snap({ completions: [completion('h1', '2024-05-01', 1, '2024-05-01T10:00:00.000Z')] });
    const remote = snap({ completions: [completion('h1', '2024-05-02', 1, '2024-05-02T10:00:00.000Z')] });
    const { snapshot } = mergeSnapshots(local, remote);
    expect(snapshot.completions).toHaveLength(2);
  });

  it('removes a completion deleted on the other device', () => {
    const local = snap({ completions: [completion('h1', '2024-05-01', 1, '2024-05-01T10:00:00.000Z')] });
    const remote = snap({ tombstones: [{ type: 'completion', id: 'h1|2024-05-01', deletedAt: '2024-05-02T00:00:00.000Z' }] });
    const { snapshot } = mergeSnapshots(local, remote);
    expect(snapshot.completions).toHaveLength(0);
  });

  it('never resurrects a used shield as unused', () => {
    const local = snap({ shields: [{ id: 's1', habitId: 'h1', earnedAt: '2024-01-01T00:00:00.000Z', source: 'streak' as const }] });
    const remote = snap({ shields: [{ id: 's1', habitId: 'h1', earnedAt: '2024-01-01T00:00:00.000Z', usedAt: '2024-02-01T00:00:00.000Z', source: 'streak' as const }] });
    const { snapshot } = mergeSnapshots(local, remote);
    expect(snapshot.shields).toHaveLength(1);
    expect(snapshot.shields[0].usedAt).toBe('2024-02-01T00:00:00.000Z');
  });

  it('keeps the used shield when the local copy is the used one', () => {
    const local = snap({ shields: [{ id: 's1', habitId: 'h1', earnedAt: '2024-01-01T00:00:00.000Z', usedAt: '2024-02-01T00:00:00.000Z', source: 'streak' as const }] });
    const remote = snap({ shields: [{ id: 's1', habitId: 'h1', earnedAt: '2024-01-01T00:00:00.000Z', source: 'streak' as const }] });
    const { snapshot } = mergeSnapshots(local, remote);
    expect(snapshot.shields[0].usedAt).toBe('2024-02-01T00:00:00.000Z');
  });

  it('merges routines and custom themes the same way as habits', () => {
    const local = snap({
      routines: [{ id: 'r1', name: 'old', icon: '☀', color: '#fff', schedule: { type: 'daily' }, habitIds: [], createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z', order: 0 }],
      themes: [{ id: 't1', name: 'Mine', colors: {} as any, isCustom: true, isPro: false, createdAt: '2024-01-01T00:00:00.000Z' }],
    });
    const remote = snap({
      routines: [{ id: 'r1', name: 'new', icon: '☀', color: '#fff', schedule: { type: 'daily' }, habitIds: [], createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-09-01T00:00:00.000Z', order: 0 }],
      themes: [{ id: 't2', name: 'Other', colors: {} as any, isCustom: true, isPro: false, createdAt: '2024-02-01T00:00:00.000Z' }],
    });
    const { snapshot } = mergeSnapshots(local, remote);
    expect(snapshot.routines[0].name).toBe('new');
    expect(snapshot.themes.map(t => t.id).sort()).toEqual(['t1', 't2']);
  });

  it('reports the snapshot version and keeps the local device id', () => {
    const { snapshot } = mergeSnapshots(snap(), snap());
    expect(snapshot.version).toBe(1);
    expect(snapshot.deviceId).toBe('device-a');
  });
});
