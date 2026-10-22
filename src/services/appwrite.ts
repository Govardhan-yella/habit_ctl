import { Habit, Completion, Shield, Routine, Theme, User, UserSettings } from '../types';

const ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || '';
const DATABASE_ID = 'init-habits';
const COLLECTIONS = { habits: 'habits', completions: 'completions', shields: 'shields', routines: 'routines', themes: 'themes', users: 'users', settings: 'settings' };

class AppwriteService {
  private client: any; private account: any; private databases: any;
  private subscriptions: Map<string, () => void> = new Map();
  private isConnected = false; private listeners: Set<(connected: boolean) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && PROJECT_ID) {
      import('appwrite').then(({ Client, Account, Databases }) => {
        this.client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
        this.account = new Account(this.client);
        this.databases = new Databases(this.client);
      });
    }
  }

  /** True when VITE_APPWRITE_PROJECT_ID is provided; otherwise cloud features are disabled. */
  isConfigured(): boolean { return !!PROJECT_ID; }


  onConnectionChange(listener: (connected: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(connected: boolean): void { this.isConnected = connected; this.listeners.forEach(l => l(connected)); }

  async initialize(): Promise<void> {
    if (!this.isConfigured()) { this.notify(false); return; }
    try { await this.account.get(); this.notify(true); } catch { this.notify(false); }
  }

  private resubscribeAll(): void { this.subscriptions.forEach(u => { try { u(); } catch {} }); this.subscriptions.clear(); }

  subscribe(collectionId: string, callbacks: { onCreate?: (d: any) => void; onUpdate?: (d: any) => void; onDelete?: (d: any) => void }): () => void {
    if (!this.isConfigured() || !this.client) return () => {};
    const channel = `databases.${DATABASE_ID}.collections.${collectionId}.documents`;
    const unsubscribe = this.client.subscribe(channel, (response: any) => {
      const { events, payload } = response;
      if (events.some((e: string) => e.includes('.create'))) callbacks.onCreate?.(payload);
      else if (events.some((e: string) => e.includes('.update'))) callbacks.onUpdate?.(payload);
      else if (events.some((e: string) => e.includes('.delete'))) callbacks.onDelete?.(payload);
    });
    const key = `${collectionId}-${Date.now()}`; this.subscriptions.set(key, unsubscribe);
    return () => { unsubscribe(); this.subscriptions.delete(key); };
  }

  async signUpWithEmail(email: string, password: string, name: string): Promise<User> {
    const { ID } = await import('appwrite');
    const account = await this.account.create(ID.unique(), email, password, name);
    const user = await this.createUserDoc(account.$id, email, name, 'email');
    await this.account.createEmailSession(email, password);
    return user;
  }

  async signInWithEmail(email: string, password: string): Promise<User> {
    await this.account.createEmailSession(email, password);
    return this.getCurrentUser();
  }

  async signInWithApple(): Promise<User> {
    await this.account.createOAuth2Session('apple', `${location.origin}/auth/callback`, `${location.origin}/auth/callback`);
    return this.getCurrentUser();
  }

  async signOut(): Promise<void> { await this.account.deleteSession('current'); this.notify(false); }

  async getCurrentUser(): Promise<User> {
    const account = await this.account.get();
    const doc = await this.databases.getDocument(DATABASE_ID, COLLECTIONS.users, account.$id);
    return this.mapUser(doc);
  }

  private async createUserDoc(userId: string, email: string, name: string, provider: 'apple' | 'email'): Promise<User> {
    const user: User = { id: userId, email, name, provider, proTier: 'free', settings: this.defaultSettings(), createdAt: new Date().toISOString() };
    await this.databases.createDocument(DATABASE_ID, COLLECTIONS.users, userId, this.mapUserToDoc(user), [
      { type: 'read', userId }, { type: 'update', userId }, { type: 'delete', userId }
    ]);
    return user;
  }

  defaultSettings(): UserSettings {
    return { themeId: 'tokyo-night', syncEnabled: true, iCloudSync: false, animations: true, hapticFeedback: true, weekStartsOn: 0, dateFormat: 'YYYY-MM-DD', timeFormat: '24h', language: 'en', matteMode: false, passcodeEnabled: false, biometricEnabled: false, vacationMode: false };
  }

  mapUser(doc: any): User {
    return { id: doc.$id, email: doc.email, name: doc.name, avatar: doc.avatar, provider: doc.provider, proTier: doc.proTier, proExpiresAt: doc.proExpiresAt, settings: JSON.parse(doc.settings), createdAt: doc.$createdAt };
  }

  mapUserToDoc(user: User): any { return { email: user.email, name: user.name, avatar: user.avatar, provider: user.provider, proTier: user.proTier, proExpiresAt: user.proExpiresAt, settings: JSON.stringify(user.settings) }; }

  async updateUserSettings(settings: Partial<UserSettings>): Promise<User> {
    const user = await this.getCurrentUser(); const updated = { ...user.settings, ...settings };
    await this.databases.updateDocument(DATABASE_ID, COLLECTIONS.users, user.id, { settings: JSON.stringify(updated) });
    return { ...user, settings: updated };
  }

  async updateProTier(tier: User['proTier'], expiresAt?: string): Promise<User> {
    const user = await this.getCurrentUser();
    await this.databases.updateDocument(DATABASE_ID, COLLECTIONS.users, user.id, { proTier: tier, proExpiresAt: expiresAt });
    return { ...user, proTier: tier, proExpiresAt: expiresAt };
  }

  async createHabit(habit: Omit<Habit, 'id' | 'createdAt' | 'updatedAt'>): Promise<Habit> {
    const user = await this.getCurrentUser(); const now = new Date().toISOString(); const { ID } = await import('appwrite');
    const doc = { ...habit, userId: user.id, createdAt: now, updatedAt: now, schedule: JSON.stringify(habit.schedule), reminders: JSON.stringify(habit.reminders) };
    const result = await this.databases.createDocument(DATABASE_ID, COLLECTIONS.habits, ID.unique(), doc, [{ type: 'read', userId: user.id }, { type: 'update', userId: user.id }, { type: 'delete', userId: user.id }]);
    return this.mapHabit(result);
  }

  async updateHabit(habit: Habit): Promise<Habit> {
    const doc = { ...habit, updatedAt: new Date().toISOString(), schedule: JSON.stringify(habit.schedule), reminders: JSON.stringify(habit.reminders) };
    const result = await this.databases.updateDocument(DATABASE_ID, COLLECTIONS.habits, habit.id, doc);
    return this.mapHabit(result);
  }

  async deleteHabit(habitId: string): Promise<void> { await this.databases.deleteDocument(DATABASE_ID, COLLECTIONS.habits, habitId); }

  async getHabits(): Promise<Habit[]> {
    const user = await this.getCurrentUser(); const { Query } = await import('appwrite');
    const result = await this.databases.listDocuments(DATABASE_ID, COLLECTIONS.habits, [Query.equal('userId', user.id), Query.orderAsc('order')]);
    return result.documents.map(this.mapHabit);
  }

  mapHabit(doc: any): Habit { return { id: doc.$id, name: doc.name, icon: doc.icon, color: doc.color, textColor: doc.textColor || undefined, textColorMode: doc.textColorMode || undefined, mode: doc.mode, target: doc.target, unit: doc.unit, schedule: JSON.parse(doc.schedule), reminders: JSON.parse(doc.reminders), routineId: doc.routineId, createdAt: doc.createdAt, archivedAt: doc.archivedAt, updatedAt: doc.updatedAt, order: doc.order }; }

  async createCompletion(completion: Omit<Completion, 'id' | 'createdAt' | 'synced'>): Promise<Completion> {
    const user = await this.getCurrentUser(); const now = new Date().toISOString(); const { ID } = await import('appwrite');
    const doc = { ...completion, userId: user.id, createdAt: now, synced: true };
    const result = await this.databases.createDocument(DATABASE_ID, COLLECTIONS.completions, ID.unique(), doc, [{ type: 'read', userId: user.id }, { type: 'update', userId: user.id }, { type: 'delete', userId: user.id }]);
    return this.mapCompletion(result);
  }

  async updateCompletion(completion: Completion): Promise<Completion> { const result = await this.databases.updateDocument(DATABASE_ID, COLLECTIONS.completions, completion.id, { value: completion.value, synced: true }); return this.mapCompletion(result); }
  async deleteCompletion(completionId: string): Promise<void> { await this.databases.deleteDocument(DATABASE_ID, COLLECTIONS.completions, completionId); }

  async getCompletions(habitId?: string, date?: string): Promise<Completion[]> {
    const user = await this.getCurrentUser(); const { Query } = await import('appwrite');
    const queries = [Query.equal('userId', user.id)]; if (habitId) queries.push(Query.equal('habitId', habitId)); if (date) queries.push(Query.equal('date', date));
    const result = await this.databases.listDocuments(DATABASE_ID, COLLECTIONS.completions, queries); return result.documents.map(this.mapCompletion);
  }

  mapCompletion(doc: any): Completion { return { id: doc.$id, habitId: doc.habitId, date: doc.date, value: doc.value, createdAt: doc.createdAt, synced: doc.synced }; }

  async createShield(shield: Omit<Shield, 'id'>): Promise<Shield> { const user = await this.getCurrentUser(); const { ID } = await import('appwrite'); const result = await this.databases.createDocument(DATABASE_ID, COLLECTIONS.shields, ID.unique(), { ...shield, userId: user.id }, [{ type: 'read', userId: user.id }, { type: 'update', userId: user.id }, { type: 'delete', userId: user.id }]); return this.mapShield(result); }
  async getShields(habitId?: string): Promise<Shield[]> { const user = await this.getCurrentUser(); const { Query } = await import('appwrite'); const queries = [Query.equal('userId', user.id)]; if (habitId) queries.push(Query.equal('habitId', habitId)); const result = await this.databases.listDocuments(DATABASE_ID, COLLECTIONS.shields, queries); return result.documents.map(this.mapShield); }
  mapShield(doc: any): Shield { return { id: doc.$id, habitId: doc.habitId, earnedAt: doc.earnedAt, usedAt: doc.usedAt, source: doc.source }; }

  async createRoutine(routine: Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>): Promise<Routine> { const user = await this.getCurrentUser(); const now = new Date().toISOString(); const { ID } = await import('appwrite'); const doc = { ...routine, userId: user.id, createdAt: now, updatedAt: now, schedule: JSON.stringify(routine.schedule), habitIds: JSON.stringify(routine.habitIds) }; const result = await this.databases.createDocument(DATABASE_ID, COLLECTIONS.routines, ID.unique(), doc, [{ type: 'read', userId: user.id }, { type: 'update', userId: user.id }, { type: 'delete', userId: user.id }]); return this.mapRoutine(result); }
  async updateRoutine(routine: Routine): Promise<Routine> { const doc = { ...routine, updatedAt: new Date().toISOString(), schedule: JSON.stringify(routine.schedule), habitIds: JSON.stringify(routine.habitIds) }; const result = await this.databases.updateDocument(DATABASE_ID, COLLECTIONS.routines, routine.id, doc); return this.mapRoutine(result); }
  async deleteRoutine(routineId: string): Promise<void> { await this.databases.deleteDocument(DATABASE_ID, COLLECTIONS.routines, routineId); }
  async getRoutines(): Promise<Routine[]> { const user = await this.getCurrentUser(); const { Query } = await import('appwrite'); const result = await this.databases.listDocuments(DATABASE_ID, COLLECTIONS.routines, [Query.equal('userId', user.id), Query.orderAsc('order')]); return result.documents.map(this.mapRoutine); }
  mapRoutine(doc: any): Routine { return { id: doc.$id, name: doc.name, icon: doc.icon, color: doc.color, textColor: doc.textColor || undefined, textColorMode: doc.textColorMode || undefined, schedule: JSON.parse(doc.schedule), habitIds: JSON.parse(doc.habitIds), createdAt: doc.createdAt, updatedAt: doc.updatedAt, order: doc.order }; }

  async createTheme(theme: Omit<Theme, 'id'>): Promise<Theme> { const user = await this.getCurrentUser(); const { ID } = await import('appwrite'); const doc = { ...theme, userId: user.id, colors: JSON.stringify(theme.colors) }; const result = await this.databases.createDocument(DATABASE_ID, COLLECTIONS.themes, ID.unique(), doc, [{ type: 'read', userId: user.id }, { type: 'update', userId: user.id }, { type: 'delete', userId: user.id }]); return this.mapTheme(result); }
  async getThemes(): Promise<Theme[]> { const user = await this.getCurrentUser(); const { Query } = await import('appwrite'); const result = await this.databases.listDocuments(DATABASE_ID, COLLECTIONS.themes, [Query.equal('userId', user.id)]); return result.documents.map(this.mapTheme); }
  mapTheme(doc: any): Theme { return { id: doc.$id, name: doc.name, colors: JSON.parse(doc.colors), isCustom: doc.isCustom, isPro: doc.isPro, fontFamily: doc.fontFamily, createdAt: doc.$createdAt }; }

  isOnline(): boolean { return this.isConnected; }
}

export const appwrite = new AppwriteService();