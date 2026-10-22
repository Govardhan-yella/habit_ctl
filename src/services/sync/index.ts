import { SyncConfig } from '../../types';
import { AppState } from '../../types';
import { SyncSnapshot, SyncProvider, SyncTombstone, SyncEntityType } from './types';
import { emptySnapshot } from './merge';
import { WebDavProvider } from './webdav';
import { FileProvider } from './file';

export * from './types';
export * from './merge';
export { WebDavProvider } from './webdav';
export { FileProvider, supportsFileSystemAccess } from './file';

const DEVICE_ID_KEY = 'hc-device-id';
const TOMBSTONE_KEY = 'hc-tombstones';

/** Stable per-browser id so we can tell which device wrote a snapshot. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() || `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'unknown';
  }
}

/** Tombstones record deletions so they propagate to other devices. */
export function loadTombstones(): SyncTombstone[] {
  try {
    const raw = JSON.parse(localStorage.getItem(TOMBSTONE_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(t => t && t.type && t.id) : [];
  } catch {
    return [];
  }
}

export function saveTombstones(tombstones: SyncTombstone[]): void {
  try { localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(tombstones)); } catch { /* ignore */ }
}

/** Record a deletion. Keeps only the newest entry per entity. */
export function addTombstone(type: SyncEntityType, id: string): void {
  const list = loadTombstones();
  const existing = list.find(t => t.type === type && t.id === id);
  if (existing) { existing.deletedAt = new Date().toISOString(); }
  else list.push({ type, id, deletedAt: new Date().toISOString() });
  saveTombstones(list);
}

/** Build a snapshot of everything worth syncing from the current app state. */
export function snapshotFromState(state: {
  habits: AppState['habits'];
  routines: AppState['routines'];
  completions: AppState['completions'];
  shields: AppState['shields'];
  themes: AppState['themes'];
}): SyncSnapshot {
  return {
    ...emptySnapshot(deviceId()),
    habits: state.habits || [],
    routines: state.routines || [],
    completions: state.completions || [],
    shields: state.shields || [],
    // Only custom themes are worth syncing — built-ins ship with the app.
    themes: (state.themes || []).filter(t => t.isCustom),
    tombstones: loadTombstones(),
  };
}

export const DEFAULT_SNAPSHOT_FILE = 'habit_ctl.json';

/**
 * Build the provider described by the user's sync settings.
 * Returns null when nothing is configured or the provider is unavailable.
 */
export function createProvider(cfg: SyncConfig | undefined, fileHandle: unknown = null): SyncProvider | null {
  if (!cfg) return null;
  const fileName = cfg.fileName || DEFAULT_SNAPSHOT_FILE;
  switch (cfg.provider) {
    case 'webdav':
      if (!cfg.webdavUrl) return null;
      return new WebDavProvider({
        url: cfg.webdavUrl,
        user: cfg.webdavUser,
        password: cfg.webdavPassword,
        path: cfg.webdavPath,
        fileName,
      });
    case 'file':
      return new FileProvider({ fileName }, fileHandle as never);
    default:
      return null;
  }
}
