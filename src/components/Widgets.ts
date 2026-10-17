import { store } from '../stores/appStore';
import { getTodayString, getDateString, addDays } from '../utils/date';
import { createToast } from './TerminalUI';

const DAYS_BACK = 30;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

const MOODS: { key: string; emoji: string; label: string }[] = [
  { key: 'great', emoji: '😄', label: 'Great' },
  { key: 'good', emoji: '🙂', label: 'Good' },
  { key: 'ok', emoji: '😐', label: 'OK' },
  { key: 'low', emoji: '😕', label: 'Low' },
  { key: 'bad', emoji: '😢', label: 'Bad' },
];

export class WidgetRail {
  private root: HTMLElement;
  private unsub: () => void;
  private tip: HTMLElement;
  private focusTimer?: number;
  private focus = { mode: 'focus' as 'focus' | 'break', remaining: 25 * 60, running: false };
  private energyTimer?: number;
  private energy = { remaining: 5 * 60, running: false, preset: 5 };
  private batchSel = new Set<string>();

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.className = 'widget-rail';
    this.root.innerHTML = `
      <div class="widget" id="w-progress"></div>
      <div class="widget" id="w-streaks"></div>
      <div class="widget" id="w-heatmap"></div>
      <div class="widget" id="w-focus"></div>
      <div class="widget" id="w-energy"></div>
      <div class="widget" id="w-mood"></div>
      <div class="widget" id="w-water"></div>
      <div class="widget" id="w-batch"></div>
      <div class="widget" id="w-capture"></div>
      <div class="widget" id="w-neofetch"></div>
    `;

    this.tip = document.createElement('div');
    this.tip.className = 'gh-tip';
    this.tip.style.display = 'none';
    document.body.appendChild(this.tip);

    this.root.addEventListener('mouseover', this.onTipEnter);
    this.root.addEventListener('mouseout', this.onTipLeave);
    this.root.addEventListener('mousemove', this.onTipMove);
    this.root.addEventListener('click', this.onClick);
    this.root.addEventListener('keydown', this.onKeyDown);

    this.buildFocus();
    this.buildEnergy();
    this.buildCapture();
    this.update();
    this.unsub = store.subscribe(() => this.update());
  }

  destroy(): void {
    this.unsub();
    this.root.removeEventListener('mouseover', this.onTipEnter);
    this.root.removeEventListener('mouseout', this.onTipLeave);
    this.root.removeEventListener('mousemove', this.onTipMove);
    this.root.removeEventListener('click', this.onClick);
    this.root.removeEventListener('keydown', this.onKeyDown);
    this.tip.remove();
    if (this.focusTimer) clearInterval(this.focusTimer);
    if (this.energyTimer) clearInterval(this.energyTimer);
  }

  /* ── Delegated events ────────────────────────────────────── */
  private onClick = (e: Event): void => {
    const target = (e.target as HTMLElement).closest?.('[data-act]') as HTMLElement | null;
    if (!target) return;
    const act = target.dataset.act as string;
    switch (act) {
      case 'water-inc': store.adjustWater(1); store.haptic(); break;
      case 'water-dec': store.adjustWater(-1); store.haptic(); break;
      case 'mood': store.logMood(target.dataset.mood as string); store.haptic(); break;
      case 'note-add': this.addNote(); break;
      case 'note-del': store.deleteNote(target.dataset.id as string); break;
      case 'focus-toggle': this.toggleFocus(); break;
      case 'focus-reset': this.resetFocus(); break;
      case 'focus-switch': this.switchFocusMode(); break;
      case 'energy-toggle': this.toggleEnergy(); break;
      case 'energy-preset': this.setEnergyPreset(parseInt(target.dataset.min as string)); break;
      case 'batch-complete': this.batchApply(true); break;
      case 'batch-skip': this.batchApply(false); break;
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if ((e.target as HTMLElement)?.id === 'capture-input' && e.key === 'Enter') {
      e.preventDefault();
      this.addNote();
    }
  };

  private addNote(): void {
    const input = this.root.querySelector('#capture-input') as HTMLInputElement | null;
    const sel = this.root.querySelector('#capture-habit') as HTMLSelectElement | null;
    if (!input || !input.value.trim()) return;
    store.addNote(input.value, sel?.value || undefined);
    input.value = '';
  }

  /* ── GitHub-style hover tooltip ───────────────────────────── */
  private onTipEnter = (e: Event): void => {
    const cell = (e.target as HTMLElement).closest?.('.gh-cell[data-date]') as HTMLElement | null;
    if (!cell) return;
    const date = cell.dataset.date as string;
    const n = Number(cell.dataset.n || 0);
    const dt = new Date(date + 'T00:00:00');
    const label = dt.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    this.tip.innerHTML = `<b>${label}</b><span>${n} completed</span>`;
    this.tip.style.display = 'flex';
  };

  private onTipLeave = (e: Event): void => {
    const to = (e as MouseEvent).relatedTarget as HTMLElement | null;
    if (!to?.closest?.('.gh-cell[data-date]')) this.tip.style.display = 'none';
  };

  private onTipMove = (e: MouseEvent): void => {
    if (this.tip.style.display === 'none') return;
    this.tip.style.left = `${e.clientX}px`;
    this.tip.style.top = `${e.clientY}px`;
    this.tip.style.transform =
      e.clientY < 90 ? 'translate(-50%, 16px)' : 'translate(-50%, calc(-100% - 12px))';
  };

  private update(): void {
    this.tip.style.display = 'none';
    this.renderProgress();
    this.renderStreaks();
    this.renderHeatmap();
    this.renderEnergy();
    this.renderMood();
    this.renderWater();
    this.renderBatch();
    this.renderCapture();
    this.renderNeofetch();
  }

  /* ── Today progress + XP ─────────────────────────────────── */
  private renderProgress(): void {
    const el = this.root.querySelector('#w-progress') as HTMLElement;
    const s = store.getState();
    const today = getTodayString();
    const scheduled = s.habits.filter(h => !h.archivedAt && store.isHabitScheduledToday(h));
    const total = scheduled.length;
    let doneCount = 0;
    for (const h of scheduled) {
      const c = s.completions.find(x => x.habitId === h.id && x.date === today);
      const isDone = h.mode === 'checkbox' ? !!c : !!(c && c.value >= h.target);
      if (isDone) doneCount++;
    }
    const pct = total ? doneCount / total : 0;
    const circ = 2 * Math.PI * 34;
    const offset = circ * (1 - pct);

    const txp = s.completions.length * 10;
    const lvl = Math.floor(Math.sqrt(txp / 100)) + 1;
    const cur = (lvl - 1) ** 2 * 100;
    const nxt = lvl ** 2 * 100;
    const xpPct = Math.min(100, ((txp - cur) / (nxt - cur)) * 100);

    el.innerHTML = `
      <span class="widget-title">Today</span>
      <div class="ring-wrap">
        <svg viewBox="0 0 80 80" class="ring" role="img" aria-label="${doneCount} of ${total} done">
          <circle class="ring-bg" cx="40" cy="40" r="34"></circle>
          <circle class="ring-fg" cx="40" cy="40" r="34"
            stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"></circle>
        </svg>
        <div class="ring-center">
          <span class="ring-pct">${Math.round(pct * 100)}%</span>
          <span class="ring-sub">${doneCount}/${total}</span>
        </div>
      </div>
      <div class="xp-mini">
        <div class="xp-mini-head"><span>Lv ${lvl}</span><span>${txp} XP</span></div>
        <div class="xp-mini-bar"><div style="width:${xpPct}%"></div></div>
      </div>
    `;
  }

  /* ── Streak board ────────────────────────────────────────── */
  private renderStreaks(): void {
    const el = this.root.querySelector('#w-streaks') as HTMLElement;
    const s = store.getState();
    const today = getTodayString();
    const vacation = store.getSettings().vacationMode;
    const items = s.habits
      .filter(h => !h.archivedAt)
      .map(h => {
        const st = store.getHabitStreak(h.id);
        const doneToday = s.completions.some(c => c.habitId === h.id && c.date === today);
        return { h, st, doneToday };
      })
      .sort((a, b) => b.st.current - a.st.current)
      .slice(0, 5);

    if (!items.length) {
      el.innerHTML = `<span class="widget-title">Streaks</span><div class="widget-empty">No habits yet</div>`;
      return;
    }

    el.innerHTML = `
      <span class="widget-title">Streaks</span>
      <div class="streak-board">
        ${items
          .map(
            ({ h, st, doneToday }) => `
          <div class="sb-row">
            <span class="sb-name"><span class="sb-dot" style="background:${h.color}"></span>${h.icon} ${h.name}</span>
            <span class="sb-vals">
              ${st.current > 0 && !doneToday && !vacation && !store.isSkipped(h.id, today) ? '<span class="sb-risk" title="At risk — not done today">at risk</span>' : ''}
              <span class="sb-cur">🔥${st.current}</span>
              <span class="sb-best">★${st.longest}</span>
            </span>
          </div>`
          )
          .join('')}
      </div>
    `;
  }

  /* ── GitHub-style contribution heatmap (last 30 days) ────── */
  private renderHeatmap(): void {
    const el = this.root.querySelector('#w-heatmap') as HTMLElement;
    const s = store.getState();
    const hasHabits = s.habits.some(h => !h.archivedAt);

    if (!hasHabits) {
      el.innerHTML = `<span class="widget-title">Activity</span><div class="widget-empty">No habits yet</div>`;
      return;
    }

    const today = new Date();
    const todayStr = getTodayString();
    const startDate = addDays(today, -(DAYS_BACK - 1));
    const gridStart = addDays(startDate, -startDate.getDay());

    const count = new Map<string, number>();
    for (const c of s.completions) {
      if (c.value <= 0) continue;
      count.set(c.date, (count.get(c.date) || 0) + 1);
    }

    const cells: ({ date: string; n: number } | null)[] = [];
    for (let d = gridStart; d <= today; d = addDays(d, 1)) {
      const ds = getDateString(d);
      cells.push({ date: ds, n: count.get(ds) || 0 });
    }
    while (cells.length % 7 !== 0) cells.push(null);

    let max = 1;
    for (const c of cells) if (c && c.n > max) max = c.n;

    const weeks: string[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      const week = cells.slice(i, i + 7);
      weeks.push(
        week
          .map(c => {
            if (!c) return `<span class="gh-cell gh-empty"></span>`;
            const lvl = c.n <= 0 ? 0 : Math.min(4, Math.ceil((c.n / max) * 4));
            return `<span class="gh-cell gh-l${lvl}${
              c.date === todayStr ? ' gh-today' : ''
            }" data-date="${c.date}" data-n="${c.n}"></span>`;
          })
          .join('')
      );
    }

    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    el.innerHTML = `
      <span class="widget-title">Activity <span class="widget-sub">${fmt(startDate)} – ${fmt(today)}</span></span>
      <div class="gh-heatmap">
        <div class="gh-weeks">${weeks.map(w => `<div class="gh-week">${w}</div>`).join('')}</div>
      </div>
      <div class="gh-legend"><span>Less</span><span class="gh-cell gh-l0"></span><span class="gh-cell gh-l1"></span><span class="gh-cell gh-l2"></span><span class="gh-cell gh-l3"></span><span class="gh-cell gh-l4"></span><span>More</span></div>
    `;
  }

  /* ── Focus timer (25/5 pomodoro) ─────────────────────────── */
  private focusLog: { date: string; minutes: number }[] = JSON.parse(localStorage.getItem('hc-focus') || '[]');

  private buildFocus(): void {
    this.renderFocus();
  }

  private focusStatsToday(): { minutes: number; sessions: number } {
    const today = getTodayString();
    const todayLogs = this.focusLog.filter(x => x.date === today);
    return { minutes: todayLogs.reduce((s, x) => s + x.minutes, 0), sessions: todayLogs.length };
  }

  private logFocus(minutes: number): void {
    this.focusLog.push({ date: getTodayString(), minutes });
    this.focusLog = this.focusLog.slice(-500);
    try { localStorage.setItem('hc-focus', JSON.stringify(this.focusLog)); } catch { /* ignore */ }
  }

  private renderFocus(): void {
    const el = this.root.querySelector('#w-focus') as HTMLElement;
    if (!el) return;
    const label = this.focus.mode === 'focus' ? 'FOCUS' : 'BREAK';
    const mm = pad(Math.floor(this.focus.remaining / 60));
    const ss = pad(this.focus.remaining % 60);
    const stat = this.focusStatsToday();
    el.innerHTML = `
      <span class="widget-title">Focus</span>
      <div class="focus-mode">${label} · ${mm}:${ss}</div>
      <div class="widget-stat">Today: ${stat.minutes}m · ${stat.sessions} session${stat.sessions === 1 ? '' : 's'}</div>
      <div class="focus-actions">
        <button class="btn btn-sm btn-primary" data-act="focus-toggle">${this.focus.running ? 'Pause' : 'Start'}</button>
        <button class="btn btn-sm btn-ghost" data-act="focus-reset">Reset</button>
        <button class="btn btn-sm btn-ghost" data-act="focus-switch">25/5</button>
      </div>
    `;
  }

  private toggleFocus(): void {
    this.focus.running = !this.focus.running;
    if (this.focus.running) {
      if (this.focusTimer) clearInterval(this.focusTimer);
      this.focusTimer = window.setInterval(() => {
        this.focus.remaining -= 1;
        if (this.focus.remaining <= 0) {
          const finished = this.focus.mode;
          if (finished === 'focus') this.logFocus(25);
          this.focus.mode = finished === 'focus' ? 'break' : 'focus';
          this.focus.remaining = this.focus.mode === 'focus' ? 25 * 60 : 5 * 60;
          this.focus.running = false;
          if (this.focusTimer) clearInterval(this.focusTimer);
          this.focusTimer = undefined;
          this.flash('w-focus', finished === 'focus' ? 'Focus complete — take a break' : 'Break over — back to it');
        }
        this.renderFocus();
      }, 1000);
    } else if (this.focusTimer) {
      clearInterval(this.focusTimer);
      this.focusTimer = undefined;
    }
    this.renderFocus();
  }

  private resetFocus(): void {
    this.focus.running = false;
    if (this.focusTimer) { clearInterval(this.focusTimer); this.focusTimer = undefined; }
    this.focus.remaining = this.focus.mode === 'focus' ? 25 * 60 : 5 * 60;
    this.renderFocus();
  }

  private switchFocusMode(): void {
    this.focus.running = false;
    if (this.focusTimer) { clearInterval(this.focusTimer); this.focusTimer = undefined; }
    this.focus.mode = this.focus.mode === 'focus' ? 'break' : 'focus';
    this.focus.remaining = this.focus.mode === 'focus' ? 25 * 60 : 5 * 60;
    this.renderFocus();
  }

  /* ── Energy timer (short break) ──────────────────────────── */
  private breakLog: { date: string; minutes: number }[] = JSON.parse(localStorage.getItem('hc-breaks') || '[]');

  private buildEnergy(): void { this.renderEnergy(); }

  private setEnergyPreset(min: number): void {
    this.energy = { remaining: min * 60, running: false, preset: min };
    if (this.energyTimer) { clearInterval(this.energyTimer); this.energyTimer = undefined; }
    this.renderEnergy();
  }

  private toggleEnergy(): void {
    this.energy.running = !this.energy.running;
    if (this.energy.running) {
      if (this.energyTimer) clearInterval(this.energyTimer);
      this.energyTimer = window.setInterval(() => {
        this.energy.remaining -= 1;
        if (this.energy.remaining <= 0) {
          this.energy.running = false;
          if (this.energyTimer) clearInterval(this.energyTimer);
          this.energyTimer = undefined;
          this.energy.remaining = this.energy.preset * 60;
          this.energyLog.push({ date: getTodayString(), minutes: this.energy.preset });
          this.energyLog = this.energyLog.slice(-500);
          try { localStorage.setItem('hc-breaks', JSON.stringify(this.energyLog)); } catch { /* ignore */ }
          this.flash('w-energy', 'Break finished — recharged');
        }
        this.renderEnergy();
      }, 1000);
    } else if (this.energyTimer) {
      clearInterval(this.energyTimer);
      this.energyTimer = undefined;
    }
    this.renderEnergy();
  }

  private energyLog: { date: string; minutes: number }[] = JSON.parse(localStorage.getItem('hc-breaks') || '[]');

  private renderEnergy(): void {
    const el = this.root.querySelector('#w-energy') as HTMLElement;
    if (!el) return;
    const today = getTodayString();
    const breaksToday = this.energyLog.filter(x => x.date === today).length;
    const mm = pad(Math.floor(this.energy.remaining / 60));
    const ss = pad(this.energy.remaining % 60);
    const bars = this.last7().map(d => {
      const n = this.energyLog.filter(x => x.date === d).length;
      return `<span class="mini-bar" title="${d}: ${n}" style="height:${Math.min(100, n * 25)}%"></span>`;
    }).join('');
    el.innerHTML = `
      <span class="widget-title">Energy</span>
      <div class="focus-mode">BREAK · ${mm}:${ss}</div>
      <div class="widget-stat">${breaksToday} break${breaksToday === 1 ? '' : 's'} today</div>
      <div class="preset-row">
        ${[5, 10, 15].map(m => `<button class="btn btn-sm ${this.energy.preset === m ? 'btn-primary' : 'btn-ghost'}" data-act="energy-preset" data-min="${m}">${m}m</button>`).join('')}
        <button class="btn btn-sm btn-ghost" data-act="energy-toggle">${this.energy.running ? 'Stop' : 'Go'}</button>
      </div>
      <div class="mini-bars">${bars}</div>
    `;
  }

  /* ── Mood tracker ────────────────────────────────────────── */
  private renderMood(): void {
    const el = this.root.querySelector('#w-mood') as HTMLElement;
    if (!el) return;
    const todayMood = store.getTodayMood();
    const recent = store.getRecentMoods(7);
    const dots = recent.map(r => {
      const m = MOODS.find(x => x.key === r.mood);
      return `<span class="mood-dot${m ? ' active' : ''}" title="${r.date}${m ? ': ' + m.label : ''}">${m ? m.emoji : '·'}</span>`;
    }).join('');
    el.innerHTML = `
      <span class="widget-title">Mood</span>
      <div class="mood-buttons">
        ${MOODS.map(m => `<button class="mood-btn${todayMood === m.key ? ' active' : ''}" data-act="mood" data-mood="${m.key}" title="${m.label}">${m.emoji}</button>`).join('')}
      </div>
      <div class="mood-dots">${dots}</div>
    `;
  }

  /* ── Water intake ────────────────────────────────────────── */
  private renderWater(): void {
    const el = this.root.querySelector('#w-water') as HTMLElement;
    if (!el) return;
    const goal = store.waterGoal();
    const count = store.getTodayWater();
    const pct = Math.min(100, (count / goal) * 100);
    el.innerHTML = `
      <span class="widget-title">Water <span class="widget-sub">${count}/${goal}</span></span>
      <div class="water-bar"><div style="width:${pct}%"></div></div>
      <div class="water-actions">
        <button class="btn btn-sm btn-ghost" data-act="water-dec">−</button>
        <span class="water-cups">${'💧'.repeat(Math.min(count, goal))}${count > goal ? ' +' + (count - goal) : ''}</span>
        <button class="btn btn-sm btn-primary" data-act="water-inc">+</button>
      </div>
    `;
  }

  /* ── Batch: complete / skip many ─────────────────────────── */
  private renderBatch(): void {
    const el = this.root.querySelector('#w-batch') as HTMLElement;
    if (!el) return;
    const s = store.getState();
    const today = getTodayString();
    const due = s.habits.filter(h => {
      if (h.archivedAt || !store.isHabitScheduledToday(h)) return false;
      const c = s.completions.find(x => x.habitId === h.id && x.date === today);
      const done = h.mode === 'checkbox' ? !!c : !!(c && c.value >= h.target);
      return !done;
    }).slice(0, 6);

    if (!due.length) {
      el.innerHTML = `<span class="widget-title">Batch</span><div class="widget-empty">All caught up 🎉</div>`;
      return;
    }
    el.innerHTML = `
      <span class="widget-title">Batch <span class="widget-sub">${this.batchSel.size} selected</span></span>
      <div class="batch-list">
        ${due.map(h => `<label class="batch-row"><input type="checkbox" data-batch="${h.id}" ${this.batchSel.has(h.id) ? 'checked' : ''}><span style="color:${h.color}">${h.icon}</span> ${h.name}</label>`).join('')}
      </div>
      <div class="batch-actions">
        <button class="btn btn-sm btn-primary" data-act="batch-complete" ${this.batchSel.size ? '' : 'disabled'}>Complete</button>
        <button class="btn btn-sm btn-ghost" data-act="batch-skip" ${this.batchSel.size ? '' : 'disabled'}>Skip today</button>
      </div>
    `;
    el.querySelectorAll('input[data-batch]').forEach(cb => cb.addEventListener('change', e => {
      const id = (e.target as HTMLInputElement).dataset.batch as string;
      if ((e.target as HTMLInputElement).checked) this.batchSel.add(id); else this.batchSel.delete(id);
      this.renderBatch();
    }));
  }

  private batchApply(complete: boolean): void {
    const today = getTodayString();
    for (const id of this.batchSel) {
      if (complete) store.completeHabit(id, today);
      else if (!store.isSkipped(id, today)) store.toggleSkip(id, today);
    }
    const n = this.batchSel.size;
    createToast(complete ? `Completed ${n} habit${n === 1 ? '' : 's'}` : `Skipped ${n} for today`, complete ? 'success' : 'info');
    this.batchSel.clear();
    if (complete) store.haptic();
    this.renderBatch();
  }

  /* ── Quick capture (notes) ───────────────────────────────── */
  private buildCapture(): void {
    this.renderCapture();
  }

  private renderCapture(): void {
    const el = this.root.querySelector('#w-capture') as HTMLElement;
    if (!el) return;
    const s = store.getState();
    const active = s.habits.filter(h => !h.archivedAt);
    const notes = store.getState().notes.slice(0, 5);
    const habitName = (id?: string) => id ? active.find(h => h.id === id) : undefined;
    el.innerHTML = `
      <span class="widget-title">Capture</span>
      <div class="capture-form">
        <input type="text" id="capture-input" class="capture-input" placeholder="quick note…">
        <select id="capture-habit" class="capture-select"><option value="">— habit —</option>${active.map(h => `<option value="${h.id}">${h.icon} ${h.name}</option>`).join('')}</select>
        <button class="btn btn-sm btn-primary" data-act="note-add">Add</button>
      </div>
      <div class="note-list">
        ${notes.length ? notes.map(n => { const h = habitName(n.habitId); return `<div class="note-row"><span class="note-time">${new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span class="note-text">${n.text}${h ? ` <em>· ${h.name}</em>` : ''}</span><button class="note-del" data-act="note-del" data-id="${n.id}" title="Delete">✕</button></div>`; }).join('') : '<div class="widget-empty">No notes yet</div>'}
      </div>
    `;
  }

  /* ── Neofetch system panel ───────────────────────────────── */
  private renderNeofetch(): void {
    const el = this.root.querySelector('#w-neofetch') as HTMLElement;
    const s = store.getState();
    const habits = s.habits.filter(h => !h.archivedAt).length;
    const best = s.habits.reduce((m, h) => Math.max(m, store.getHabitStreak(h.id).current), 0);
    el.innerHTML = `
      <span class="widget-title">habit_ctl <span class="widget-sub">v1.0.0</span></span>
      <pre class="neofetch">user@habit_ctl
----------------------
Habits     ${habits}
Routines   ${s.routines.length}
Check-ins  ${s.completions.length}
Best <span class="nf-fire">🔥</span>     ${best}
Shields    ${s.shields.filter(x => !x.usedAt).length}
Theme      ${s.theme.name}
Sync       ${s.sync.status}</pre>
    `;
  }

  private last7(): string[] {
    const out: string[] = [];
    for (let i = 6; i >= 0; i--) out.push(getDateString(addDays(new Date(), -i)));
    return out;
  }

  private flash(id: string, msg: string): void {
    const el = this.root.querySelector(`#${id}`) as HTMLElement | null;
    if (el) {
      el.classList.add('flash');
      window.setTimeout(() => el.classList.remove('flash'), 1200);
    }
    createToast(msg, 'info');
  }
}

export function createWidgetRail(root: HTMLElement): WidgetRail {
  return new WidgetRail(root);
}
