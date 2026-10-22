import { store } from '../stores/appStore';
import { createHabitList } from './HabitList';
import { createHeatmap } from './Heatmap';
import { createRoutines } from './Routines';
import { createStats } from './Stats';
import { createSettings } from './Settings';
import { createTerminalPrompt, createToast, createModal } from './TerminalUI';
import { createWidgetRail } from './Widgets';
import { openHabitForm } from './HabitForm';
import { createAppearancePicker } from './appearancePicker';
import { formatDate } from '../utils/date';
import { openCommandPalette } from './CommandPalette';

export class App {
  private root: HTMLElement;
  private habitList: any; private heatmap: any; private routines: any; private stats: any; private settings: any;
  private rail: any;
  private unsubscribe: () => void;
  private currentView: 'list' | 'heatmap' | 'routines' | 'stats' | 'settings' = 'list';
  private unlocked = false;
  private lockEvaluated = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.unsubscribe = store.subscribe(state => this.onStateChange(state));
    this.render();
    this.bindGlobalEvents();
  }

  destroy() { this.unsubscribe(); this.habitList?.destroy(); this.heatmap?.destroy(); this.routines?.destroy(); this.stats?.destroy(); this.settings?.destroy(); this.rail?.destroy(); }

  private onStateChange(state: any) {
    if (state.view !== this.currentView) {
      this.currentView = state.view;
      this.switchView(state.view);
    }
  }

  private render() {
    this.root.innerHTML = `
      <div class="app">
        <div class="top-progress" aria-hidden="true"><div class="top-progress-fill" id="top-progress-fill"></div></div>
        <div class="vacation-banner" id="vacation-banner" hidden>🌴 Vacation mode active — streaks paused</div>
        <header class="app-header">
          <div class="header-left">
            <span class="app-title">habit_ctl</span>
            <span class="app-version">v1.0.0</span>
            <span class="blk-cursor" aria-hidden="true"></span>
          </div>
          <nav class="app-nav" role="tablist">
            <button class="nav-btn active" data-view="list" role="tab" aria-selected="true">📋 List</button>
            <button class="nav-btn" data-view="heatmap" role="tab" aria-selected="false">📊 Heatmap</button>
            <button class="nav-btn" data-view="routines" role="tab" aria-selected="false">📋 Routines</button>
            <button class="nav-btn" data-view="stats" role="tab" aria-selected="false">📈 Stats</button>
            <button class="nav-btn" data-view="settings" role="tab" aria-selected="false">⚙ Settings</button>
          </nav>
          <div class="header-right">
            <div class="date-nav">
              <button class="btn btn-ghost btn-sm" id="prev-date" aria-label="Previous day">‹</button>
              <span class="current-date" id="current-date"></span>
              <button class="btn btn-ghost btn-sm" id="next-date" aria-label="Next day">›</button>
              <button class="btn btn-ghost btn-sm" id="today-date" aria-label="Today">Today</button>
            </div>
            <button class="btn btn-primary" id="add-habit">+ Habit</button>
          </div>
        </header>
        <div class="app-body">
          <aside class="widget-rail" id="widget-rail" aria-label="Dashboard widgets"></aside>
          <main class="app-main" id="app-main"></main>
        </div>
        <footer class="app-footer">
          <div class="footer-left"><span class="terminal-prompt">$</span><span id="footer-hint">j/k navigate • Space toggle • a add • h heatmap • r routines • s stats • , settings</span></div>
          <div class="footer-progress" id="footer-progress" aria-live="polite"></div>
          <div class="footer-right" id="sync-status"></div>
        </footer>
      </div>
    `;
    this.switchView(this.currentView);
    this.rail = createWidgetRail(this.root.querySelector('#widget-rail') as HTMLElement);
    this.bindHeaderEvents();
    this.applyUiSettings();
  }

  private switchView(view: string) {
    const main = this.root.querySelector('#app-main') as HTMLElement;
    main.innerHTML = '';
    
    // Update nav buttons
    this.root.querySelectorAll('.nav-btn').forEach(btn => {
      const isActive = btn.getAttribute('data-view') === view;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });

    switch (view) {
      case 'list':
        this.habitList?.destroy(); this.habitList = createHabitList(main); break;
      case 'heatmap':
        this.heatmap?.destroy(); this.heatmap = createHeatmap(main); break;
      case 'routines':
        this.routines?.destroy(); this.routines = createRoutines(main); break;
      case 'stats':
        this.stats?.destroy(); this.stats = createStats(main); break;
      case 'settings':
        this.settings?.destroy(); this.settings = createSettings(main); break;
    }
    this.currentView = view as any;
  }

  private bindHeaderEvents() {
    this.root.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => store.setView(btn.getAttribute('data-view')! as any)));
    this.root.querySelector('#prev-date')?.addEventListener('click', () => store.navigateDate('prev'));
    this.root.querySelector('#next-date')?.addEventListener('click', () => store.navigateDate('next'));
    this.root.querySelector('#today-date')?.addEventListener('click', () => store.goToToday());
    this.root.querySelector('#add-habit')?.addEventListener('click', () => this.showHabitForm());
  }

  private bindGlobalEvents() {
    window.addEventListener('show-habit-form', () => this.showHabitForm());
    window.addEventListener('show-routine-form', (e: any) => this.showRoutineForm(e.detail));
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { document.querySelector('.modal-overlay')?.remove(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCommandPalette(); return; }
      const t = e.target as HTMLElement;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t.isContentEditable) return;
      if ((e.key === ' ' || e.key === 'Enter') && t instanceof HTMLButtonElement) return;
      switch (e.key.toLowerCase()) {
        case 'j': e.preventDefault(); store.navigateDate('next'); break;
        case 'k': e.preventDefault(); store.navigateDate('prev'); break;
        case 'h': e.preventDefault(); store.setView('heatmap'); break;
        case 'r': e.preventDefault(); store.setView('routines'); break;
        case 's': e.preventDefault(); store.setView('stats'); break;
        case ',': e.preventDefault(); store.setView('settings'); break;
        case 'a': case 'n': e.preventDefault(); this.showHabitForm(); break;
        case '/': e.preventDefault(); this.focusSearch(); break;
        case '?': e.preventDefault(); this.showShortcuts(); break;
        case 'l': e.preventDefault(); store.setView('list'); break;
        case ' ': case 'enter': e.preventDefault(); this.toggleSelectedHabit(); break;
        default:
          if (e.key >= '1' && e.key <= '9') { e.preventDefault(); window.dispatchEvent(new CustomEvent('select-habit-index', { detail: parseInt(e.key, 10) - 1 })); }
          break;
      }
    });

    // Update date display when store changes
    store.subscribe(() => this.applyUiSettings());
  }

  /** Apply appearance + privacy settings that are driven by the store. */
  private applyUiSettings() {
    const s = store.getSettings();
    document.body.classList.toggle('no-animations', !s.animations);
    const banner = this.root.querySelector('#vacation-banner') as HTMLElement | null;
    if (banner) banner.hidden = !s.vacationMode;
    this.applyCustomCss(s.customCSS || '');
    this.updateDateDisplay();
    this.updateProgress();
    this.updateSyncStatus();
    this.maybeLock();
  }

  /** Top-edge reading bar + footer ASCII bar, both driven by today's completion. */
  private updateProgress(): void {
    const { done, total, pct } = store.todayProgress();
    const top = this.root.querySelector('#top-progress-fill') as HTMLElement | null;
    if (top) {
      top.style.width = `${(pct * 100).toFixed(1)}%`;
      top.parentElement?.classList.toggle('is-complete', pct >= 1 && total > 0);
    }
    const fp = this.root.querySelector('#footer-progress') as HTMLElement | null;
    if (fp) {
      const cells = 10;
      const filled = Math.round(pct * cells);
      const bar = '▓'.repeat(filled) + '░'.repeat(cells - filled);
      const label = total ? `${done}/${total}` : 'no habits';
      fp.innerHTML = `<span class="fp-label">today</span><span class="fp-bar">[${bar}]</span><span class="fp-pct">${Math.round(pct * 100)}% <span class="fp-count">${label}</span></span>`;
      fp.classList.toggle('is-complete', pct >= 1 && total > 0);
    }
  }

  private applyCustomCss(css: string): void {
    let styleEl = document.getElementById('habit-custom-css') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'habit-custom-css';
      document.head.appendChild(styleEl);
    }
    if (styleEl.textContent !== css) styleEl.textContent = css;
  }

  private maybeLock() {
    if (this.lockEvaluated || !store.isReady()) return;
    this.lockEvaluated = true;
    const s = store.getSettings();
    if (s.passcodeEnabled && s.passcode && !this.unlocked) this.showLock();
  }

  private showLock() {
    if (document.querySelector('.lock-overlay')) return;
    const o = document.createElement('div');
    o.className = 'lock-overlay';
    o.innerHTML = `<div class="lock-box"><div class="lock-title">🔒 Locked</div><div class="lock-sub">Enter passcode</div><input type="password" id="lock-input" inputmode="numeric" maxlength="8" autocomplete="off"><div class="lock-error" id="lock-error"></div></div>`;
    document.body.appendChild(o);
    const input = o.querySelector('#lock-input') as HTMLInputElement;
    const err = o.querySelector('#lock-error') as HTMLElement;
    input.focus();
    const tryUnlock = () => {
      if (input.value === store.getSettings().passcode) { this.unlocked = true; o.remove(); }
      else { err.textContent = 'Incorrect passcode'; input.value = ''; }
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); tryUnlock(); } });
    input.addEventListener('input', () => { if (input.value.length >= (store.getSettings().passcode || '').length) tryUnlock(); });
  }

  private updateDateDisplay() {
    const state = store.getState();
    const dateEl = this.root.querySelector('#current-date');
    if (dateEl) {
      const d = new Date(state.selectedDate + 'T00:00:00');
      const today = new Date(); today.setHours(0,0,0,0);
      const isToday = d.getTime() === today.getTime();
      const label = formatDate(d, store.getSettings().dateFormat);
      dateEl.innerHTML = isToday ? `<strong>Today</strong> ${label}` : label;
    }
  }

  private updateSyncStatus() {
    const state = store.getState();
    const el = this.root.querySelector('#sync-status');
    if (el) {
      const icons = { idle: '☁', syncing: '⟳', error: '⚠', offline: '⛓' };
      el.innerHTML = `<span class="sync-status ${state.sync.status}">${icons[state.sync.status]}${state.sync.pendingChanges?` ${state.sync.pendingChanges}`:''}</span>`;
    }
  }

  private toggleSelectedHabit() {
    const state = store.getState();
    const habits = state.habits.filter((h: any) => !h.archivedAt && store.isHabitScheduledOn(h, state.selectedDate));
    if (habits.length === 0) return;
    const today = state.selectedDate;
    for (const h of habits) {
      const c = state.completions.find((x: any) => x.habitId === h.id && x.date === today);
      const done = h.mode === 'checkbox' ? !!c : (c && c.value >= h.target);
      if (!done) { store.completeHabit(h.id, today); store.haptic(); break; }
    }
  }

  private showHabitForm() { openHabitForm(); }

  private focusSearch() {
    if (store.getState().view !== 'list') store.setView('list');
    requestAnimationFrame(() => {
      const input = this.root.querySelector('#habit-search') as HTMLInputElement | null;
      input?.focus();
    });
  }

  private showShortcuts() {
    const rows: [string, string][] = [
      ['n / a', 'New habit'],
      ['/', 'Focus search (list view)'],
      ['1–9', 'Select habit by position'],
      ['space / enter', 'Complete next due habit'],
      ['j / k', 'Next / previous day'],
      ['l / h', 'List / Heatmap view'],
      ['r / s', 'Routines / Stats view'],
      [',', 'Settings'],
      ['?', 'This help'],
      ['esc', 'Close dialog'],
    ];
    const content = document.createElement('div');
    content.className = 'shortcuts';
    content.innerHTML = `<div class="shortcuts-grid">${rows.map(([k, d]) => `<div class="sc-key"><kbd>${k}</kbd></div><div class="sc-desc">${d}</div>`).join('')}</div>`;
    createModal('Keyboard Shortcuts', content, () => {});
  }

  private showRoutineForm(routine?: any) {
    const content = document.createElement('div'); content.className = 'routine-form';
    const picker = createAppearancePicker({
      icon: routine?.icon ?? '',
      color: routine?.color ?? '#7aa2f7',
      textColor: routine?.textColor,
      textColorMode: routine?.textColorMode,
    }, { colorLabel: 'Colour', defaultIcon: 'tabler:target' });

    content.innerHTML = `
      <div class="form-group"><label>Name</label><input type="text" id="r-name" value="${routine?.name||''}" required placeholder="e.g., Morning Routine"></div>
    `;
    content.appendChild(picker.el);
    content.insertAdjacentHTML('beforeend', `
      <div class="form-group"><label>Schedule</label><select id="r-sched"><option value="daily" ${routine?.schedule?.type==='daily'?'selected':''}>Daily</option><option value="weekdays" ${routine?.schedule?.type==='weekdays'?'selected':''}>Weekdays</option><option value="custom" ${routine?.schedule?.type==='custom'?'selected':''}>Custom</option></select></div>
      <div class="form-group" id="r-custom-days" style="display:${routine?.schedule?.type==='custom'?'block':'none'}"><label>Days</label><div class="day-checkboxes">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i)=>`<label><input type="checkbox" value="${i}" ${routine?.schedule?.days?.includes(i)?'checked':''}> ${d}</label>`).join('')}</div></div>
      <div class="form-group"><label>Habits</label><div id="r-habits" class="habit-checkboxes">${store.getState().habits.filter((h:any)=>!h.archivedAt).map(h=>`<label><input type="checkbox" value="${h.id}" ${routine?.habitIds?.includes(h.id)?'checked':''}> ${h.name}</label>`).join('')}</div></div>
      <div class="form-actions"><button class="btn btn-ghost" id="r-cancel">Cancel</button><button class="btn btn-primary" id="r-save">${routine?'Save':'Create'}</button></div>
    `);
    const modal = createModal(routine?'Edit Routine':'New Routine', content, () => {});
    content.querySelector('#r-sched')?.addEventListener('change', e => { (content.querySelector('#r-custom-days') as HTMLElement).style.display = (e.target as HTMLSelectElement).value==='custom'?'block':'none'; });
    content.querySelector('#r-cancel')?.addEventListener('click', () => document.querySelector('.modal-overlay')?.remove());
    content.querySelector('#r-save')?.addEventListener('click', async () => {
      const name = (content.querySelector('#r-name') as HTMLInputElement).value.trim();
      if (!name) return;
      const schedType = (content.querySelector('#r-sched') as HTMLSelectElement).value as any;
      let schedule: any = { type: schedType };
      if (schedType === 'custom') { const days = Array.from(content.querySelectorAll('#r-custom-days input:checked')).map(cb => parseInt((cb as HTMLInputElement).value)); schedule.days = days; }
      const habitIds = Array.from(content.querySelectorAll('#r-habits input:checked')).map(cb => (cb as HTMLInputElement).value);
      const appearance = picker.getValue();
      if (routine) { await store.updateRoutine({ ...routine, name, ...appearance, schedule, habitIds }); }
      else { await store.createRoutine({ name, ...appearance, schedule, habitIds }); }
      document.querySelector('.modal-overlay')?.remove();
      createToast(routine?'Routine updated':'Routine created', 'success');
    });
  }
}

export function createApp(root: HTMLElement) { return new App(root); }