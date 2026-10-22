import { store } from '../stores/appStore';
import { Habit, Completion, HabitMode } from '../types';
import { getTodayString, formatDateString } from '../utils/date';
import { createProgressBar, createEmptyState, createToast } from './TerminalUI';
import { openHabitForm } from './HabitForm';
import { renderHabitLogo } from './habitLogo';

function fmtMMSS(totalSec: number): string {
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export class HabitListComponent {
  private container: HTMLElement;
  private unsubscribe: () => void;
  private selectedId: string | null = null;
  private timerId?: number;
  private timerHabitId?: string;
  private timerStart = 0;
  private restoreSearchFocus = false;
  private onSelectIndex: (e: Event) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.onSelectIndex = (e: Event) => {
      const idx = (e as CustomEvent).detail as number;
      const habits = store.getFilteredHabits();
      const h = habits[idx];
      if (h) { this.selectedId = h.id; this.render(); }
    };
    window.addEventListener('select-habit-index', this.onSelectIndex);
    this.unsubscribe = store.subscribe(() => this.render());
    this.render();
  }

  destroy() { this.unsubscribe(); if (this.timerId) clearInterval(this.timerId); window.removeEventListener('select-habit-index', this.onSelectIndex); }

  render() {
    const state = store.getState();
    const habits = store.getFilteredHabits();
    const selectedDate = state.selectedDate;
    const today = getTodayString();
    const canLog = selectedDate <= today;

    this.container.innerHTML = '';

    if (state.habits.length === 0) {
      this.container.appendChild(createEmptyState('📋', 'No habits yet', 'Create your first habit', { label: 'Add Habit', onClick: () => openHabitForm() }));
      return;
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'habit-toolbar';
    toolbar.innerHTML = `
      <input type="search" id="habit-search" class="habit-search" placeholder="search habits…" value="${state.searchQuery.replace(/"/g, '&quot;')}">
      <div class="filter-chips">${(['all', 'today', 'active', 'archived'] as const).map(f => `<button class="chip ${state.filterMode === f ? 'active' : ''}" data-f="${f}">${f}</button>`).join('')}</div>
    `;
    toolbar.querySelector('#habit-search')?.addEventListener('input', e => { this.restoreSearchFocus = true; store.setSearchQuery((e.target as HTMLInputElement).value); });
    toolbar.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => store.setFilterMode(b.getAttribute('data-f') as any)));
    this.container.appendChild(toolbar);

    if (habits.length === 0) {
      this.container.appendChild(createEmptyState('🔍', 'No matches', 'Try a different filter or search'));
    } else {
      const list = document.createElement('div'); list.className = 'habit-list';
      habits.forEach((h: Habit) => list.appendChild(this.createItem(h, canLog, selectedDate)));
      this.container.appendChild(list);
      // Daily progress for today's scheduled habits (under the list)
      const today = getTodayString();
      const sched = store.getState().habits.filter(h => !h.archivedAt && store.isHabitScheduledOn(h, today));
      let done = 0;
      for (const h of sched) {
        const c = store.getState().completions.find(x => x.habitId === h.id && x.date === today);
        const isDone = h.mode === 'checkbox' ? !!c : !!(c && c.value >= h.target);
        if (isDone) done++;
      }
      const total = sched.length;
      const pct = total ? done / total : 0;
      const cells = 10;
      const filled = Math.min(cells, Math.round(pct * cells));
      const showCursor = pct < 1;
      const empty = Math.max(0, cells - filled - (showCursor ? 1 : 0));
      const bar = `<div class="list-progress" aria-live="polite"><span class="list-prompt"><span class="terminal-prompt">$</span> habits --today</span><span class="list-bar">[${'█'.repeat(filled)}${showCursor ? '<span class="cb-cursor">█</span>' : ''}${'░'.repeat(empty)}]</span><span class="list-pct">${Math.round(pct * 100)}% <span class="list-count">${done}/${total}</span></span></div>`;
      const wrap = document.createElement('div');
      wrap.className = 'list-progress-wrap';
      wrap.innerHTML = bar;
      this.container.appendChild(wrap);
    }

    if (this.restoreSearchFocus) {
      const inp = this.container.querySelector('#habit-search') as HTMLInputElement | null;
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      this.restoreSearchFocus = false;
    }
  }

  private createItem(h: Habit, canLog: boolean, date: string): HTMLElement {
    const state = store.getState();
    const cs = state.completions.filter((c: Completion) => c.habitId === h.id);
    const c = cs.find(x => x.date === date);
    const streak = store.getHabitStreak(h.id);
    const shields = store.getHabitShields(h.id).filter(s => !s.usedAt).length;
    const isSelected = this.selectedId === h.id;
    const archived = !!h.archivedAt;
    const scheduled = store.isHabitScheduledOn(h, date);
    const routine = state.routines.find(r => r.habitIds.includes(h.id));
    const done = h.mode === 'checkbox' ? !!c : !!(c && c.value >= h.target);
    const progress = h.mode === 'checkbox' ? (done ? 100 : 0) : c ? Math.min(100, (c.value / h.target) * 100) : 0;
    const labels: Record<HabitMode, string> = { checkbox: 'CHECK', counter: 'COUNT', number: 'NUM', timer: 'TIMER', health: 'HEALTH' };

    const el = document.createElement('div');
    el.className = `habit-item ${isSelected ? 'selected' : ''} ${done ? 'completed' : ''} ${archived ? 'archived' : ''} ${!scheduled && !archived ? 'off-day' : ''}`;
    el.dataset.habitId = h.id;
    const offDayNote = !scheduled && !archived ? '<span class="habit-offday">off-day</span>' : '';
    const routineBadge = routine ? `<span class="habit-routine-badge" style="color:${routine.color};border-color:${routine.color}">${routine.icon} ${routine.name}</span>` : '';
    const showProgress = h.mode !== 'checkbox' && h.mode !== 'timer' && h.mode !== 'health';
    const logo = renderHabitLogo(h, 18);
    el.innerHTML = `<div class="habit-main"><div class="habit-indicator"><span class="habit-mode-icon" style="color:${h.color}">${logo}</span>${shields > 0 ? `<span class="habit-shield-badge">${shields}🛡</span>` : ''}</div><div class="habit-info"><div class="habit-header"><span class="habit-name">${h.name}</span><span class="habit-mode-badge">${labels[h.mode]}</span>${routineBadge}${offDayNote}</div><div class="habit-meta"><span class="habit-streak">🔥 ${streak.current}${streak.isActive ? '' : ' (idle)'}</span><span class="habit-target">${this.getTarget(h, c)}</span></div>${showProgress ? `<div class="habit-progress">${createProgressBar(progress, 100, h.color).outerHTML}</div>` : ''}</div><div class="habit-actions">${this.getActions(h, done, c, date, canLog, archived)}</div></div>${isSelected ? this.getDetail(h, cs, streak, shields) : ''}`;

    el.querySelector('.habit-main')?.addEventListener('click', e => { if (!(e.target as HTMLElement).closest('.habit-actions')) { this.selectedId = isSelected ? null : h.id; this.render(); } });
    this.wireActions(el, h, done, date, canLog, archived);
    return el;
  }

  private wireActions(el: HTMLElement, h: Habit, done: boolean, date: string, canLog: boolean, archived: boolean) {
    const stop = (fn?: () => void) => (e: Event) => { e.stopPropagation(); fn?.(); };
    el.querySelector('.btn-edit')?.addEventListener('click', stop(() => openHabitForm(h)));
    el.querySelector('.btn-delete')?.addEventListener('click', stop(() => { if (confirm(`Delete "${h.name}" and all its history?`)) { store.deleteHabit(h.id); createToast('Habit deleted', 'info'); } }));
    el.querySelector('.btn-archive')?.addEventListener('click', stop(() => { store.toggleHabitArchive(h.id); }));
    el.querySelector('.btn-unarchive')?.addEventListener('click', stop(() => { store.toggleHabitArchive(h.id); }));
    if (!canLog || archived) return;
    el.querySelector('.btn-complete')?.addEventListener('click', stop(() => this.doComplete(h, date)));
    el.querySelector('.btn-uncomplete')?.addEventListener('click', stop(() => this.doUncomplete(h, date)));
    el.querySelector('.btn-increment')?.addEventListener('click', stop(() => { store.completeHabit(h.id, date, 1); store.haptic(); }));
    el.querySelector('.btn-decrement')?.addEventListener('click', stop(() => store.uncompleteHabit(h.id, date)));
    el.querySelector('.btn-timer-start')?.addEventListener('click', stop(() => this.startTimer(h, date)));
    el.querySelector('.btn-timer-stop')?.addEventListener('click', stop(() => this.stopTimer(h, date)));
  }

  private getActions(h: Habit, done: boolean, c: Completion | undefined, date: string, canLog: boolean, archived: boolean): string {
    if (archived) return `<button class="btn btn-ghost btn-sm btn-unarchive">Restore</button><button class="btn btn-ghost btn-sm btn-delete">Delete</button>`;
    if (!canLog) return `<span class="habit-future">future</span>`;
    switch (h.mode) {
      case 'checkbox': return done ? `<button class="btn btn-ghost btn-sm btn-uncomplete">✓ Undo</button>` : `<button class="btn btn-primary btn-sm btn-complete">☐ Done</button>`;
      case 'counter': case 'number': case 'health': return `<div class="counter-controls"><button class="btn btn-ghost btn-sm btn-decrement">−</button><span class="counter-value">${c?.value || 0}/${h.target}</span><button class="btn btn-ghost btn-sm btn-increment">+</button></div>`;
      case 'timer': return this.timerActions(h, done);
      default: return '';
    }
  }

  private timerActions(h: Habit, done: boolean): string {
    if (this.timerHabitId === h.id) {
      return `<button class="btn btn-danger btn-sm btn-timer-stop">⏹ <span class="timer-elapsed">00:00</span></button>`;
    }
    if (done) return `<button class="btn btn-ghost btn-sm btn-uncomplete">✓ Undo</button>`;
    return `<button class="btn btn-primary btn-sm btn-timer-start">▶ Start</button>`;
  }

  private startTimer(h: Habit, date: string) {
    if (this.timerId) clearInterval(this.timerId);
    this.timerHabitId = h.id;
    this.timerStart = Date.now();
    this.render();
    const targetSec = Math.max(1, h.target) * 60;
    this.timerId = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.timerStart) / 1000);
      const node = this.container.querySelector('.habit-item.selected .timer-elapsed, .habit-item .timer-elapsed');
      if (node) node.textContent = fmtMMSS(elapsed);
      if (elapsed >= targetSec) { this.finishTimer(h, date, Math.round(targetSec / 60), true); }
    }, 250);
  }

  private stopTimer(h: Habit, date: string) {
    const elapsedMin = Math.max(1, Math.round((Date.now() - this.timerStart) / 60000));
    this.finishTimer(h, date, elapsedMin, false);
  }

  private finishTimer(h: Habit, date: string, minutes: number, auto: boolean) {
    if (this.timerId) { clearInterval(this.timerId); this.timerId = undefined; }
    this.timerHabitId = undefined;
    store.completeHabit(h.id, date, minutes);
    store.haptic(20);
    createToast(auto ? `⏱ ${h.name} complete — ${minutes} min` : `Logged ${minutes} min of ${h.name}`, 'success');
    this.render();
  }

  private getDetail(h: Habit, cs: Completion[], streak: any, shields: number): string {
    const recent = [...cs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
    const df = store.getSettings().dateFormat;
    return `<div class="habit-detail"><div class="habit-detail-section"><h4>Streak</h4><div class="streak-info"><span>Current: ${streak.current}d</span><span>Longest: ${streak.longest}d</span><span>Total: ${streak.total}</span><span>Shields: ${shields}</span></div></div><div class="habit-detail-section"><h4>Recent</h4><div class="completion-history">${recent.length ? recent.map(x => `<div class="completion-entry"><span>${formatDateString(x.date, df)}</span><span>${h.mode === 'checkbox' ? '✓' : x.value + (h.unit ? ' ' + h.unit : '')}</span></div>`).join('') : '<span class="no-completions">None</span>'}</div></div><div class="habit-detail-actions"><button class="btn btn-ghost btn-sm btn-edit" data-id="${h.id}">Edit</button><button class="btn btn-ghost btn-sm btn-delete" data-id="${h.id}">Delete</button><button class="btn btn-ghost btn-sm btn-archive" data-id="${h.id}">Archive</button></div></div>`;
  }

  private getTarget(h: Habit, c: Completion | undefined): string { const v = c?.value || 0; switch (h.mode) { case 'checkbox': return c ? '✓ Done' : 'Pending'; case 'counter': case 'number': case 'health': return `${v}/${h.target}${h.unit ? ' ' + h.unit : ''}`; case 'timer': return c ? `✓ ${c.value} min` : 'Not started'; } return ''; }
  private async doComplete(h: Habit, d: string) { if (h.mode === 'checkbox') { await store.completeHabit(h.id, d); store.haptic(); } }
  private async doUncomplete(h: Habit, d: string) { await store.uncompleteHabit(h.id, d); store.haptic(); }
}

export function createHabitList(c: HTMLElement) { return new HabitListComponent(c); }
