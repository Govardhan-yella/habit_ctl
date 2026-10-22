import { Habit, Completion, Shield, Routine, Theme, User, UserSettings, SyncState, AppState, HabitMode, MoodLog, WaterLog, Note, Template, SyncConfig } from '../types';
import { THEMES, DEFAULT_THEME_ID, getTheme } from '../data/themes';
import { getTodayString, getDateString, addDays, subDays, getDaysBetween, getStreakData, getHeatmapLevel } from '../utils/date';
import { mix, rgba, heatRamp, isDark, matte as matteColor } from '../utils/color';
import { saveHabit, getAllHabits, deleteHabit, saveCompletion, getCompletionsByHabit, getAllCompletions, getUnsyncedCompletions, deleteCompletion, saveShield, getShieldsByHabit, getAllShields, saveRoutine, getAllRoutines, deleteRoutine, saveTheme, getAllThemes, deleteTheme, saveUser, getUser, saveSettings, getSettings, saveSyncState, getSyncState, addPendingChange, getPendingChanges, removePendingChange, updatePendingChangeRetries, clearAllData as clearAllDataStorage, exportAllData, importAllData, applySyncedData, getSyncHandle, setSyncHandle } from '../services/storage';
import { appwrite } from '../services/appwrite';
import { createProvider, snapshotFromState, mergeSnapshots, saveTombstones, addTombstone, MergeStats } from '../services/sync';
import { FileProvider, supportsFileSystemAccess } from '../services/sync/file';
import { playSound } from '../services/audio';
import { showCelebration } from '../components/Celebration';

type Listener = (state: AppState) => void;

class AppStore {
  private state: AppState = {
    user: null,
    habits: [],
    routines: [],
    completions: [],
    shields: [],
    themes: THEMES,
    theme: THEMES[0],
    sync: { status: 'idle', pendingChanges: 0 },
    view: 'list',
    selectedDate: getTodayString(),
    searchQuery: '',
    filterMode: 'active',
    moods: [],
    waters: [],
    notes: [],
    templates: [],
  };
  private listeners: Set<Listener> = new Set(); private initialized = false; private ready = false;
  private skips: Set<string> = new Set();
  private settings: UserSettings = { themeId: DEFAULT_THEME_ID, syncEnabled: true, iCloudSync: false, animations: true, hapticFeedback: true, weekStartsOn: 0, dateFormat: 'YYYY-MM-DD', timeFormat: '24h', language: 'en', matteMode: false, passcodeEnabled: false, biometricEnabled: false, vacationMode: false };

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
  /** True when Appwrite env vars are present; cloud sign-in/sync is unavailable otherwise. */
  cloudConfigured(): boolean { return appwrite.isConfigured(); }

  /* ── Sync ─────────────────────────────────────────────────── */

  /** The user's sync configuration, if any. */
  syncConfig(): SyncConfig | undefined { return this.getSettings().sync; }

  /** Update the sync configuration and persist it. */
  async setSyncConfig(patch: Partial<SyncConfig>): Promise<void> {
    const current = this.syncConfig() ?? { provider: 'none' as const };
    await this.updateSettings({ sync: { ...current, ...patch } });
    this.scheduleAutoSync();
  }

  /** True when the browser can silently write to a local file. */
  fileSyncSupported(): boolean { return supportsFileSystemAccess(); }

  /** Pick the file the snapshot is written to, and remember it for next time. */
  async chooseSyncFile(): Promise<string | null> {
    const cfg = this.syncConfig() ?? { provider: 'file' as const };
    const provider = new FileProvider({ fileName: cfg.fileName || 'habit_ctl.json' });
    try {
      const handle = await provider.pick();
      if (!handle) return null;
      await setSyncHandle('file', handle);
      return handle.name;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : String(e));
    }
  }

  /** Restore the previously chosen file handle (may need a permission re-grant). */
  private async restoreFileHandle(): Promise<unknown> {
    try { return await getSyncHandle('file'); } catch { return null; }
  }

  /** Check that the configured provider is reachable. */
  async testSync(): Promise<{ ok: boolean; message: string }> {
    const cfg = this.syncConfig();
    if (!cfg || cfg.provider === 'none') return { ok: false, message: 'No provider selected' };
    if (cfg.provider === 'appwrite') return { ok: false, message: 'Appwrite needs VITE_APPWRITE_PROJECT_ID — use WebDAV or a local file instead' };
    const handle = cfg.provider === 'file' ? await this.restoreFileHandle() : null;
    const provider = createProvider(cfg, handle);
    if (!provider) return { ok: false, message: 'Provider is not fully configured' };
    return provider.test();
  }

  /**
   * Pull the remote snapshot, merge it with local data, apply the result and
   * push it back. Safe to run when the remote does not exist yet.
   */
  async syncNow(): Promise<{ ok: boolean; message: string }> {
    const cfg = this.syncConfig();
    if (!cfg || cfg.provider === 'none') return { ok: false, message: 'No sync provider configured' };
    if (cfg.provider === 'appwrite') { await this.syncWithCloud(); return { ok: true, message: 'Cloud sync finished' }; }
    if (this.state.sync.status === 'syncing') return { ok: false, message: 'A sync is already running' };

    this.setState({ sync: { ...this.state.sync, status: 'syncing' } });
    try {
      const handle = cfg.provider === 'file' ? await this.restoreFileHandle() : null;
      const provider = createProvider(cfg, handle);
      if (!provider) throw new Error('Sync provider is not fully configured');

      const local = snapshotFromState(this.state);
      const remote = await provider.pull();
      const merged = remote ? mergeSnapshots(local, remote) : { snapshot: { ...local, exportedAt: new Date().toISOString() }, stats: null as unknown as MergeStats };
      await applySyncedData(merged.snapshot);
      saveTombstones(merged.snapshot.tombstones);
      await this.loadFromStorage();
      await provider.push(merged.snapshot);

      const stats = merged.stats;
      const summary = stats
        ? `Synced — ${describeMerge(stats)}`
        : 'Uploaded — no remote copy yet';
      this.setState({ sync: { status: 'idle', lastSync: new Date().toISOString(), pendingChanges: 0 } });
      await saveSyncState(this.state.sync);
      return { ok: true, message: summary };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.setState({ sync: { ...this.state.sync, status: 'error', error: message } });
      return { ok: false, message };
    }
  }

  /** Start/stop the background auto-sync timer. */
  scheduleAutoSync(): void {
    if (this.syncTimer !== null) { window.clearInterval(this.syncTimer); this.syncTimer = null; }
    const cfg = this.syncConfig();
    if (!cfg?.autoSync || !cfg.provider || cfg.provider === 'none' || !this.getSettings().syncEnabled) return;
    const minutes = Math.max(1, cfg.syncIntervalMin || 15);
    this.syncTimer = window.setInterval(() => { void this.syncNow(); }, minutes * 60_000);
  }

  private syncTimer: number | null = null;

  /* ── End sync ─────────────────────────────────────────────── */

  private async loadFromStorage(): Promise<void> {
    const [habits, routines, completions, shields, themes, user, settings, sync] = await Promise.all([getAllHabits(), getAllRoutines(), getAllCompletions(), getAllShields(), getAllThemes(), getUser(), getSettings(), getSyncState()]);
    const themeId = settings?.themeId || DEFAULT_THEME_ID;
    this.settings = settings || this.settings;
    this.setState({ habits: habits.sort((a, b) => a.order - b.order), routines: routines.sort((a, b) => a.order - b.order), completions, shields, themes: [...THEMES, ...themes.filter(t => t.isCustom)], theme: this.resolveTheme(themeId), user, sync: sync || { status: 'idle', pendingChanges: 0 }, moods: (this.state as any).moods || [], waters: (this.state as any).waters || [], notes: (this.state as any).notes || [], templates: (this.state as any).templates || [] });
    this.applyTheme(this.resolveTheme(themeId));
    this.loadSide();
    this.scheduleAutoSync();
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

  private applyTheme(theme: Theme): void {
    const r = document.documentElement;
    const c = theme.colors;
    const set = (k: string, v: string) => r.style.setProperty(k, v);

    // Optional matte mode: pull accents/status colours toward greyscale so themes
    // read calm and low-chroma. Surfaces/backgrounds are left alone.
    const matteOn = !!this.getSettings().matteMode;
    const m = (hex: string) => (matteOn ? matteColor(hex, 0.7) : hex);

    const accent = m(c.accent);
    const accentAlt = m(c.accentAlt || c.accent);
    const accentMuted = m(c.accentMuted);

    // Body text stays neutral (near-white on dark themes, near-black on light ones);
    // the theme's accent carries the colour in headings and highlights.
    const dark = isDark(c.bg);
    const fg = dark ? '#f5f6fa' : '#101216';
    const fgMuted = mix(c.bg, fg, dark ? 0.55 : 0.5);

    set('--bg', c.bg);
    set('--bg-secondary', c.bgSecondary);
    set('--fg', fg);
    set('--fg-muted', fgMuted);
    set('--accent', accent);
    set('--accent-muted', accentMuted);
    set('--accent-2', accentAlt);
    set('--info', m(c.info || c.accent));
    // Built-in themes keep a neutral border so the UI stays calm; custom themes
    // (Theme Editor) honour the border colour the user picked.
    set('--border', theme.isCustom && c.border ? c.border : rgba(fg, 0.1));
    set('--success', m(c.success));
    set('--warning', m(c.warning));
    set('--error', m(c.error));
    set('--ring', rgba(accent, 0.45));
    set('--surface', c.bgSecondary);
    set('--surface-2', mix(c.bgSecondary, fg, 0.04));
    set('--surface-3', mix(c.bgSecondary, fg, 0.08));
    set('--hair', rgba(fg, 0.06));
    set('--hair-strong', rgba(fg, 0.10));

    // Heatmap always derives from the theme's own accent so every theme gets its own
    // colour and the base cell stays visible against the surface.
    const [h0, h1, h2, h3, h4] = heatRamp(c.bgSecondary, accent);
    set('--heatmap-0', h0);
    set('--heatmap-1', h1);
    set('--heatmap-2', h2);
    set('--heatmap-3', h3);
    set('--heatmap-4', h4);

    document.body.dataset.theme = theme.id;
    document.body.dataset.matte = matteOn ? 'on' : 'off';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', c.bg);
  }

  private resolveTheme(id: string): Theme { return this.state.themes.find(t => t.id === id) || getTheme(id); }
  setTheme(id: string): void { const t = this.resolveTheme(id); this.setState({ theme: t }); this.applyTheme(t); void this.persistSetting({ themeId: id }); }
  getSettings(): UserSettings { return this.state.user?.settings || this.settings; }
  /** Persist a settings patch WITHOUT re-entering setTheme (avoids the old infinite loop). */
  private async persistSetting(s: Partial<UserSettings>): Promise<void> { const cur = this.getSettings(); const up = { ...cur, ...s }; this.settings = up; await saveSettings(up); if (this.state.user) this.setState({ user: { ...this.state.user, settings: up } }); else this.notify(); }
  async updateSettings(s: Partial<UserSettings>): Promise<void> { await this.persistSetting(s); if (s.themeId || 'matteMode' in s) this.applyTheme(s.themeId ? this.resolveTheme(s.themeId) : this.state.theme); if ('sync' in s || 'syncEnabled' in s) this.scheduleAutoSync(); }
  /** Fire a haptic tick when the setting is enabled and the device supports it. */
  haptic(ms = 12): void { try { if (this.getSettings().hapticFeedback && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms); } catch { /* unsupported */ } }
  defaultSettings(): UserSettings { return { themeId: DEFAULT_THEME_ID, syncEnabled: true, iCloudSync: false, animations: true, hapticFeedback: true, weekStartsOn: 0, dateFormat: 'YYYY-MM-DD', timeFormat: '24h', language: 'en', matteMode: false, passcodeEnabled: false, biometricEnabled: false, vacationMode: false }; }

  setView(v: AppState['view']): void { this.setState({ view: v }); }
  setSelectedDate(d: string): void { this.setState({ selectedDate: d }); }
  setSearchQuery(q: string): void { this.setState({ searchQuery: q }); }
  setFilterMode(m: AppState['filterMode']): void { this.setState({ filterMode: m }); }

  getFilteredHabits(): Habit[] { let h = this.state.habits; if (this.state.filterMode === 'active') h = h.filter(x => !x.archivedAt); else if (this.state.filterMode === 'archived') h = h.filter(x => x.archivedAt); else if (this.state.filterMode === 'today') h = h.filter(x => this.isHabitScheduledToday(x)); if (this.state.searchQuery) { const q = this.state.searchQuery.toLowerCase(); h = h.filter(x => x.name.toLowerCase().includes(q)); } const sort = this.getSettings().sortBy; if (sort) { h = [...h]; switch (sort) { case 'alpha': h.sort((a, b) => a.name.localeCompare(b.name)); break; case 'streak': h.sort((a, b) => this.getHabitStreak(b.id).current - this.getHabitStreak(a.id).current); break; case 'progress': h.sort((a, b) => this.habitProgress(b) - this.habitProgress(a)); break; case 'due': h.sort((a, b) => (this.isHabitScheduledToday(a) ? 0 : 1) - (this.isHabitScheduledToday(b) ? 0 : 1)); break; } } return h; }

  habitProgress(h: Habit): number { const today = getTodayString(); const c = this.state.completions.find(x => x.habitId === h.id && x.date === today); if (!c) return 0; return h.mode === 'checkbox' ? 1 : Math.min(1, c.value / h.target); }

  isHabitScheduledOn(h: Habit, date: string): boolean { const d = parseDate(date).getDay(); switch (h.schedule.type) { case 'daily': return true; case 'weekdays': return d >= 1 && d <= 5; case 'custom': return h.schedule.days?.includes(d) ?? false; } return false; }
  isHabitScheduledToday(h: Habit): boolean { return this.isHabitScheduledOn(h, getTodayString()); }

  getHabitCompletions(id: string): Completion[] { return this.state.completions.filter(c => c.habitId === id); }
  getHabitShields(id: string): Shield[] { return this.state.shields.filter(s => s.habitId === id); }

  getHabitStreak(id: string) { const cs = this.getHabitCompletions(id); const h = this.state.habits.find(x => x.id === id); const ss = this.getHabitShields(id); const m = new Map<string, number>(); cs.forEach(c => m.set(c.date, (m.get(c.date) || 0) + c.value)); const v = this.vacationWindow(); return getStreakData(m, h!, ss, v); }

  /** Active vacation window (if any) so streaks pause instead of breaking. */
  vacationWindow(): { start?: string; end?: string } | undefined {
    const s = this.getSettings();
    if (!s.vacationMode) return undefined;
    return { start: s.vacationStartsAt, end: s.vacationEndsAt };
  }

  getHeatmapData(year: number = new Date().getFullYear()): Map<string, number> { const m = new Map<string, number>(); for (const c of this.state.completions) { const y = parseInt(c.date.split('-')[0]); if (y === year) m.set(c.date, (m.get(c.date) || 0) + c.value); } return m; }

  getHeatmapLevelForDate(date: string, year: number = new Date().getFullYear()): 0|1|2|3|4 { const m = this.getHeatmapData(year); const max = Math.max(...m.values(), 1); return getHeatmapLevel(m.get(date) || 0, max); }

  async createHabit(h: Omit<Habit, 'id' | 'createdAt' | 'updatedAt' | 'order'>): Promise<Habit> { const nh: Habit = { ...h, id: crypto.randomUUID(), order: this.state.habits.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; await saveHabit(nh); this.setState({ habits: [...this.state.habits, nh] }); if (this.state.user?.settings.syncEnabled && appwrite.isOnline()) try { await appwrite.createHabit(nh); } catch { await addPendingChange('habit', 'create', nh); } return nh; }

  async updateHabit(h: Habit): Promise<void> { const uh = { ...h, updatedAt: new Date().toISOString() }; await saveHabit(uh); this.setState({ habits: this.state.habits.map(x => x.id === h.id ? uh : x) }); if (this.state.user?.settings.syncEnabled && appwrite.isOnline()) try { await appwrite.updateHabit(uh); } catch { await addPendingChange('habit', 'update', uh); } }

  async deleteHabit(id: string): Promise<void> { await deleteHabit(id); this.setState({ habits: this.state.habits.filter(h => h.id !== id) }); addTombstone('habit', id); if (this.state.user?.settings.syncEnabled && appwrite.isOnline()) try { await appwrite.deleteHabit(id); } catch { await addPendingChange('habit', 'delete', { id }); } }

  async toggleHabitArchive(id: string): Promise<void> { const h = this.state.habits.find(x => x.id === id); if (!h) return; await this.updateHabit({ ...h, archivedAt: h.archivedAt ? undefined : new Date().toISOString() }); }

  async completeHabit(habitId: string, date: string = getTodayString(), value: number = 1): Promise<void> {
    const h = this.state.habits.find(x => x.id === habitId);
    if (!h) return;
    const existing = this.state.completions.find(c => c.habitId === habitId && c.date === date);
    let c: Completion;
    const now = new Date().toISOString();
    if (existing) {
      const nv = h.mode === 'checkbox' ? 1 : existing.value + value;
      c = { ...existing, value: nv, synced: false, updatedAt: now };
    } else {
      c = { id: crypto.randomUUID(), habitId, date, value: h.mode === 'checkbox' ? 1 : value, createdAt: now, updatedAt: now, synced: false };
    }
    await saveCompletion(c);
    this.setState({ completions: this.state.completions.map(x => x.id === c.id ? c : x).concat(existing ? [] : [c]) });
    
    // Delight: sounds + celebrations
    try { playSound(existing ? 'click' : 'complete'); } catch {}
    
    if (!existing) {
      const st = this.getHabitStreak(habitId);
      if (st.current > 0 && st.current % 7 === 0) {
        try { playSound('streak'); showCelebration({ title: `${st.current}-day streak!`, message: `You're on fire with ${h.name}. Keep it going!`, icon: '🔥', confetti: true }); } catch {}
      }
      if (st.current === 30) {
        try { playSound('levelup'); showCelebration({ title: 'Level Up!', message: '30-day streak — legendary consistency.', icon: '⚡', confetti: true }); } catch {}
      }
      // perfect day?
      const tp = this.todayProgress();
      if (date === getTodayString() && tp.total > 0 && tp.done + 1 >= tp.total) {
        try { playSound('perfect'); showCelebration({ title: 'Perfect Day!', message: 'Every scheduled habit completed today.', icon: '🌟', confetti: true }); } catch {}
      }
    }
    
    if (h.mode !== 'checkbox') {
      const st = this.getHabitStreak(habitId);
      const ns = Math.floor(st.current / 7) - st.shields;
      if (ns > 0) for (let i = 0; i < ns; i++) {
        const s: Shield = { id: crypto.randomUUID(), habitId, earnedAt: new Date().toISOString(), source: 'streak' };
        await saveShield(s);
        this.setState({ shields: [...this.state.shields, s] });
        try { playSound('shield'); } catch {}
      }
    }
    if (this.state.user?.settings.syncEnabled && appwrite.isOnline()) try { await appwrite.createCompletion(c); } catch { await addPendingChange('completion', existing ? 'update' : 'create', c); }
  }

  async uncompleteHabit(habitId: string, date: string = getTodayString()): Promise<void> {
    const c = this.state.completions.find(x => x.habitId === habitId && x.date === date);
    if (!c) return;
    try { playSound('undo'); } catch {}
    if (c.value > 1) {
      const u = { ...c, value: c.value - 1, synced: false, updatedAt: new Date().toISOString() };
      await saveCompletion(u);
      this.setState({ completions: this.state.completions.map(x => x.id === c.id ? u : x) });
    } else {
      await deleteCompletion(c.id);
      addTombstone('completion', `${habitId}|${date}`);
      this.setState({ completions: this.state.completions.filter(x => x.id !== c.id) });
    }
    if (this.state.user?.settings.syncEnabled && appwrite.isOnline()) try { if (c.value > 1) await appwrite.updateCompletion({ ...c, value: c.value - 1 }); else await appwrite.deleteCompletion(c.id); } catch { await addPendingChange('completion', c.value > 1 ? 'update' : 'delete', c); }
  }

  async useShield(habitId: string, shieldId: string, date: string): Promise<void> { const s = this.state.shields.find(x => x.id === shieldId); if (!s || s.usedAt) return; const us = { ...s, usedAt: new Date().toISOString() }; await saveShield(us); this.setState({ shields: this.state.shields.map(x => x.id === shieldId ? us : x) }); const c: Completion = { id: crypto.randomUUID(), habitId, date, value: 1, createdAt: new Date().toISOString(), synced: false }; await saveCompletion(c); this.setState({ completions: [...this.state.completions, c] }); }

  async createRoutine(r: Omit<Routine, 'id' | 'createdAt' | 'updatedAt' | 'order'>): Promise<Routine> { const nr: Routine = { ...r, id: crypto.randomUUID(), order: this.state.routines.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; await saveRoutine(nr); this.setState({ routines: [...this.state.routines, nr] }); if (this.state.user?.settings.syncEnabled && appwrite.isOnline()) try { await appwrite.createRoutine(nr); } catch { await addPendingChange('routine', 'create', nr); } return nr; }

  async updateRoutine(r: Routine): Promise<void> { const ur = { ...r, updatedAt: new Date().toISOString() }; await saveRoutine(ur); this.setState({ routines: this.state.routines.map(x => x.id === r.id ? ur : x) }); if (this.state.user?.settings.syncEnabled && appwrite.isOnline()) try { await appwrite.updateRoutine(ur); } catch { await addPendingChange('routine', 'update', ur); } }

  async deleteRoutine(id: string): Promise<void> { await deleteRoutine(id); this.setState({ routines: this.state.routines.filter(r => r.id !== id) }); addTombstone('routine', id); if (this.state.user?.settings.syncEnabled && appwrite.isOnline()) try { await appwrite.deleteRoutine(id); } catch { await addPendingChange('routine', 'delete', { id }); } }

  async createCustomTheme(t: Omit<Theme, 'id' | 'createdAt'>): Promise<Theme> { const nt: Theme = { ...t, id: crypto.randomUUID(), isCustom: true, isPro: false, createdAt: new Date().toISOString() }; await saveTheme(nt); this.setState({ themes: [...this.state.themes, nt] }); if (this.state.user?.settings.syncEnabled && appwrite.isOnline()) try { await appwrite.createTheme(nt); } catch { await addPendingChange('theme', 'create', nt); } return nt; }
  async deleteCustomTheme(id: string): Promise<void> { const t = this.state.themes.find(x => x.id === id); if (!t || !t.isCustom) return; await deleteTheme(id); this.setState({ themes: this.state.themes.filter(x => x.id !== id) }); addTombstone('theme', id); if (this.state.theme.id === id) this.setTheme(DEFAULT_THEME_ID); }

  async signUp(email: string, password: string, name: string): Promise<User> { const u = await appwrite.signUpWithEmail(email, password, name); await saveUser(u); this.setState({ user: u }); return u; }
  async signIn(email: string, password: string): Promise<User> { const u = await appwrite.signInWithEmail(email, password); await saveUser(u); this.setState({ user: u }); await this.loadFromStorage(); return u; }
  async signInWithApple(): Promise<User> { const u = await appwrite.signInWithApple(); await saveUser(u); this.setState({ user: u }); await this.loadFromStorage(); return u; }
  async signOut(): Promise<void> { await appwrite.signOut(); await clearAllDataStorage(); this.clearSide(); this.setState({ user: null, habits: [], routines: [], completions: [], shields: [], moods: [], waters: [], notes: [], templates: [], sync: { status: 'offline', pendingChanges: 0 } }); }
  async updateProTier(tier: User['proTier'], exp?: string): Promise<void> { if (!this.state.user) return; const u = await appwrite.updateProTier(tier, exp); await saveUser(u); this.setState({ user: u }); }
  async exportData(): Promise<string> { return exportAllData(); }
  async importData(json: string): Promise<void> { await importAllData(json); await this.loadFromStorage(); }
  async clearAllData(): Promise<void> { await clearAllDataStorage(); this.clearSide(); this.setState({ user: null, habits: [], routines: [], completions: [], shields: [], moods: [], waters: [], notes: [], templates: [], sync: { status: 'idle', pendingChanges: 0 } }); }
  navigateDate(dir: 'prev' | 'next'): void { const d = parseDate(this.state.selectedDate); this.setSelectedDate(getDateString(dir === 'prev' ? subDays(d, 1) : addDays(d, 1))); }
  goToToday(): void { this.setSelectedDate(getTodayString()); }

  /* ── Side collections: moods, water, notes, templates, skips ── */
  private loadSide(): void {
    try {
      this.setState({
        moods: JSON.parse(localStorage.getItem('hc-moods') || '[]'),
        waters: JSON.parse(localStorage.getItem('hc-waters') || '[]'),
        notes: JSON.parse(localStorage.getItem('hc-notes') || '[]'),
        templates: JSON.parse(localStorage.getItem('hc-templates') || '[]'),
      });
      this.skips = new Set<string>(JSON.parse(localStorage.getItem('hc-skips') || '[]'));
    } catch { /* ignore */ }
  }
  private persistSide(): void {
    try {
      localStorage.setItem('hc-moods', JSON.stringify(this.state.moods));
      localStorage.setItem('hc-waters', JSON.stringify(this.state.waters));
      localStorage.setItem('hc-notes', JSON.stringify(this.state.notes));
      localStorage.setItem('hc-templates', JSON.stringify(this.state.templates));
      localStorage.setItem('hc-skips', JSON.stringify([...this.skips]));
    } catch { /* ignore */ }
  }
  private clearSide(): void {
    try { ['hc-moods', 'hc-waters', 'hc-notes', 'hc-templates', 'hc-skips'].forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
    this.skips.clear();
  }

  logMood(mood: string): void { const date = getTodayString(); const m: MoodLog = { id: crypto.randomUUID(), date, mood, createdAt: new Date().toISOString() }; this.setState({ moods: this.state.moods.filter(x => x.date !== date).concat(m) }); this.persistSide(); }
  getTodayMood(): string | undefined { return this.state.moods.find(x => x.date === getTodayString())?.mood; }
  getRecentMoods(days = 7): { date: string; mood?: string }[] { const out: { date: string; mood?: string }[] = []; for (let i = days - 1; i >= 0; i--) { const d = getDateString(subDays(new Date(), i)); out.push({ date: d, mood: this.state.moods.find(x => x.date === d)?.mood }); } return out; }

  getTodayWater(): number { return this.state.waters.find(x => x.date === getTodayString())?.glasses || 0; }
  waterGoal(): number { return 8; }

  /** Completion of today's scheduled habits — { done, total, pct (0..1) }. */
  todayProgress(): { done: number; total: number; pct: number } {
    const today = getTodayString();
    const scheduled = this.state.habits.filter(h => !h.archivedAt && this.isHabitScheduledToday(h));
    let done = 0;
    for (const h of scheduled) {
      const c = this.state.completions.find(x => x.habitId === h.id && x.date === today);
      const isDone = h.mode === 'checkbox' ? !!c : !!(c && c.value >= h.target);
      if (isDone) done++;
    }
    const total = scheduled.length;
    return { done, total, pct: total ? done / total : 0 };
  }

  setWater(glasses: number): void { const g = Math.max(0, Math.min(30, glasses)); const date = getTodayString(); const existing = this.state.waters.find(x => x.date === date); const nw: WaterLog = existing ? { ...existing, glasses: g } : { id: crypto.randomUUID(), date, glasses: g, createdAt: new Date().toISOString() }; this.setState({ waters: existing ? this.state.waters.map(x => x.id === nw.id ? nw : x) : [...this.state.waters, nw] }); this.persistSide(); }
  adjustWater(delta: number): void { this.setWater(this.getTodayWater() + delta); }

  addNote(text: string, habitId?: string): void { const t = text.trim(); if (!t) return; const n: Note = { id: crypto.randomUUID(), text: t, habitId, createdAt: new Date().toISOString() }; this.setState({ notes: [n, ...this.state.notes].slice(0, 200) }); this.persistSide(); }
  deleteNote(id: string): void { this.setState({ notes: this.state.notes.filter(n => n.id !== id) }); this.persistSide(); }

  saveTemplate(t: Omit<Template, 'id'>): Template { const nt: Template = { ...t, id: crypto.randomUUID() }; this.setState({ templates: [...this.state.templates, nt] }); this.persistSide(); return nt; }
  deleteTemplate(id: string): void { this.setState({ templates: this.state.templates.filter(t => t.id !== id) }); this.persistSide(); }

  isSkipped(habitId: string, date: string): boolean { return this.skips.has(`${habitId}|${date}`); }
  toggleSkip(habitId: string, date: string): void { const k = `${habitId}|${date}`; if (this.skips.has(k)) this.skips.delete(k); else this.skips.add(k); this.persistSide(); this.notify(); }
}

function parseDate(s: string): Date { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }

/** Human readable summary of what a sync changed. */
function describeMerge(s: MergeStats): string {
  const parts: string[] = [];
  const add = (n: number, label: string) => { if (n > 0) parts.push(`${n} ${label}${n === 1 ? '' : 's'}`); };
  add(s.habits, 'habit');
  add(s.routines, 'routine');
  add(s.completions, 'completion');
  add(s.shields, 'shield');
  add(s.themes, 'theme');
  return parts.length ? parts.join(', ') : 'no changes';
}

export const store = new AppStore();