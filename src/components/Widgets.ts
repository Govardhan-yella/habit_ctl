import { store } from '../stores/appStore';
import { getTodayString, getDateString, addDays } from '../utils/date';
import { createToast } from './TerminalUI';

const DAYS_BACK = 30;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export class WidgetRail {
  private root: HTMLElement;
  private unsub: () => void;
  private tip: HTMLElement;
  private focusTimer?: number;
  private focus = { mode: 'focus' as 'focus' | 'break', remaining: 25 * 60, running: false };

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.className = 'widget-rail';
    this.root.innerHTML = `
      <div class="widget" id="w-progress"></div>
      <div class="widget" id="w-streaks"></div>
      <div class="widget" id="w-heatmap"></div>
      <div class="widget" id="w-focus"></div>
      <div class="widget" id="w-neofetch"></div>
    `;

    this.tip = document.createElement('div');
    this.tip.className = 'gh-tip';
    this.tip.style.display = 'none';
    document.body.appendChild(this.tip);

    this.root.addEventListener('mouseover', this.onTipEnter);
    this.root.addEventListener('mouseout', this.onTipLeave);
    this.root.addEventListener('mousemove', this.onTipMove);

    this.buildFocus();
    this.update();
    this.unsub = store.subscribe(() => this.update());
  }

  destroy(): void {
    this.unsub();
    this.root.removeEventListener('mouseover', this.onTipEnter);
    this.root.removeEventListener('mouseout', this.onTipLeave);
    this.root.removeEventListener('mousemove', this.onTipMove);
    this.tip.remove();
    if (this.focusTimer) clearInterval(this.focusTimer);
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
              ${st.current > 0 && !doneToday && !vacation ? '<span class="sb-risk" title="At risk — not done today">at risk</span>' : ''}
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
  private buildFocus(): void {
    const el = this.root.querySelector('#w-focus') as HTMLElement;
    el.innerHTML = `
      <span class="widget-title">Focus</span>
      <div class="focus-mode" id="focus-mode">FOCUS · 25:00</div>
      <div class="focus-actions">
        <button class="btn btn-sm btn-primary" id="focus-toggle">Start</button>
        <button class="btn btn-sm btn-ghost" id="focus-reset">Reset</button>
        <button class="btn btn-sm btn-ghost" id="focus-switch">25/5</button>
      </div>
    `;
    el.querySelector('#focus-toggle')?.addEventListener('click', () => this.toggleFocus());
    el.querySelector('#focus-reset')?.addEventListener('click', () => this.resetFocus());
    el.querySelector('#focus-switch')?.addEventListener('click', () => this.switchFocusMode());
    this.renderFocus();
  }

  private renderFocus(): void {
    const modeEl = this.root.querySelector('#focus-mode');
    const btn = this.root.querySelector('#focus-toggle');
    if (!modeEl) return;
    const label = this.focus.mode === 'focus' ? 'FOCUS' : 'BREAK';
    const mm = pad(Math.floor(this.focus.remaining / 60));
    const ss = pad(this.focus.remaining % 60);
    modeEl.textContent = `${label} · ${mm}:${ss}`;
    if (btn) btn.textContent = this.focus.running ? 'Pause' : 'Start';
  }

  private toggleFocus(): void {
    this.focus.running = !this.focus.running;
    if (this.focus.running) {
      if (this.focusTimer) clearInterval(this.focusTimer);
      this.focusTimer = window.setInterval(() => {
        this.focus.remaining -= 1;
        if (this.focus.remaining <= 0) {
          const finished = this.focus.mode;
          this.focus.mode = finished === 'focus' ? 'break' : 'focus';
          this.focus.remaining = this.focus.mode === 'focus' ? 25 * 60 : 5 * 60;
          this.focus.running = false;
          if (this.focusTimer) clearInterval(this.focusTimer);
          this.focusTimer = undefined;
          this.renderFocus();
          this.flashFocus(finished === 'focus' ? 'Focus complete — take a break' : 'Break over — back to focus');
        }
      }, 1000);
    } else if (this.focusTimer) {
      clearInterval(this.focusTimer);
      this.focusTimer = undefined;
    }
    this.renderFocus();
  }

  private resetFocus(): void {
    this.focus.running = false;
    if (this.focusTimer) {
      clearInterval(this.focusTimer);
      this.focusTimer = undefined;
    }
    this.focus.remaining = this.focus.mode === 'focus' ? 25 * 60 : 5 * 60;
    this.renderFocus();
  }

  private switchFocusMode(): void {
    this.focus.running = false;
    if (this.focusTimer) {
      clearInterval(this.focusTimer);
      this.focusTimer = undefined;
    }
    this.focus.mode = this.focus.mode === 'focus' ? 'break' : 'focus';
    this.focus.remaining = this.focus.mode === 'focus' ? 25 * 60 : 5 * 60;
    this.renderFocus();
  }

  private flashFocus(msg: string): void {
    const el = this.root.querySelector('#w-focus') as HTMLElement;
    el.classList.add('flash');
    window.setTimeout(() => el.classList.remove('flash'), 1200);
    createToast(msg, 'info');
  }

  /* ── Neofetch system panel ───────────────────────────────── */
  private renderNeofetch(): void {
    const el = this.root.querySelector('#w-neofetch') as HTMLElement;
    const s = store.getState();
    const habits = s.habits.filter(h => !h.archivedAt).length;
    const best = s.habits.reduce((m, h) => Math.max(m, store.getHabitStreak(h.id).current), 0);
    el.innerHTML = `
      <span class="widget-title">habit_ctl <span class="widget-sub">v1.0.0</span></span>
      <pre class="neofetch">user@init
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
}

export function createWidgetRail(root: HTMLElement): WidgetRail {
  return new WidgetRail(root);
}
