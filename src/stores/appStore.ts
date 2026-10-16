import { Habit, Completion, Shield, Routine, Theme, User, UserSettings, SyncState, AppState, HabitMode } from '../types';
import { THEMES, DEFAULT_THEME_ID, getTheme } from '../data/themes';
import { getTodayString, getDateString, addDays, subDays, getDaysBetween, getStreakData, getHeatmapLevel } from '../utils/date';
import { saveHabit, getAllHabits, deleteHabit, saveCompletion, getCompletionsByHabit, getAllCompletions, getUnsyncedCompletions, deleteCompletion, saveShield, getShieldsByHabit, getAllShields, saveRoutine, getAllRoutines, deleteRoutine, saveTheme, getAllThemes, deleteTheme, saveUser, getUser, saveSettings, getSettings, saveSyncState, getSyncState, addPendingChange, getPendingChanges, removePendingChange, updatePendingChangeRetries, clearAllData as clearAllDataStorage, exportAllData, importAllData } from '../services/storage';
import { appwrite } from '../services/appwrite';

type Listener = (state: AppState) => void;

class AppStore {
  private state: AppState = { user: null, habits: [], routines: [], completions: [], shields: [], themes: THEMES, theme: THEMES[0], sync: { status: 'idle', pendingChanges: 0 }, view: 'list', selectedDate: getTodayString(), searchQuery: '', filterMode: 'active' };
  private listeners: Set<Listener> = new Set(); private initialized = false; private ready = false;
  private settings: UserSettings = { themeId: DEFAULT_THEME_ID, syncEnabled: true, iCloudSync: false, animations: true, hapticFeedback: true, weekStartsOn: 0, dateFormat: 'YYYY-MM-DD', timeFormat: '24h', language: 'en', passcodeEnabled: false, biometricEnabled: false, vacationMode: false };

  constructor() { this.applyTheme(this.state.theme); }

  subscribe(listener: Listener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(): void { this.listeners.forEach(l => l(this.state)); }
  private setState(partial: Partial<AppState>): void { this.state = { ...this.state, ...partial }; this.notify(); }
  getState(): AppState { return this.state; }

  async initialize(): Promise<void> {
    if (this.initialized) return; this.initialized = true;
    try { await this.loadFromStorage(); await this.initAppwrite(); this.setState({ sync: { ...this.state.sync, status: 'idle' } }); } catch (e) { this.setState({ sync: { ...this.state.sync, status: 'error', error: String(e) } }); }
    this.ready = true; this.notify();
  }

  isReady(): boolean { return this.ready; }

  private async loadFromStorage(): Promise<void> {
    const [habits, routines, completions, shields, themes, user, settings, sync] = await Promise.all([getAllHabits(), getAllRoutines(), getAllCompletions(), getAllShields(), getAllThemes(), getUser(), getSettings(), getSyncState()]);
    const themeId = settings?.themeId || DEFAULT_THEME_ID;
    this.settings = settings || this.settings;
    this.setState({ habits: habits.sort((a, b) => a.order - b.order), routines: routines.sort((a, b) => a.order - b.order), completions, shields, themes: [...THEMES, ...themes.filter(t => t.isCustom)], theme: getTheme(themeId), user, sync: sync || { status: 'idle', pendingChanges: 0 } });
    this.applyTheme(getTheme(themeId));
  }

  private async initAppwrite(): Promise<void> {
    try { await appwrite.initialize(); appwrite.onConnectionChange(c => { this.setState({ sync: { ...this.state.sync, status: c ? 'idle' : 'offline' } }); if (c) this.syncWithCloud(); }); } catch { this.setState({ sync: { ...this.state.sync, status: 'offline' } }); }
  }

  async syncWithCloud(): Promise<void> {
    if (!this.state.user || this.state.sync.status === 'syncing') return;
    this.setState({ sync: { ...this.state.sync, status: 'syncing' } });
    try {
      const unsynced = await getUnsyncedCompletions();
      for (const c of unsynced) { try { await appwrite.updateCompletion({ ...c, synced: true }); await saveCompletion({ ...c, synced: true }); } catch { await addPendingChange('completion', 'update', c); } }
      const pending = await getPendingChanges();
      for (const ch of pending) { try { await this.processPending(ch); await removePendingChange(ch.id); } catch { await updatePendingChangeRetries(ch.id, ch.retries + 1); } }
      const cloud = await this.fetchCloud(); await this.mergeCloud(cloud);
      this.setState({ sync: { status: 'idle', lastSync: new Date().toISOString(), pendingChanges: pending.length } }); await saveSyncState(this.state.sync);
    } catch (e) { this.setState({ sync: { ...this.state.sync, status: 'error', error: String(e) } }); }
  }

  private async processPending(ch: any): Promise<void> {
    switch (ch.type) {
      case 'habit': if (ch.action === 'delete') await appwrite.deleteHabit((ch.data as Habit).id); else await appwrite.updateHabit(ch.data as Habit); break;
      case 'completion': if (ch.action === 'delete') await appwrite.deleteCompletion((ch.data as Completion).id); else await appwrite.updateCompletion(ch.data as Completion); break;
      case 'routine': if (ch.action === 'delete') await appwrite.deleteRoutine((ch.data as Routine).id); else await appwrite.updateRoutine(ch.data as Routine); break;
    }
  }

  private async fetchCloud(): Promise<any> { return { habits: await appwrite.getHabits(), completions: await appwrite.getCompletions(), shields: await appwrite.getShields(), routines: await appwrite.getRoutines(), themes: await appwrite.getThemes(), user: await appwrite.getCurrentUser() }; }

  private async mergeCloud(c: any): Promise<void> {
    for (const h of c.habits) { const l = this.state.habits.find(x => x.id === h.id); if (!l || new Date(h.updatedAt) > new Date(l.updatedAt)) await saveHabit(h); }
    for (const comp of c.completions) { const l = this.state.completions.find(x => x.id === comp.id); if (!l || new Date(comp.createdAt) > new Date(l.createdAt)) await saveCompletion(comp); }
    for (const s of c.shields) { const l = this.state.shields.find(x => x.id === s.id); if (!l || (s.usedAt && (!l.usedAt || new Date(s.usedAt) > new Date(l.usedAt)))) await saveShield(s); }
    for (const r of c.routines) { const l = this.state.routines.find(x => x.id === r.id); if (!l || new Date(r.updatedAt) > new Date(l.updatedAt)) await saveRoutine(r); }
    for (const t of c.themes) { if (t.isCustom) { const l = this.state.themes.find(x => x.id === t.id); if (!l || new Date(t.createdAt || 0) > new Date(l.createdAt || 0)) await saveTheme(t); } }
    if (c.user) await saveUser(c.user);
    await this.loadFromStorage();
  }

  private applyTheme(theme: Theme): void { const r = document.documentElement, c = theme.colors; r.style.setProperty('--bg', c.bg); r.style.setProperty('--bg-secondary', c.bgSecondary); r.style.setProperty('--fg', c.fg); r.style.setProperty('--fg-muted', c.fgMuted); r.style.setProperty('--accent', c.accent); r.style.setProperty('--accent-muted', c.accentMuted); r.style.setProperty('--border', c.border); r.style.setProperty('--success', c.success); r.style.setProperty('--warning', c.warning); r.style.setProperty('--error', c.error); r.style.setProperty('--heatmap-0', c.heatmap.level0); r.style.setProperty('--heatmap-1', c.heatmap.level1); r.style.setProperty('--heatmap-2', c.heatmap.level2); r.style.setProperty('--heatmap-3', c.heatmap.level3); r.style.setProperty('--heatmap-4', c.heatmap.level4); document.body.className = theme.id; }

  private resolveTheme(id: string): Theme { return this.state.themes.find(t => t.id === id) || getTheme(id); }
  setTheme(id: string): void { const t = this.resolveTheme(id); this.setState({ theme: t }); this.applyTheme(t); void this.persistSetting({ themeId: id }); }
  getSettings(): UserSettings { return this.state.user?.settings || this.settings; }
  /** Persist a settings patch WITHOUT re-entering setTheme (avoids the old infinite loop). */
  private async persistSetting(s: Partial<UserSettings>): Promise<void> { const cur = this.getSettings(); const up = { ...cur, ...s }; this.settings = up; await saveSettings(up); if (this.state.user) this.setState({ user: { ...this.state.user, settings: up } }); else this.notify(); }
  async updateSettings(s: Partial<UserSettings>): Promise<void> { await this.persistSetting(s); if (s.themeId) this.applyTheme(this.resolveTheme(s.themeId)); }
  /** Fire a haptic tick when the setting is enabled and the device supports it. */
  haptic(ms = 12): void { try { if (this.getSettings().hapticFeedback && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms); } catch { /* unsupported */ } }
  defaultSettings(): UserSettings { return { themeId: DEFAULT_THEME_ID, syncEnabled: true, iCloudSync: false, animations: true, hapticFeedback: true, weekStartsOn: 0, dateFormat: 'YYYY-MM-DD', timeFormat: '24h', language: 'en', passcodeEnabled: false, biometricEnabled: false, vacationMode: false }; }

  setView(v: AppState['view']): void { this.setState({ view: v }); }
  setSelectedDate(d: string): void { this.setState({ selectedDate: d }); }
  setSearchQuery(q: string): void { this.setState({ searchQuery: q }); }
  setFilterMode(m: AppState['filterMode']): void { this.setState({ filterMode: m }); }

  getFilteredHabits(): Habit[] { let h = this.state.habits; if (this.state.filterMode === 'active') h = h.filter(x => !x.archivedAt); else if (this.state.filterMode === 'archived') h = h.filter(x => x.archivedAt); else if (this.state.filterMode === 'today') h = h.filter(x => this.isHabitScheduledToday(x)); if (this.state.searchQuery) { const q = this.state.searchQuery.toLowerCase(); h = h.filter(x => x.name.toLowerCase().includes(q)); } return h; }

  isHabitScheduledOn(h: Habit, date: string): boolean { const d = parseDate(date).getDay(); switch (h.schedule.type) { case 'daily': return true; case 'weekdays': return d >= 1 && d <= 5; case 'custom': return h.schedule.days?.includes(d) ?? false; } return false; }
  isHabitScheduledToday(h: Habit): boolean { return this.isHabitScheduledOn(h, getTodayString()); }

  getHabitCompletions(id: string): Completion[] { return this.state.completions.filter(c => c.habitId === id); }
  getHabitShields(id: string): Shield[] { return this.state.shields.filter(s => s.habitId === id); }

  getHabitStreak(id: string) { const cs = this.getHabitCompletions(id); const h = this.state.habits.find(x => x.id === id); const ss = this.getHabitShields(id); const m = new Map<string, number>(); cs.forEach(c => m.set(c.date, (m.get(c.date) || 0) + c.value)); return getStreakData(m, h!, ss); }

  getHeatmapData(year: number = new Date().getFullYear()): Map<string, number> { const m = new Map<string, number>(); for (const c of this.state.completions) { const y = parseInt(c.date.split('-')[0]); if (y === year) m.set(c.date, (m.get(c.date) || 0) + c.value); } return m; }

  getHeatmapLevelForDate(date: string, year: number = new Date().getFullYear()): 0|1|2|3|4 { const m = this.getHeatmapData(year); const max = Math.max(...m.values(), 1); return getHeatmapLevel(m.get(date) || 0, max); }

  async createHabit(h: Omit<Habit, 'id' | 'createdAt' | 'updatedAt' | 'order'>): Promise<Habit> { const nh: Habit = { ...h, id: crypto.randomUUID(), order: this.state.habits.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; await saveHabit(nh); this.setState({ habits: [...this.state.habits, nh] }); if (this.state.user?.settings.syncEnabled && appwrite.isOnline()) try { await appwrite.createHabit(nh); } catch { await addPendingChange('habit', 'create', nh); } return nh; }

  async updateHabit(h: Habit): Promise<void> { const uh = { ...h, updatedAt: new Date().toISOString() }; await saveHabit(uh); this.setState({ habits: this.state.habits.map(x => x.id === h.id ? uh : x) }); if (this.state.user?.settings.syncEnabled && appwrite.isOnline()) try { await appwrite.updateHabit(uh); } catch { await addPendingChange('habit', 'update', uh); } }

  async deleteHabit(id: string): Promise<void> { await deleteHabit(id); this.setState({ habits: this.state.habits.filter(h => h.id !== id) }); if (this.state.user?.settings.syncEnabled && appwrite.isOnline()) try { await appwrite.deleteHabit(id); } catch { await addPendingChange('habit', 'delete', { id }); } }

  async toggleHabitArchive(id: string): Promise<void> { const h = this.state.habits.find(x => x.id === id); if (!h) return; await this.updateHabit({ ...h, archivedAt: h.archivedAt ? undefined : new Date().toISOString() }); }

  async completeHabit(habitId: string, date: string = getTodayString(), value: number = 1): Promise<void> { const h = this.state.habits.find(x => x.id === habitId); if (!h) return; const existing = this.state.completions.find(c => c.habitId === habitId && c.date === date); let c: Completion; if (existing) { const nv = h.mode === 'checkbox' ? 1 : existing.value + value; c = { ...existing, value: nv, synced: false }; } else { c = { id: crypto.randomUUID(), habitId, date, value: h.mode === 'checkbox' ? 1 : value, createdAt: new Date().toISOString(), synced: false }; } await saveCompletion(c); this.setState({ completions: this.state.completions.map(x => x.id === c.id ? c : x).concat(existing ? [] : [c]) }); if (h.mode !== 'checkbox') { const st = this.getHabitStreak(habitId); const ns = Math.floor(st.current / 7) - st.shields; if (ns > 0) for (let i = 0; i < ns; i++) { const s: Shield = { id: crypto.randomUUID(), habitId, earnedAt: new Date().toISOString(), source: 'streak' }; await saveShield(s); this.setState({ shields: [...this.state.shields, s] }); } } if (this.state.user?.settings.syncEnabled && appwrite.isOnline()) try { await appwrite.createCompletion(c); } catch { await addPendingChange('completion', existing ? 'update' : 'create', c); } }

  async uncompleteHabit(habitId: string, date: string = getTodayString()): Promise<void> { const c = this.state.completions.find(x => x.habitId === habitId && x.date === date); if (!c) return; if (c.value > 1) { const u = { ...c, value: c.value - 1, synced: false }; await saveCompletion(u); this.setState({ completions: this.state.completions.map(x => x.id === c.id ? u : x) }); } else { await deleteCompletion(c.id); this.setState({ completions: this.state.completions.filter(x => x.id !== c.id) }); } if (this.state.user?.settings.syncEnabled && appwrite.isOnline()) try { if (c.value > 1) await appwrite.updateCompletion({ ...c, value: c.value - 1 }); else await appwrite.deleteCompletion(c.id); } catch { await addPendingChange('completion', c.value > 1 ? 'update' : 'delete', c); } }

  async useShield(habitId: string, shieldId: string, date: string): Promise<void> { const s = this.state.shields.find(x => x.id === shieldId); if (!s || s.usedAt) return; const us = { ...s, usedAt: new Date().toISOString() }; await saveShield(us); this.setState({ shields: this.state.shields.map(x => x.id === shieldId ? us : x) }); const c: Completion = { id: crypto.randomUUID(), habitId, date, value: 1, createdAt: new Date().toISOString(), synced: false }; await saveCompletion(c); this.setState({ completions: [...this.state.completions, c] }); }

  async createRoutine(r: Omit<Routine, 'id' | 'createdAt' | 'updatedAt' | 'order'>): Promise<Routine> { const nr: Routine = { ...r, id: crypto.randomUUID(), order: this.state.routines.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; await saveRoutine(nr); this.setState({ routines: [...this.state.routines, nr] }); if (this.state.user?.settings.syncEnabled && appwrite.isOnline()) try { await appwrite.createRoutine(nr); } catch { await addPendingChange('routine', 'create', nr); } return nr; }

  async updateRoutine(r: Routine): Promise<void> { const ur = { ...r, updatedAt: new Date().toISOString() }; await saveRoutine(ur); this.setState({ routines: this.state.routines.map(x => x.id === r.id ? ur : x) }); if (this.state.user?.settings.syncEnabled && appwrite.isOnline()) try { await appwrite.updateRoutine(ur); } catch { await addPendingChange('routine', 'update', ur); } }

  async deleteRoutine(id: string): Promise<void> { await deleteRoutine(id); this.setState({ routines: this.state.routines.filter(r => r.id !== id) }); if (this.state.user?.settings.syncEnabled && appwrite.isOnline()) try { await appwrite.deleteRoutine(id); } catch { await addPendingChange('routine', 'delete', { id }); } }

  async createCustomTheme(t: Omit<Theme, 'id' | 'createdAt'>): Promise<Theme> { const nt: Theme = { ...t, id: crypto.randomUUID(), isCustom: true, isPro: false, createdAt: new Date().toISOString() }; await saveTheme(nt); this.setState({ themes: [...this.state.themes, nt] }); if (this.state.user?.settings.syncEnabled && appwrite.isOnline()) try { await appwrite.createTheme(nt); } catch { await addPendingChange('theme', 'create', nt); } return nt; }
  async deleteCustomTheme(id: string): Promise<void> { const t = this.state.themes.find(x => x.id === id); if (!t || !t.isCustom) return; await deleteTheme(id); this.setState({ themes: this.state.themes.filter(x => x.id !== id) }); if (this.state.theme.id === id) this.setTheme(DEFAULT_THEME_ID); }

  async signUp(email: string, password: string, name: string): Promise<User> { const u = await appwrite.signUpWithEmail(email, password, name); await saveUser(u); this.setState({ user: u }); return u; }
  async signIn(email: string, password: string): Promise<User> { const u = await appwrite.signInWithEmail(email, password); await saveUser(u); this.setState({ user: u }); await this.loadFromStorage(); return u; }
  async signInWithApple(): Promise<User> { const u = await appwrite.signInWithApple(); await saveUser(u); this.setState({ user: u }); await this.loadFromStorage(); return u; }
  async signOut(): Promise<void> { await appwrite.signOut(); await clearAllDataStorage(); this.setState({ user: null, habits: [], routines: [], completions: [], shields: [], sync: { status: 'offline', pendingChanges: 0 } }); }
  async updateProTier(tier: User['proTier'], exp?: string): Promise<void> { if (!this.state.user) return; const u = await appwrite.updateProTier(tier, exp); await saveUser(u); this.setState({ user: u }); }
  async exportData(): Promise<string> { return exportAllData(); }
  async importData(json: string): Promise<void> { await importAllData(json); await this.loadFromStorage(); }
  async clearAllData(): Promise<void> { await clearAllDataStorage(); this.setState({ user: null, habits: [], routines: [], completions: [], shields: [], sync: { status: 'idle', pendingChanges: 0 } }); }
  navigateDate(dir: 'prev' | 'next'): void { const d = parseDate(this.state.selectedDate); this.setSelectedDate(getDateString(dir === 'prev' ? subDays(d, 1) : addDays(d, 1))); }
  goToToday(): void { this.setSelectedDate(getTodayString()); }
}

function parseDate(s: string): Date { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }

export const store = new AppStore();