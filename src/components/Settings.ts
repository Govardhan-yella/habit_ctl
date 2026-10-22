import { store } from '../stores/appStore';
import { UserSettings, Theme, SyncProviderId, SyncConfig } from '../types';
import { THEMES, getTheme, getFreeThemes, getProThemes } from '../data/themes';
import { canInstall, promptInstall, onPwaChange } from '../services/pwa';
import { notificationPermission, requestNotificationPermission } from '../services/reminders';
import { openThemeEditor } from './ThemeEditor';
import { createTerminalBlock, createEmptyState, createModal, createToast, createProgressBar } from './TerminalUI';

export class SettingsComponent {
  private c: HTMLElement; private u: () => void; private up: () => void;
  private writing = 0;
  private pendingRender = false;

  constructor(c: HTMLElement) {
    this.c = c;
    this.u = store.subscribe(() => {
      if (this.writing > 0) { this.pendingRender = true; return; }
      const active = document.activeElement as HTMLElement | null;
      if (active && this.c.contains(active) && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
        this.pendingRender = true;
        return;
      }
      this.pendingRender = false;
      this.render();
    });
    this.up = onPwaChange(() => this.render());
    this.c.addEventListener('focusout', () => {
      setTimeout(() => {
        const a = document.activeElement as HTMLElement | null;
        if (this.pendingRender && (!a || !this.c.contains(a))) {
          this.pendingRender = false;
          this.render();
        }
      }, 0);
    });
    this.render();
  }
  destroy() { this.u(); this.up(); }

  private async write(patch: Partial<SyncConfig>): Promise<void> {
    this.writing++;
    try {
      await store.setSyncConfig(patch);
    } finally {
      this.writing--;
    }
    if (this.writing === 0 && this.pendingRender) {
      const a = document.activeElement as HTMLElement | null;
      if (a && this.c.contains(a)) { this.pendingRender = true; return; }
      this.pendingRender = false;
      this.render();
    }
  }

  private async writeSettings(patch: Partial<UserSettings>): Promise<void> {
    this.writing++;
    try {
      await store.updateSettings(patch);
    } finally {
      this.writing--;
    }
    if (this.writing === 0 && this.pendingRender) {
      const a = document.activeElement as HTMLElement | null;
      if (a && this.c.contains(a)) { this.pendingRender = true; return; }
      this.pendingRender = false;
      this.render();
    }
  }

  render() {
    const s = store.getState(); const user = s.user; const settings = store.getSettings();
    const active = document.activeElement as HTMLInputElement | null;
    const activeId = active && this.c.contains(active) ? active.id : '';
    const selStart = activeId ? active!.selectionStart : null;
    this.pendingRender = false;

    this.c.innerHTML = '';
    const w = document.createElement('div'); w.className = 'settings-wrapper';
    const h = document.createElement('div'); h.className = 'settings-header';
    h.innerHTML = `<div class="settings-title"><span class="terminal-prompt">$</span><span class="settings-command">cat settings.txt</span></div>`;
    w.appendChild(h);

    // Account section
    const cloud = store.cloudConfigured();
    w.appendChild(this.section('Account', user ? `
      <div class="setting-row"><span class="setting-label">Signed in as</span><span class="setting-value">${user.name} (${user.email})</span></div>
      <div class="setting-row"><span class="setting-label">Plan</span><span class="setting-value badge badge-${user.proTier==='free'?'info':user.proTier==='lifetime'?'success':'warning'}">${user.proTier}</span></div>
      <div class="setting-actions"><button class="btn btn-danger btn-sm" id="signout">Sign Out</button></div>
    ` : cloud ? `
      <div class="setting-row"><span class="setting-label">Not signed in</span></div>
      <div class="setting-actions"><button class="btn btn-primary btn-sm" id="signin">Sign In</button><button class="btn btn-ghost btn-sm" id="signup">Sign Up</button><button class="btn btn-ghost btn-sm" id="apple">Continue with Apple</button></div>
    ` : `
      <div class="setting-row"><span class="setting-label">Not signed in</span></div>
      <div class="setting-row"><span class="setting-value setting-note">Cloud sign-in isn't configured. Add <code>VITE_APPWRITE_PROJECT_ID</code> (and endpoint) to enable sync. The app works fully offline.</span></div>
    `));

    // Theme section
    w.appendChild(this.section('Theme', this.themeGrid(settings.themeId)));

    // App section (install + notifications)
    const perm = notificationPermission();
    w.appendChild(this.section('App', `
      ${canInstall()
        ? '<div class="setting-row"><span class="setting-label">Install as app</span><button class="btn btn-primary btn-sm" id="install">Install</button></div>'
        : '<div class="setting-row"><span class="setting-label">Install as app</span><span class="setting-value">Use your browser menu → "Install"</span></div>'}
      <div class="setting-row"><span class="setting-label">Notifications</span><span class="setting-value">${perm === 'unsupported' ? 'not supported' : perm}</span></div>
      <div class="setting-actions"><button class="btn btn-ghost btn-sm" id="notif-perm">${perm === 'granted' ? 'Notifications enabled' : 'Enable Notifications'}</button></div>
    `));

    // Sync section
    w.appendChild(this.section('Sync', this.syncSection(settings, cloud)));

    // Appearance section
    w.appendChild(this.section('Appearance', `
      <div class="setting-row"><label class="toggle"><input type="checkbox" id="matte" ${settings.matteMode?'checked':''}><span class="toggle-slider"></span></label><span>Matte colours <span class="setting-hint">calm, low-chroma accents</span></span></div>
      <div class="setting-row"><label class="toggle"><input type="checkbox" id="animations" ${settings.animations?'checked':''}><span class="toggle-slider"></span></label><span>Animations</span></div>
      <div class="setting-row"><label class="toggle"><input type="checkbox" id="haptics" ${settings.hapticFeedback?'checked':''}><span class="toggle-slider"></span></label><span>Haptic Feedback</span></div>
      <div class="setting-row"><span class="setting-label">Week Starts</span><select id="week-start"><option value="0" ${settings.weekStartsOn===0?'selected':''}>Sunday</option><option value="1" ${settings.weekStartsOn===1?'selected':''}>Monday</option></select></div>
      <div class="setting-row"><span class="setting-label">Date Format</span><select id="date-fmt"><option value="YYYY-MM-DD" ${settings.dateFormat==='YYYY-MM-DD'?'selected':''}>YYYY-MM-DD</option><option value="DD/MM/YYYY" ${settings.dateFormat==='DD/MM/YYYY'?'selected':''}>DD/MM/YYYY</option><option value="MM/DD/YYYY" ${settings.dateFormat==='MM/DD/YYYY'?'selected':''}>MM/DD/YYYY</option></select></div>
      <div class="setting-row"><span class="setting-label">Time Format</span><select id="time-fmt"><option value="24h" ${settings.timeFormat==='24h'?'selected':''}>24h</option><option value="12h" ${settings.timeFormat==='12h'?'selected':''}>12h</option></select></div>
      <div class="setting-row"><span class="setting-label">Sort habits</span><select id="sort-by"><option value="" ${!settings.sortBy?'selected':''}>Default</option><option value="alpha" ${settings.sortBy==='alpha'?'selected':''}>A–Z</option><option value="due" ${settings.sortBy==='due'?'selected':''}>Due today</option><option value="streak" ${settings.sortBy==='streak'?'selected':''}>Streak</option><option value="progress" ${settings.sortBy==='progress'?'selected':''}>Progress</option></select></div>
      <div class="setting-col"><label class="setting-label" for="custom-css">Custom CSS</label><textarea id="custom-css" class="custom-css" rows="4" spellcheck="false" placeholder=".habit-item { border-radius: 8px }">${(settings.customCSS || '').replace(/</g, '&lt;')}</textarea></div>
    `));

    // Privacy section
    w.appendChild(this.section('Privacy', `
      <div class="setting-row"><label class="toggle"><input type="checkbox" id="passcode" ${settings.passcodeEnabled?'checked':''}><span class="toggle-slider"></span></label><span>Passcode Lock</span></div>
      <div class="setting-row"><label class="toggle"><input type="checkbox" id="vacation" ${settings.vacationMode?'checked':''}><span class="toggle-slider"></span></label><span>Vacation Mode <span class="setting-hint">pauses streaks</span></span></div>
      <div class="setting-row" id="vacation-range-row" style="display:${settings.vacationMode?'flex':'none'}">
        <span class="setting-label">Vacation window</span>
        <input type="date" id="vacation-start" value="${settings.vacationStartsAt || ''}">
        <span class="setting-hint">→</span>
        <input type="date" id="vacation-end" value="${settings.vacationEndsAt || ''}">
      </div>
    `));

    // Danger zone
    w.appendChild(this.section('Danger Zone', `
      <div class="setting-actions"><button class="btn btn-danger btn-sm" id="clear">Clear All Data</button></div>
    `));

    this.c.appendChild(w);
    this.bindEvents(user, settings);
    if (activeId) {
      const el = this.c.querySelector('#' + activeId) as HTMLInputElement | null;
      if (el) {
        el.focus();
        if (typeof selStart === 'number' && 'setSelectionRange' in el) {
          try { el.setSelectionRange(selStart, selStart); } catch { /* ignore */ }
        }
      }
    }
  }

  private section(title: string, content: string): HTMLElement {
    const s = document.createElement('div'); s.className = 'settings-section';
    s.innerHTML = `<h3 class="section-title">${title}</h3><div class="settings-content">${content}</div>`;
    return s;
  }

  /** The Sync section: provider picker, provider-specific fields and status. */
  private syncSection(settings: UserSettings, cloud: boolean): string {
    const s = store.getState();
    const cfg = settings.sync ?? { provider: 'none' as const };
    const fileName = cfg.fileName || 'habit_ctl.json';
    const provider = cfg.provider;

    const providerOptions = [
      { id: 'none', label: 'Off (local only)' },
      { id: 'file', label: 'Local file (auto-backup)' },
      { id: 'webdav', label: 'WebDAV (Nextcloud / ownCloud)' },
      { id: 'appwrite', label: 'Appwrite cloud' },
    ];

    const providerSelect = `
      <div class="setting-row">
        <span class="setting-label">Sync to</span>
        <select id="sync-provider">
          ${providerOptions.map(o => `<option value="${o.id}" ${provider === o.id ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </div>`;

    let providerFields = '';
    if (provider === 'file') {
      providerFields = `
        <div class="setting-row">
          <span class="setting-label">Snapshot file</span>
          <span class="setting-value">${fileName}</span>
          <button class="btn btn-ghost btn-sm" id="sync-pick-file">Choose…</button>
        </div>
        <div class="setting-note">Writes <code>${fileName}</code> to a folder you pick — iCloud Drive, Google Drive, Dropbox or a NAS mount. ${store.fileSyncSupported() ? 'Updates happen silently in the background.' : 'This browser cannot write files silently — use WebDAV instead.'}</div>`;
    } else if (provider === 'webdav') {
      providerFields = `
        <div class="setting-col"><label class="setting-label" for="dav-url">Server URL</label>
          <input type="url" id="dav-url" placeholder="https://cloud.example.com/remote.php/dav/files/user" value="${escapeAttr(cfg.webdavUrl || '')}"></div>
        <div class="setting-row">
          <div class="setting-col"><label class="setting-label" for="dav-user">Username</label><input type="text" id="dav-user" autocomplete="username" value="${escapeAttr(cfg.webdavUser || '')}"></div>
          <div class="setting-col"><label class="setting-label" for="dav-pass">App password</label><input type="password" id="dav-pass" autocomplete="current-password" value="${escapeAttr(cfg.webdavPassword || '')}"></div>
        </div>
        <div class="setting-row">
          <div class="setting-col"><label class="setting-label" for="dav-path">Folder</label><input type="text" id="dav-path" placeholder="Documents" value="${escapeAttr(cfg.webdavPath || '')}"></div>
          <div class="setting-col"><label class="setting-label" for="dav-file">File name</label><input type="text" id="dav-file" value="${escapeAttr(fileName)}"></div>
        </div>
        <div class="setting-note">Use an <strong>app password</strong>, not your account password. Works with Nextcloud, ownCloud, Seafile and Synology DSM.</div>`;
    } else if (provider === 'appwrite') {
      providerFields = cloud
        ? '<div class="setting-note">Syncing through your Appwrite project. Sign in first to enable sync.</div>'
        : '<div class="setting-note">Appwrite is not configured. Add <code>VITE_APPWRITE_PROJECT_ID</code> to <code>.env</code> and rebuild, or use WebDAV / a local file instead.</div>';
    } else {
      providerFields = '<div class="setting-note">Your data stays on this device. Pick a sync target above to back it up or use it on another device.</div>';
    }

    const autoRows = provider !== 'none' ? `
      <div class="setting-row"><label class="toggle"><input type="checkbox" id="sync-enabled" ${settings.syncEnabled ? 'checked' : ''}><span class="toggle-slider"></span></label><span>Enable sync</span></div>
      <div class="setting-row"><label class="toggle"><input type="checkbox" id="sync-auto" ${cfg.autoSync ? 'checked' : ''}><span class="toggle-slider"></span></label><span>Auto sync <span class="setting-hint">every</span></span>
        <select id="sync-interval">
          ${[5, 15, 30, 60, 180].map(m => `<option value="${m}" ${(cfg.syncIntervalMin || 15) === m ? 'selected' : ''}>${m} min</option>`).join('')}
        </select>
      </div>` : '';

    const status = s.sync.status;
    const statusLabel = status === 'syncing' ? 'syncing…' : status === 'error' ? (s.sync.error || 'error') : status;

    return `
      ${providerSelect}
      ${providerFields}
      ${autoRows}
      <div class="setting-row"><label class="toggle"><input type="checkbox" id="icloud-sync" ${settings.iCloudSync ? 'checked' : ''}><span class="toggle-slider"></span></label><span>Durable storage <span class="setting-hint">stop the browser evicting data</span></span></div>
      <div class="setting-row"><span class="setting-label">Status</span><span class="setting-value" id="sync-state">${escapeAttr(statusLabel)}${s.sync.lastSync ? ` • Last: ${new Date(s.sync.lastSync).toLocaleTimeString()}` : ''}</span></div>
      <div class="setting-actions">
        <button class="btn btn-primary btn-sm" id="sync-now" ${provider === 'none' ? 'disabled' : ''}>Sync Now</button>
        <button class="btn btn-ghost btn-sm" id="sync-test" ${provider === 'none' ? 'disabled' : ''}>Test Connection</button>
        <button class="btn btn-ghost btn-sm" id="export">Export</button>
        <button class="btn btn-ghost btn-sm" id="import">Import</button>
      </div>`;
  }

  private themeGrid(current: string): string {
    const free = getFreeThemes(); const pro = getProThemes();
    const custom = store.getState().themes.filter(t => t.isCustom);
    const category = (title: string, cards: string) =>
      `<div class="theme-category"><h4>${title}</h4><div class="theme-grid">${cards}</div></div>`;
    const isLight = (t: Theme) => t.variant === 'light';
    const darkFree = free.filter(t => !isLight(t));
    const lightFree = free.filter(isLight);
    let html = category('Dark', darkFree.map(t => this.themeCard(t, current)).join(''));
    if (lightFree.length) html += category('Light', lightFree.map(t => this.themeCard(t, current)).join(''));
    if (pro.length) html += category('Pro', pro.map(t => this.themeCard(t, current)).join(''));
    html += category('Custom',
      custom.map(t => this.themeCard(t, current, true)).join('') +
      `<button class="theme-card theme-new" id="new-theme"><span class="theme-new-plus">+</span><span>New Theme</span></button>`);
    return html;
  }

  private themeCard(t: Theme, current: string, custom = false): string {
    const c = t.colors;
    const badge = t.isPro ? '<span class="pro-badge">Pro</span>' : custom ? '<span class="pro-badge custom-badge">Custom</span>' : '';
    const swatches = [c.accent, c.accentAlt || c.accent, c.info || c.accent, c.success, c.warning]
      .map(col => `<span class="theme-swatch" style="background:${col}"></span>`).join('');
    return `<button class="theme-card ${t.id===current?'active':''} ${t.isPro?'pro':''}" data-theme="${t.id}" style="--card-bg:${c.bg};--card-fg:${c.fg};--card-accent:${c.accent}"><div class="theme-preview" style="background:${c.bg}">${swatches}</div><div class="theme-info"><span class="theme-name">${t.name}</span>${badge}</div>${custom?`<span class="theme-delete" data-del="${t.id}" title="Delete theme">✕</span>`:''}</button>`;
  }

  private bindEvents(user: any, settings: UserSettings) {
    this.c.querySelector('#signout')?.addEventListener('click', () => { if(confirm('Sign out?')) store.signOut(); });
    this.c.querySelector('#signin')?.addEventListener('click', () => this.showAuth('signin'));
    this.c.querySelector('#signup')?.addEventListener('click', () => this.showAuth('signup'));
    this.c.querySelector('#apple')?.addEventListener('click', () => store.signInWithApple().catch(()=>createToast('Apple sign in not configured','error')));
    this.c.querySelector('#sync-now')?.addEventListener('click', async () => {
      const btn = this.c.querySelector('#sync-now') as HTMLButtonElement;
      const original = btn.textContent;
      btn.disabled = true; btn.textContent = 'Syncing…';
      const res = await store.syncNow();
      btn.textContent = original; btn.disabled = false;
      createToast(res.message, res.ok ? 'success' : 'error');
      this.render();
    });
    this.c.querySelector('#sync-test')?.addEventListener('click', async () => {
      const res = await store.testSync();
      createToast(res.message, res.ok ? 'success' : 'error');
    });
    this.c.querySelector('#sync-provider')?.addEventListener('change', async e => {
      const provider = (e.target as HTMLSelectElement).value as SyncProviderId;
      await this.write({ provider });
      this.render(); // the provider changes which fields are shown
    });
    this.c.querySelector('#sync-pick-file')?.addEventListener('click', async () => {
      try {
        const name = await store.chooseSyncFile();
        if (name) { createToast(`Snapshot file: ${name}`, 'success'); await this.write({ provider: 'file' }); }
      } catch (err) { createToast(err instanceof Error ? err.message : String(err), 'error'); }
      this.render();
    });
    const davBind = (id: string, key: 'webdavUrl' | 'webdavUser' | 'webdavPassword' | 'webdavPath' | 'fileName') => {
      const el = this.c.querySelector(id) as HTMLInputElement | null;
      if (el) {
        el.addEventListener('input', e => {
          const value = (e.target as HTMLInputElement).value;
          void this.write({ [key]: value } as Partial<SyncConfig>);
        });
        el.addEventListener('change', e => {
          const value = (e.target as HTMLInputElement).value;
          void this.write({ [key]: value } as Partial<SyncConfig>);
        });
      }
    };
    davBind('#dav-url', 'webdavUrl');
    davBind('#dav-user', 'webdavUser');
    davBind('#dav-pass', 'webdavPassword');
    davBind('#dav-path', 'webdavPath');
    davBind('#dav-file', 'fileName');
    this.c.querySelector('#sync-auto')?.addEventListener('change', e => { void this.write({ autoSync: (e.target as HTMLInputElement).checked }); });
    this.c.querySelector('#sync-interval')?.addEventListener('change', e => { void this.write({ syncIntervalMin: parseInt((e.target as HTMLSelectElement).value) || 15 }); });
    this.c.querySelector('#sync-enabled')?.addEventListener('change', e => { void this.writeSettings({ syncEnabled: (e.target as HTMLInputElement).checked }); });
    this.c.querySelector('#export')?.addEventListener('click', async () => {
      const json = await store.exportData();
      try { await navigator.clipboard.writeText(json); } catch { /* clipboard may be blocked */ }
      try {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `habit_ctl-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        createToast('Backup downloaded (also copied)', 'success');
      } catch { createToast('Exported to clipboard', 'success'); }
    });
    this.c.querySelector('#import')?.addEventListener('click', () => { const input=document.createElement('input'); input.type='file'; input.accept='.json'; input.onchange=async e=>{const f=(e.target as HTMLInputElement).files?.[0]; if(f){const t=await f.text(); await store.importData(t); createToast('Imported','success');}}; input.click(); });
    this.c.querySelector('#clear')?.addEventListener('click', () => { if(confirm('Delete ALL data? This cannot be undone.')) { store.clearAllData(); createToast('Data cleared','success'); } });
    this.c.querySelectorAll('.theme-card[data-theme]').forEach(b=>b.addEventListener('click',()=>store.setTheme(b.getAttribute('data-theme')!)));
    this.c.querySelector('#new-theme')?.addEventListener('click', () => openThemeEditor());
    this.c.querySelectorAll('.theme-delete').forEach(b=>b.addEventListener('click', e=>{ e.stopPropagation(); const id=b.getAttribute('data-del')!; if(confirm('Delete this custom theme?')){ store.deleteCustomTheme(id); createToast('Theme deleted','info'); } }));
    this.c.querySelector('#install')?.addEventListener('click', async () => { const r = await promptInstall(); if (r === 'accepted') createToast('Installing…','success'); else if (r === 'dismissed') createToast('Install dismissed','info'); });
    this.c.querySelector('#notif-perm')?.addEventListener('click', async () => { const ok = await requestNotificationPermission(); createToast(ok?'Notifications enabled':'Notifications blocked','info'); this.render(); });
    this.c.querySelector('#icloud-sync')?.addEventListener('change', async e=>{ const on=(e.target as HTMLInputElement).checked; await store.updateSettings({iCloudSync:on}); if(on){ try{ const persisted = navigator.storage?.persist ? await navigator.storage.persist() : false; createToast(persisted?'Durable storage granted':'Kept data offline (browser may evict)','info'); }catch{ createToast('Could not request durable storage','warning'); } } });
    this.c.querySelector('#animations')?.addEventListener('change', e=>store.updateSettings({animations:(e.target as HTMLInputElement).checked}));
    this.c.querySelector('#matte')?.addEventListener('change', e=>store.updateSettings({matteMode:(e.target as HTMLInputElement).checked}));
    this.c.querySelector('#haptics')?.addEventListener('change', e=>store.updateSettings({hapticFeedback:(e.target as HTMLInputElement).checked}));
    this.c.querySelector('#week-start')?.addEventListener('change', e=>store.updateSettings({weekStartsOn:parseInt((e.target as HTMLSelectElement).value) as 0|1}));
    this.c.querySelector('#date-fmt')?.addEventListener('change', e=>store.updateSettings({dateFormat:(e.target as HTMLSelectElement).value as any}));
    this.c.querySelector('#time-fmt')?.addEventListener('change', e=>store.updateSettings({timeFormat:(e.target as HTMLSelectElement).value as any}));
    this.c.querySelector('#sort-by')?.addEventListener('change', e=>store.updateSettings({sortBy:((e.target as HTMLSelectElement).value || undefined) as any}));
    this.c.querySelector('#custom-css')?.addEventListener('input', e=>{ void this.writeSettings({customCSS:(e.target as HTMLTextAreaElement).value}); });
    this.c.querySelector('#passcode')?.addEventListener('change', e =>{
      const on = (e.target as HTMLInputElement).checked;
      if (on) {
        const code = prompt('Set a passcode (4+ characters). It will be required on next launch:');
        if (!code || code.length < 4) { (e.target as HTMLInputElement).checked = false; createToast('Passcode must be 4+ characters', 'warning'); return; }
        store.updateSettings({ passcodeEnabled: true, passcode: code });
        createToast('Passcode set', 'success');
      } else {
        store.updateSettings({ passcodeEnabled: false, passcode: undefined });
        createToast('Passcode removed', 'info');
      }
      this.render();
    });
    this.c.querySelector('#biometric')?.addEventListener('change', e=>store.updateSettings({biometricEnabled:(e.target as HTMLInputElement).checked}));
    this.c.querySelector('#vacation')?.addEventListener('change', e=>{
      const on = (e.target as HTMLInputElement).checked;
      if (on) {
        const s = store.getSettings();
        const start = s.vacationStartsAt || new Date().toISOString().slice(0, 10);
        const end = s.vacationEndsAt || new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
        void store.updateSettings({ vacationMode: true, vacationStartsAt: start, vacationEndsAt: end }).then(() => this.render());
      } else {
        void store.updateSettings({ vacationMode: false }).then(() => this.render());
      }
    });
    this.c.querySelector('#vacation-start')?.addEventListener('change', e=>{ void this.writeSettings({vacationStartsAt:(e.target as HTMLInputElement).value}); });
    this.c.querySelector('#vacation-end')?.addEventListener('change', e=>{ void this.writeSettings({vacationEndsAt:(e.target as HTMLInputElement).value}); });
  }

  private showAuth(mode: 'signin'|'signup') {
    const content = document.createElement('div'); content.className = 'auth-form';
    content.innerHTML = `<form id="auth-form"><div class="form-group"><label>Email</label><input type="email" id="auth-email" required autocomplete="email"></div><div class="form-group"><label>Password</label><input type="password" id="auth-pass" required autocomplete="current-password"></div>${mode==='signup'?`<div class="form-group"><label>Name</label><input type="text" id="auth-name" required></div>`:''}<div class="form-actions"><button type="submit" class="btn btn-primary" id="auth-submit">${mode==='signin'?'Sign In':'Sign Up'}</button></div></form>`;
    createModal(mode==='signin'?'Sign In':'Sign Up', content, ()=>{});
    const form = content.querySelector('#auth-form') as HTMLFormElement;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = (content.querySelector('#auth-email') as HTMLInputElement).value;
      const pass = (content.querySelector('#auth-pass') as HTMLInputElement).value;
      const btn = content.querySelector('#auth-submit') as HTMLButtonElement;
      const original = btn.textContent || 'Submit';
      btn.disabled = true; btn.textContent = 'Working…';
      try {
        if (mode === 'signin') await store.signIn(email, pass);
        else await store.signUp(email, pass, (content.querySelector('#auth-name') as HTMLInputElement).value);
        createToast('Success', 'success');
        document.querySelector('.modal-overlay')?.remove();
      } catch (err) {
        createToast(err instanceof Error ? err.message : String(err), 'error');
        btn.disabled = false; btn.textContent = original;
      }
    });
  }

  defaultSettings(): UserSettings { return { themeId: 'tokyo-night', syncEnabled: true, iCloudSync: false, animations: true, hapticFeedback: true, weekStartsOn: 0, dateFormat: 'YYYY-MM-DD', timeFormat: '24h', language: 'en', matteMode: false, passcodeEnabled: false, biometricEnabled: false, vacationMode: false }; }
}

export function createSettings(c: HTMLElement) { return new SettingsComponent(c); }

/** Escape a value for safe interpolation into an HTML attribute. */
function escapeAttr(value: string): string {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}