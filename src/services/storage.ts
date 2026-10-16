import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Habit, Completion, Shield, Routine, Theme, User, UserSettings, SyncState } from '../types';

interface InitHabitsDB extends DBSchema {
  habits: { key: string; value: Habit; indexes: { 'by-routine': string; 'by-order': number } };
  completions: { key: string; value: Completion; indexes: { 'by-habit': string; 'by-date': string } };
  shields: { key: string; value: Shield; indexes: { 'by-habit': string } };
  routines: { key: string; value: Routine; indexes: { 'by-order': number } };
  themes: { key: string; value: Theme };
  user: { key: string; value: User };
  settings: { key: string; value: UserSettings };
  sync: { key: string; value: SyncState & { id: string } };
  pendingChanges: { key: string; value: { id: string; type: string; action: string; data: unknown; timestamp: string; retries: number }; indexes: { 'by-timestamp': string } };
}

let dbInstance: IDBPDatabase<InitHabitsDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<InitHabitsDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<InitHabitsDB>('init-habits', 1, {
    upgrade(db) {
      const h = db.createObjectStore('habits', { keyPath: 'id' });
      h.createIndex('by-routine', 'routineId');
      h.createIndex('by-order', 'order');
      const c = db.createObjectStore('completions', { keyPath: 'id' });
      c.createIndex('by-habit', 'habitId');
      c.createIndex('by-date', 'date');
      const s = db.createObjectStore('shields', { keyPath: 'id' });
      s.createIndex('by-habit', 'habitId');
      const r = db.createObjectStore('routines', { keyPath: 'id' });
      r.createIndex('by-order', 'order');
      db.createObjectStore('themes', { keyPath: 'id' });
      db.createObjectStore('user', { keyPath: 'id' });
      db.createObjectStore('settings', { keyPath: 'id' });
      db.createObjectStore('sync', { keyPath: 'id' });
      const p = db.createObjectStore('pendingChanges', { keyPath: 'id' });
      p.createIndex('by-timestamp', 'timestamp');
    }
  });
  return dbInstance;
}

export async function saveHabit(habit: Habit): Promise<void> { const db = await getDB(); await db.put('habits', habit); }
export async function getHabit(id: string): Promise<Habit | undefined> { const db = await getDB(); return db.get('habits', id); }
export async function getAllHabits(): Promise<Habit[]> { const db = await getDB(); return db.getAllFromIndex('habits', 'by-order'); }
export async function getHabitsByRoutine(routineId: string): Promise<Habit[]> { const db = await getDB(); return db.getAllFromIndex('habits', 'by-routine', routineId); }
export async function deleteHabit(id: string): Promise<void> { const db = await getDB(); await db.delete('habits', id); }

export async function saveCompletion(completion: Completion): Promise<void> { const db = await getDB(); await db.put('completions', completion); }
export async function getCompletion(id: string): Promise<Completion | undefined> { const db = await getDB(); return db.get('completions', id); }
export async function getCompletionsByHabit(habitId: string): Promise<Completion[]> { const db = await getDB(); return db.getAllFromIndex('completions', 'by-habit', habitId); }
export async function getCompletionsByDate(date: string): Promise<Completion[]> { const db = await getDB(); return db.getAllFromIndex('completions', 'by-date', date); }
export async function getAllCompletions(): Promise<Completion[]> { const db = await getDB(); return db.getAll('completions'); }
export async function getUnsyncedCompletions(): Promise<Completion[]> { const db = await getDB(); const all = await db.getAll('completions'); return all.filter(c => !c.synced); }
export async function deleteCompletion(id: string): Promise<void> { const db = await getDB(); await db.delete('completions', id); }

export async function saveShield(shield: Shield): Promise<void> { const db = await getDB(); await db.put('shields', shield); }
export async function getShieldsByHabit(habitId: string): Promise<Shield[]> { const db = await getDB(); return db.getAllFromIndex('shields', 'by-habit', habitId); }
export async function getAllShields(): Promise<Shield[]> { const db = await getDB(); return db.getAll('shields'); }
export async function deleteShield(id: string): Promise<void> { const db = await getDB(); await db.delete('shields', id); }

export async function saveRoutine(routine: Routine): Promise<void> { const db = await getDB(); await db.put('routines', routine); }
export async function getRoutine(id: string): Promise<Routine | undefined> { const db = await getDB(); return db.get('routines', id); }
export async function getAllRoutines(): Promise<Routine[]> { const db = await getDB(); return db.getAllFromIndex('routines', 'by-order'); }
export async function deleteRoutine(id: string): Promise<void> { const db = await getDB(); await db.delete('routines', id); }

export async function saveTheme(theme: Theme): Promise<void> { const db = await getDB(); await db.put('themes', theme); }
export async function getTheme(id: string): Promise<Theme | undefined> { const db = await getDB(); return db.get('themes', id); }
export async function getAllThemes(): Promise<Theme[]> { const db = await getDB(); return db.getAll('themes'); }
export async function deleteTheme(id: string): Promise<void> { const db = await getDB(); await db.delete('themes', id); }

export async function saveUser(user: User): Promise<void> { const db = await getDB(); await db.put('user', user); }
export async function getUser(): Promise<User | undefined> { const db = await getDB(); const users = await db.getAll('user'); return users[0]; }
export async function deleteUser(): Promise<void> { const db = await getDB(); await db.clear('user'); }

export async function saveSettings(settings: UserSettings): Promise<void> { const db = await getDB(); await db.put('settings', settings); }
export async function getSettings(): Promise<UserSettings | undefined> { const db = await getDB(); const settings = await db.getAll('settings'); return settings[0]; }

export async function saveSyncState(sync: SyncState): Promise<void> { const db = await getDB(); await db.put('sync', { id: 'main', ...sync }); }
export async function getSyncState(): Promise<SyncState | undefined> { const db = await getDB(); return db.get('sync', 'main'); }

export async function addPendingChange(type: string, action: string, data: unknown): Promise<void> {
  const db = await getDB();
  await db.put('pendingChanges', { id: crypto.randomUUID(), type, action, data, timestamp: new Date().toISOString(), retries: 0 });
}
export async function getPendingChanges(): Promise<any[]> { const db = await getDB(); return db.getAllFromIndex('pendingChanges', 'by-timestamp'); }
export async function removePendingChange(id: string): Promise<void> { const db = await getDB(); await db.delete('pendingChanges', id); }
export async function updatePendingChangeRetries(id: string, retries: number): Promise<void> {
  const db = await getDB(); const change = await db.get('pendingChanges', id);
  if (change) { change.retries = retries; await db.put('pendingChanges', change); }
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const stores = ['habits','completions','shields','routines','themes','user','settings','sync','pendingChanges'] as const;
  await Promise.all(stores.map(s => db.clear(s)));
}

export async function exportAllData(): Promise<string> {
  const db = await getDB();
  const data = { habits: await db.getAll('habits'), completions: await db.getAll('completions'), shields: await db.getAll('shields'), routines: await db.getAll('routines'), themes: await db.getAll('themes'), user: await db.getAll('user'), settings: await db.getAll('settings'), sync: await db.getAll('sync'), exportedAt: new Date().toISOString() };
  return JSON.stringify(data, null, 2);
}

export async function importAllData(json: string): Promise<void> {
  const data = JSON.parse(json);
  const db = await getDB();
  const tx = db.transaction(['habits','completions','shields','routines','themes','user','settings','sync'], 'readwrite');
  if (data.habits) for (const h of data.habits) await tx.objectStore('habits').put(h);
  if (data.completions) for (const c of data.completions) await tx.objectStore('completions').put(c);
  if (data.shields) for (const s of data.shields) await tx.objectStore('shields').put(s);
  if (data.routines) for (const r of data.routines) await tx.objectStore('routines').put(r);
  if (data.themes) for (const t of data.themes) await tx.objectStore('themes').put(t);
  if (data.user) for (const u of data.user) await tx.objectStore('user').put(u);
  if (data.settings) for (const s of data.settings) await tx.objectStore('settings').put(s);
  if (data.sync) for (const s of data.sync) await tx.objectStore('sync').put(s);
  await tx.done;
}