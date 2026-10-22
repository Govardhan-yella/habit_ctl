import { Habit, Routine, Completion, Shield, Theme } from '../../types';

/** Version of the snapshot format. Bump when the shape changes incompatibly. */
export const SNAPSHOT_VERSION = 1;

/** Entity kinds that can be tombstoned (deleted) and propagated to other devices. */
export type SyncEntityType = 'habit' | 'routine' | 'completion' | 'shield' | 'theme';

/**
 * A record that an entity was deleted. Tombstones are merged across devices so
 * a delete on one phone eventually removes the item everywhere.
 */
export interface SyncTombstone {
  type: SyncEntityType;
  /** Entity id (for completions: `${habitId}|${date}`). */
  id: string;
  deletedAt: string;
}

/** A full, portable snapshot of everything worth syncing. */
export interface SyncSnapshot {
  version: number;
  exportedAt: string;
  /** Stable id for the device that produced this snapshot. */
  deviceId: string;
  habits: Habit[];
  routines: Routine[];
  completions: Completion[];
  shields: Shield[];
  /** Custom themes only — built-in themes ship with the app. */
  themes: Theme[];
  tombstones: SyncTombstone[];
}

export type SyncEntityKind = 'habit' | 'routine' | 'completion' | 'shield' | 'theme';

/** Result of checking that a provider is reachable and the credentials work. */
export interface SyncTestResult {
  ok: boolean;
  message: string;
}

/**
 * A place the app can read and write a snapshot. Implementations must be
 * safe to call when the remote does not exist yet (pull returns null).
 */
export interface SyncProvider {
  readonly id: string;
  readonly name: string;
  /** Read the remote snapshot, or null when nothing has been stored yet. */
  pull(): Promise<SyncSnapshot | null>;
  /** Write the snapshot to the remote. */
  push(snapshot: SyncSnapshot): Promise<void>;
  /** Check reachability / credentials without changing any data. */
  test(): Promise<SyncTestResult>;
}
