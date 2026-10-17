import { store } from '../stores/appStore';
import { UserSettings, Theme } from '../types';
import { THEMES, getTheme, getFreeThemes, getProThemes } from '../data/themes';
import { canInstall, promptInstall, onPwaChange } from '../services/pwa';
import { notificationPermission, requestNotificationPermission } from '../services/reminders';
import { openThemeEditor } from './ThemeEditor';
import { createTerminalBlock, createEmptyState, createModal, createToast, createProgressBar } from './TerminalUI';

export class SettingsComponent {
  private c: HTMLElement; private u: () => void; private up: () => void;
  constructor(c: HTMLElement) { this.c = c; this.u = store.subscribe(() => this.render()); this.up = onPwaChange(() => this.render()); this.render(); }
  destroy() { this.u(); this.up(); }
  render() {
    const s = store.getState(); const user = s.user; const settings = store.getSettings();
    const active = document.activeElement as HTMLInputElement | null;
    const activeId = active && this.c.contains(active) ? active.id : '';
    const selStart = activeId ? active!.selectionStart : null;
    this.c.innerHTML = '';
    const w = document.createElement('div'); w.className = 'settings-wrapper';
    const h = document.createElement('div'); h.className = 'settings-header';
    h.innerHTML = `<div class="settings-title"><span class="terminal-prompt">$</span><span class="settings-command">cat settings.txt</span></div>`;
    w.appendChild(h);

    // Account section
    w.appendChild(this.section('Account', user ? `
      <div class="setting-row"><span class="setting-label">Signed in as</span><span class="setting-value">${user.name} (${user.email})</span></div>
      <div class="setting-row"><span class="setting-label">Plan</span><span class="setting-value badge badge-${user.proTier==='free'?'info':user.proTier==='lifetime'?'success':'warning'}">${user.proTier}</span></div>
      <div class="setting-actions"><button class="btn btn-danger btn-sm" id="signout">Sign Out</button></div>
    ` : `
      <div class="setting-row"><span class="setting-label">Not signed in</span></div>
      <div class="setting-actions"><button class="btn btn-primary btn-sm" id="signin">Sign In</button><button class="btn btn-ghost btn-sm" id="signup">Sign Up</button><button class="btn btn-ghost btn-sm" id="apple">Continue with Apple</button></div>
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
    w.appendChild(this.section('Sync', `
      <div class="setting-row"><label class="toggle"><input type="checkbox" id="sync-enabled" ${settings.syncEnabled?'checked':''}><span class="toggle-slider"></span></label><span>Cloud Sync</span></div>
      <div class="setting-row"><label class="toggle"><input type="checkbox" id="icloud-sync" ${settings.iCloudSync?'checked':''}><span class="toggle-slider"></span></label><span>iCloud Backup</span></div>
      <div class="setting-row"><span class="setting-label">Status</span><span class="setting-value">${s.sync.status}${s.sync.lastSync?` • Last: ${new Date(s.sync.lastSync).toLocaleTimeString()}`:''}</span></div>
      <div class="setting-actions"><button class="btn btn-primary btn-sm" id="sync-now">Sync Now</button><button class="btn btn-ghost btn-sm" id="export">Export Data</button><button class="btn btn-ghost btn-sm" id="import">Import Data</button></div>
    `));

    // Appearance section
    w.appendChild(this.section('Appearance', `
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
      <div class="setting-row"><label class="toggle"><input type="checkbox" id="biometric" ${settings.biometricEnabled?'checked':''} ${!settings.passcodeEnabled?'disabled':''}><span class="toggle-slider"></span></label><span>Face ID / Touch ID</span></div>
      <div class="setting-row"><label class="toggle"><input type="checkbox" id="vacation" ${settings.vacationMode?'checked':''}><span class="toggle-slider"></span></label><span>Vacation Mode</span></div>
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

  private themeGrid(current: string): string {
    const free = getFreeThemes(); const pro = getProThemes();
    const custom = store.getState().themes.filter(t => t.isCustom);
    let html = '<div class="theme-category"><h4>Free</h4><div class="theme-grid">';
    free.forEach(t => html += this.themeCard(t, current));
    html += '</div></div><div class="theme-category"><h4>Pro</h4><div class="theme-grid">';
    pro.forEach(t => html += this.themeCard(t, current));
    html += '</div></div><div class="theme-category"><h4>Custom</h4><div class="theme-grid">';
    custom.forEach(t => html += this.themeCard(t, current, true));
    html += `<button class="theme-card theme-new" id="new-theme"><span class="theme-new-plus">+</span><span>New Theme</span></button>`;
    html += '</div></div>';
    return html;
  }

  private themeCard(t: Theme, current: string, custom = false): string {
    const c = t.colors;
    const badge = t.isPro ? '<span class="pro-badge">Pro</span>' : custom ? '<span class="pro-badge custom-badge">Custom</span>' : '';
    return `<button class="theme-card ${t.id===current?'active':''} ${t.isPro?'pro':''}" data-theme="${t.id}" style="--card-bg:${c.bg};--card-fg:${c.fg};--card-accent:${c.accent}"><div class="theme-preview" style="background:linear-gradient(135deg,${c.heatmap.level1},${c.heatmap.level3},${c.heatmap.level4})"></div><div class="theme-info"><span class="theme-name">${t.name}</span>${badge}</div>${custom?`<span class="theme-delete" data-del="${t.id}" title="Delete theme">✕</span>`:''}</button>`;
  }

  private bindEvents(user: any, settings: UserSettings) {
    this.c.querySelector('#signout')?.addEventListener('click', () => { if(confirm('Sign out?')) store.signOut(); });
    this.c.querySelector('#signin')?.addEventListener('click', () => this.showAuth('signin'));
    this.c.querySelector('#signup')?.addEventListener('click', () => this.showAuth('signup'));
    this.c.querySelector('#apple')?.addEventListener('click', () => store.signInWithApple().catch(()=>createToast('Apple sign in not configured','error')));
    this.c.querySelector('#sync-now')?.addEventListener('click', () => store.syncWithCloud());
    this.c.querySelector('#export')?.addEventListener('click', async () => { const json=await store.exportData(); navigator.clipboard.writeText(json); createToast('Exported to clipboard','success'); });
    this.c.querySelector('#import')?.addEventListener('click', () => { const input=document.createElement('input'); input.type='file'; input.accept='.json'; input.onchange=async e=>{const f=(e.target as HTMLInputElement).files?.[0]; if(f){const t=await f.text(); await store.importData(t); createToast('Imported','success');}}; input.click(); });
    this.c.querySelector('#clear')?.addEventListener('click', () => { if(confirm('Delete ALL data? This cannot be undone.')) { store.clearAllData(); createToast('Data cleared','success'); } });
    this.c.querySelectorAll('.theme-card[data-theme]').forEach(b=>b.addEventListener('click',()=>store.setTheme(b.getAttribute('data-theme')!)));
    this.c.querySelector('#new-theme')?.addEventListener('click', () => openThemeEditor());
    this.c.querySelectorAll('.theme-delete').forEach(b=>b.addEventListener('click', e=>{ e.stopPropagation(); const id=b.getAttribute('data-del')!; if(confirm('Delete this custom theme?')){ store.deleteCustomTheme(id); createToast('Theme deleted','info'); } }));
    this.c.querySelector('#install')?.addEventListener('click', async () => { const r = await promptInstall(); if (r === 'accepted') createToast('Installing…','success'); else if (r === 'dismissed') createToast('Install dismissed','info'); });
    this.c.querySelector('#notif-perm')?.addEventListener('click', async () => { const ok = await requestNotificationPermission(); createToast(ok?'Notifications enabled':'Notifications blocked','info'); this.render(); });
    this.c.querySelector('#sync-enabled')?.addEventListener('change', e=>store.updateSettings({syncEnabled:(e.target as HTMLInputElement).checked}));
    this.c.querySelector('#icloud-sync')?.addEventListener('change', async e=>{ const on=(e.target as HTMLInputElement).checked; await store.updateSettings({iCloudSync:on}); if(on){ try{ const persisted = navigator.storage?.persist ? await navigator.storage.persist() : false; createToast(persisted?'Durable storage granted':'Kept data offline (browser may evict)','info'); }catch{ createToast('Could not request durable storage','warning'); } } });
    this.c.querySelector('#animations')?.addEventListener('change', e=>store.updateSettings({animations:(e.target as HTMLInputElement).checked}));
    this.c.querySelector('#haptics')?.addEventListener('change', e=>store.updateSettings({hapticFeedback:(e.target as HTMLInputElement).checked}));
    this.c.querySelector('#week-start')?.addEventListener('change', e=>store.updateSettings({weekStartsOn:parseInt((e.target as HTMLSelectElement).value) as 0|1}));
    this.c.querySelector('#date-fmt')?.addEventListener('change', e=>store.updateSettings({dateFormat:(e.target as HTMLSelectElement).value as any}));
    this.c.querySelector('#time-fmt')?.addEventListener('change', e=>store.updateSettings({timeFormat:(e.target as HTMLSelectElement).value as any}));
    this.c.querySelector('#sort-by')?.addEventListener('change', e=>store.updateSettings({sortBy:((e.target as HTMLSelectElement).value || undefined) as any}));
    this.c.querySelector('#custom-css')?.addEventListener('input', e=>store.updateSettings({customCSS:(e.target as HTMLTextAreaElement).value}));
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
    this.c.querySelector('#vacation')?.addEventListener('change', e=>store.updateSettings({vacationMode:(e.target as HTMLInputElement).checked}));
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

  defaultSettings(): UserSettings { return { themeId: 'tokyo-night', syncEnabled: true, iCloudSync: false, animations: true, hapticFeedback: true, weekStartsOn: 0, dateFormat: 'YYYY-MM-DD', timeFormat: '24h', language: 'en', passcodeEnabled: false, biometricEnabled: false, vacationMode: false }; }
}

export function createSettings(c: HTMLElement) { return new SettingsComponent(c); }