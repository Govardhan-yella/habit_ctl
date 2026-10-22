import { Habit, Routine, Completion, Shield, Theme } from '../../types';
import { SNAPSHOT_VERSION, SyncSnapshot, SyncTombstone, SyncEntityType } from './types';

/** An empty snapshot — the starting point for a fresh device. */
export function emptySnapshot(deviceId = 'unknown'): SyncSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    deviceId,
    habits: [],
    routines: [],
    completions: [],
    shields: [],
    themes: [],
    tombstones: [],
  };
}

/** Parse a timestamp into a comparable number. Missing/invalid values sort oldest. */
function ts(value: string | undefined): number {
  if (!value) return 0;
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

/** Timestamp used to decide which copy of an entity wins. */
function entityTime(e: { updatedAt?: string; createdAt?: string }): number {
  return Math.max(ts(e.updatedAt), ts(e.createdAt));
}

/** Key for a completion: the same habit on the same day is the same fact. */
export function completionKey(c: Pick<Completion, 'habitId' | 'date'>): string {
  return `${c.habitId}|${c.date}`;
}

/** Key for a tombstone. */
function tombKey(t: SyncTombstone): string {
  return `${t.type}|${t.id}`;
}

/** Union of both tombstone lists, keeping the newest deletion time per entity. */
export function mergeTombstones(a: SyncTombstone[], b: SyncTombstone[]): SyncTombstone[] {
  const map = new Map<string, SyncTombstone>();
  for (const t of [...(a || []), ...(b || [])]) {
    if (!t || !t.type || !t.id) continue;
    const k = tombKey(t);
    const prev = map.get(k);
    if (!prev || ts(t.deletedAt) > ts(prev.deletedAt)) map.set(k, t);
  }
  return [...map.values()].sort((x, y) => ts(x.deletedAt) - ts(y.deletedAt));
}

/**
 * Pick the winning copy of one entity and decide whether a tombstone kills it.
 * Returns null when the entity was deleted.
 */
function resolve<T extends { id: string; updatedAt?: string; createdAt?: string }>(
  local: T | undefined,
  remote: T | undefined,
  tombstones: Map<string, SyncTombstone>,
  type: SyncEntityType,
  key: string,
  prefer?: (a: T, b: T) => T
): { winner: T | null; changed: boolean } {
  const tomb = tombstones.get(`${type}|${key}`);
  if (!local && !remote) return { winner: null, changed: false };

  let winner: T;
  if (!local) winner = remote!;
  else if (!remote) winner = local;
  else if (prefer) winner = prefer(local, remote);
  else winner = entityTime(remote) > entityTime(local) ? remote : local;

  if (tomb && ts(tomb.deletedAt) >= entityTime(winner)) {
    // Deleted on at least one device after the surviving copy was last written.
    const changed = !!local;
    return { winner: null, changed };
  }

  // "Changed" means the merged result differs from what we already had locally.
  const changed = !local || winner !== local;
  return { winner, changed };
}

/** A used shield must never come back as unused. */
function preferShield(a: Shield, b: Shield): Shield {
  if (!!a.usedAt !== !!b.usedAt) return a.usedAt ? a : b;
  return ts(b.earnedAt) > ts(a.earnedAt) ? b : a;
}

/** For counters, when both sides changed at the same time keep the larger value. */
function preferCompletion(a: Completion, b: Completion): Completion {
  const ta = ts(a.updatedAt) || ts(a.createdAt);
  const tb = ts(b.updatedAt) || ts(b.createdAt);
  if (tb !== ta) return tb > ta ? b : a;
  return b.value > a.value ? b : a;
}

/** Counts of what changed, used to show a useful summary after a sync. */
export interface MergeStats {
  habits: number;
  routines: number;
  completions: number;
  shields: number;
  themes: number;
  tombstones: number;
}

/** Map an entity kind to its counter in MergeStats. */
const STAT_KEY: Record<SyncEntityType, keyof MergeStats> = {
  habit: 'habits',
  routine: 'routines',
  completion: 'completions',
  shield: 'shields',
  theme: 'themes',
};

export interface MergeResult {
  snapshot: SyncSnapshot;
  stats: MergeStats;
}

/**
 * Merge two snapshots into one.
 *
 * Rules:
 *  - Habits, routines and themes: last write wins, compared by `updatedAt`.
 *  - Completions: keyed by habit + date, so two devices logging the same
 *    habit on the same day collapse into one record (highest value wins on ties).
 *  - Shields: a used shield beats an unused one.
 *  - Tombstones: a delete wins over any copy that was not written afterwards.
 */
export function mergeSnapshots(local: SyncSnapshot, remote: SyncSnapshot): MergeResult {
  const tombList = mergeTombstones(local.tombstones || [], remote.tombstones || []);
  const tombstones = new Map<string, SyncTombstone>(tombList.map(t => [tombKey(t), t]));

  const stats: MergeStats = { habits: 0, routines: 0, completions: 0, shields: 0, themes: 0, tombstones: tombList.length };

  // --- habits / routines / themes: keyed by id ---
  function mergeById<T extends { id: string; updatedAt?: string; createdAt?: string }>(
    localList: T[],
    remoteList: T[],
    type: SyncEntityType
  ): T[] {
    const remoteById = new Map((remoteList || []).map(x => [x.id, x]));
    const out: T[] = [];
    const seen = new Set<string>();
    const statKey = STAT_KEY[type];
    for (const l of localList || []) {
      const r = remoteById.get(l.id);
      const res = resolve(l, r, tombstones, type, l.id);
      if (res.changed) stats[statKey]++;
      seen.add(l.id);
      if (res.winner) out.push(res.winner);
    }
    for (const r of remoteList || []) {
      if (seen.has(r.id)) continue;
      const res = resolve(undefined, r, tombstones, type, r.id);
      if (res.changed) stats[statKey]++;
      if (res.winner) out.push(res.winner);
    }
    return out;
  }

  const habits = mergeById<Habit>(local.habits, remote.habits, 'habit');
  const routines = mergeById<Routine>(local.routines, remote.routines, 'routine');
  const themes = mergeById<Theme>(local.themes, remote.themes, 'theme');

  // --- shields: keyed by id, used shields win ---
  const shields: Shield[] = [];
  {
    const remoteById = new Map((remote.shields || []).map(x => [x.id, x]));
    const seen = new Set<string>();
    for (const l of local.shields || []) {
      const r = remoteById.get(l.id);
      const res = resolve(l, r, tombstones, 'shield', l.id, preferShield);
      if (res.changed) stats.shields++;
      seen.add(l.id);
      if (res.winner) shields.push(res.winner);
    }
    for (const r of remote.shields || []) {
      if (seen.has(r.id)) continue;
      const res = resolve(undefined, r, tombstones, 'shield', r.id, preferShield);
      if (res.changed) stats.shields++;
      if (res.winner) shields.push(res.winner);
    }
  }

  // --- completions: keyed by habit + date ---
  const completions: Completion[] = [];
  {
    const remoteByKey = new Map((remote.completions || []).map(x => [completionKey(x), x]));
    const seen = new Set<string>();
    for (const l of local.completions || []) {
      const key = completionKey(l);
      const r = remoteByKey.get(key);
      const res = resolve(l, r, tombstones, 'completion', key, preferCompletion);
      if (res.changed) stats.completions++;
      seen.add(key);
      if (res.winner) completions.push(res.winner);
    }
    for (const r of remote.completions || []) {
      const key = completionKey(r);
      if (seen.has(key)) continue;
      const res = resolve(undefined, r, tombstones, 'completion', key, preferCompletion);
      if (res.changed) stats.completions++;
      if (res.winner) completions.push(res.winner);
    }
  }

  const snapshot: SyncSnapshot = {
    version: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    deviceId: local.deviceId || remote.deviceId || 'unknown',
    habits, routines, completions, shields, themes,
    tombstones: tombList,
  };

  return { snapshot, stats };
}

/** True when a tombstone says the entity was deleted after `time`. */
export function isDeleted(tombstones: SyncTombstone[], type: SyncEntityType, id: string, time: number): boolean {
  const t = tombstones.find(x => x.type === type && x.id === id);
  return !!t && ts(t.deletedAt) >= time;
}
