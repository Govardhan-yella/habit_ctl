import { store } from '../stores/appStore';
import { getTodayString, getDateString, addDays } from '../utils/date';
import { createToast, createModal } from './TerminalUI';

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

type WidgetSize = 'sm' | 'md' | 'lg';
interface WidgetCfg { id: string; visible: boolean; size: WidgetSize; }

const WIDGET_META: { id: string; name: string; desc: string }[] = [
  { id: 'progress', name: 'Today progress', desc: 'Completion ring + XP bar' },
  { id: 'streaks', name: 'Streaks', desc: 'Top current streaks' },
  { id: 'heatmap', name: 'Activity heatmap', desc: 'Last 30 days of check-ins' },
  { id: 'timer', name: 'Focus timer', desc: 'Focus + break pomodoro' },
  { id: 'mood', name: 'Mood', desc: 'Daily mood check-in' },
  { id: 'water', name: 'Water', desc: 'Hydration tracker' },
  { id: 'batch', name: 'Batch actions', desc: 'Complete or skip many at once' },
  { id: 'capture', name: 'Quick capture', desc: 'Jot notes onto habits' },
  { id: 'neofetch', name: 'System info', desc: 'Summary panel' },
];

const WIDGETS_KEY = 'hc-widgets';
const DEFAULT_FOCUS_PRESETS = [15, 25, 45, 50, 90];
const DEFAULT_BREAK_PRESETS = [5, 10, 15, 20, 30];
const TIMER_PRESETS_KEY = 'hc-timer-presets';

function loadTimerPresets(): { focus: number[]; break: number[] } {
  try {
    const raw = JSON.parse(localStorage.getItem(TIMER_PRESETS_KEY) || 'null');
    const clean = (arr: unknown, fallback: number[]): number[] => {
      if (!Array.isArray(arr)) return [...fallback];
      const nums = [...new Set(arr.map(n => Number(n)).filter(n => Number.isFinite(n) && n >= 1))].slice(0, 8);
      return nums.length ? nums : [...fallback];
    };
    if (raw) return { focus: clean(raw.focus, DEFAULT_FOCUS_PRESETS), break: clean(raw.break, DEFAULT_BREAK_PRESETS) };
  } catch { /* ignore */ }
  return { focus: [...DEFAULT_FOCUS_PRESETS], break: [...DEFAULT_BREAK_PRESETS] };
}

function defaultWidgetCfg(): WidgetCfg[] {
  return WIDGET_META.map(m => ({ id: m.id, visible: true, size: 'md' as WidgetSize }));
}

function loadWidgetCfg(): WidgetCfg[] {
  try {
    const raw = JSON.parse(localStorage.getItem(WIDGETS_KEY) || 'null');
    if (Array.isArray(raw) && raw.length) {
      const byId = new Map<string, any>(raw.map((r: any) => [r.id, r]));
      const order = raw.map((r: any) => r.id as string);
      const cfg = WIDGET_META.map(m => {
        const r = byId.get(m.id);
        return { id: m.id, visible: r?.visible !== false, size: (r?.size as WidgetSize) || 'md' };
      });
      cfg.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      return cfg;
    }
  } catch { /* ignore */ }
  return defaultWidgetCfg();
}

export class WidgetRail {
  private root: HTMLElement;
  private unsub: () => void;
  private tip: HTMLElement;
  private cfg: WidgetCfg[] = loadWidgetCfg();

  /* ── Combined focus / break timer ────────────────────────── */
  private timerTimer?: number;
  private presets = loadTimerPresets();
  private focusPresets: number[] = this.presets.focus;
  private breakPresets: number[] = this.presets.break;
  private timer = {
    mode: 'focus' as 'focus' | 'break',
    remaining: this.presets.focus[0] * 60,
    running: false,
    focusMin: this.presets.focus[0],
    breakMin: this.presets.break[0],
  };
  private focusLog: { date: string; minutes: number }[] = JSON.parse(localStorage.getItem('hc-focus') || '[]');
  private breakLog: { date: string; minutes: number }[] = JSON.parse(localStorage.getItem('hc-breaks') || '[]');

  private batchSel = new Set<string>();

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.className = 'widget-rail';

    this.tip = document.createElement('div');
    this.tip.className = 'gh-tip';
    this.tip.style.display = 'none';
    document.body.appendChild(this.tip);

    this.buildRail();

    this.root.addEventListener('mouseover', this.onTipEnter);
    this.root.addEventListener('mouseout', this.onTipLeave);
    this.root.addEventListener('mousemove', this.onTipMove);
    this.root.addEventListener('click', this.onClick);
    this.root.addEventListener('keydown', this.onKeyDown);

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
    if (this.timerTimer) clearInterval(this.timerTimer);
  }

  /* ── Rail construction & customization ───────────────────── */
  private buildRail(): void {
    const visible = this.cfg.filter(c => c.visible);
    const order: string[] = [];
    let i = 0;
    while (i < visible.length) {
      const c = visible[i];
      if (c.size === 'sm') {
        const next = visible[i + 1];
        if (next && next.size === 'sm') {
          order.push(`row:${c.id}:${next.id}`);
          i += 2;
        } else {
          order.push(`row:${c.id}`);
          i += 1;
        }
      } else {
        order.push(c.id);
        i += 1;
      }
    }

    const html = order
      .map(entry => {
        if (entry.startsWith('row:')) {
          const ids = entry.slice(4).split(':');
          return `<div class="widget-row">${ids
            .filter(Boolean)
            .map(id => this.renderSlot(id))
            .join('')}</div>`;
        }
        return this.renderSlot(entry);
      })
      .join('');

    this.root.innerHTML = `
      <div class="rail-head">
        <span class="rail-title">Dashboard</span>
        <button class="rail-customize" id="rail-customize" title="Customize widgets" aria-label="Customize widgets">⚙</button>
      </div>
      <div class="widget-grid" id="widget-grid">${html}</div>
      ${visible.length ? '' : '<div class="widget-empty">No widgets shown.</div>'}
      <button class="rail-add" id="rail-add" title="Add a widget">＋ Add widget</button>
    `;
    this.root.querySelector('#rail-customize')?.addEventListener('click', () => this.openCustomizer());
    this.root.querySelector('#rail-add')?.addEventListener('click', () => this.openAddWidget());
    this.bindDragAndDrop();
  }

  private renderSlot(id: string): string {
    const c = this.cfg.find(x => x.id === id);
    if (!c) return '';
    const name = WIDGET_META.find(m => m.id === c.id)?.name || c.id;
    const sz = c.size || 'md';
    return `
      <div class="widget-slot slot-${sz}" draggable="true" data-wid="${c.id}">
        <button class="widget-handle" aria-hidden="true" title="Reorder widget">≡</button>
        <div class="widget widget-${sz}" id="w-${c.id}" data-widget="${c.id}"></div>
        <button class="widget-remove" data-remove="${c.id}" title="Hide widget" aria-label="Hide ${name}">✕</button>
      </div>`;
  }

  private bindDragAndDrop(): void {
    const slots = Array.from(this.root.querySelectorAll('.widget-slot[data-wid]')) as HTMLElement[];
    let dragged: HTMLElement | null = null;
    slots.forEach(el => {
      el.addEventListener('dragstart', (e: DragEvent) => {
        dragged = el;
        el.classList.add('dragging');
        e.dataTransfer?.setData('text/plain', el.dataset.wid || '');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
        }
      });
      el.addEventListener('dragend', () => {
        dragged = null;
        el.classList.remove('dragging');
        slots.forEach(s => s.classList.remove('drop-before', 'drop-after'));
      });
      el.addEventListener('dragover', (e: DragEvent) => {
        if (!dragged || dragged === el) return;
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        el.classList.remove('drop-before', 'drop-after');
        if ((e.clientY - rect.top) < rect.height / 2) {
          el.classList.add('drop-before');
        } else {
          el.classList.add('drop-after');
        }
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      });
      el.addEventListener('dragleave', () => {
        el.classList.remove('drop-before', 'drop-after');
      });
      el.addEventListener('drop', (e: DragEvent) => {
        if (!dragged || dragged === el) return;
        e.preventDefault();
        e.stopPropagation();
        const srcId = dragged.dataset.wid || e.dataTransfer?.getData('text/plain') || '';
        const dstId = el.dataset.wid || '';
        if (!srcId || !dstId || srcId === dstId) return;
        const before = el.classList.contains('drop-before');
        this.reorderWidgets(srcId, dstId, before);
        el.classList.remove('drop-before', 'drop-after');
      });
    });
  }

  private reorderWidgets(srcId: string, dstId: string, before: boolean): void {
    const order = this.cfg.filter(c => c.visible).map(c => c.id);
    const sIdx = order.indexOf(srcId);
    const dIdx = order.indexOf(dstId);
    if (sIdx < 0 || dIdx < 0) return;
    const ids = order.filter(id => id !== srcId);
    let ins = ids.indexOf(dstId);
    if (!before && ins >= 0) ins += 1;
    if (ins < 0) ins = ids.length;
    ids.splice(ins, 0, srcId);
    const newOrder = ids;
    const byId = new Map(this.cfg.map(c => [c.id, c]));
    this.cfg = newOrder.map(id => byId.get(id)!).concat(this.cfg.filter(c => !c.visible));
    this.applyCfgChange();
  }

  private persistCfg(): void {
    try { localStorage.setItem(WIDGETS_KEY, JSON.stringify(this.cfg)); } catch { /* ignore */ }
  }

  /** Current size variant ('sm' | 'md' | 'lg') for a widget id. */
  private sizeOf(id: string): WidgetSize {
    return this.cfg.find(c => c.id === id)?.size || 'md';
  }

  /** Completion ratio for each of the last 7 days. */
  private weeklyTrend(): number[] {
    const s = store.getState();
    const out: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = getDateString(addDays(new Date(), -i));
      const sched = s.habits.filter(h => !h.archivedAt && store.isHabitScheduledOn(h, d));
      let done = 0;
      for (const h of sched) {
        const c = s.completions.find(x => x.habitId === h.id && x.date === d);
        const isDone = h.mode === 'checkbox' ? !!c : !!(c && c.value >= h.target);
        if (isDone) done++;
      }
      out.push(sched.length ? done / sched.length : 0);
    }
    return out;
  }

  private openCustomizer(): void {
    const content = document.createElement('div');
    content.className = 'widget-customizer';
    const list = document.createElement('div');
    list.className = 'wcfg-list';
    content.appendChild(list);
    const footer = document.createElement('div');
    footer.className = 'wcfg-foot';
    footer.innerHTML = `<button class="btn btn-ghost btn-sm" id="wcfg-reset">Reset to defaults</button>`;
    content.appendChild(footer);

    const renderList = () => {
      list.innerHTML = this.cfg.map((c, i) => {
        const meta = WIDGET_META.find(m => m.id === c.id)!;
        return `
          <div class="wcfg-row" data-id="${c.id}">
            <label class="wcfg-toggle"><input type="checkbox" ${c.visible ? 'checked' : ''}><span class="wcfg-name">${meta.name}<em>${meta.desc}</em></span></label>
            <div class="wcfg-size" role="group" aria-label="Size">
              ${(['sm', 'md', 'lg'] as WidgetSize[]).map(sz => `<button class="wcfg-sz${c.size === sz ? ' active' : ''}" data-size="${sz}">${sz.toUpperCase()}</button>`).join('')}
            </div>
            <div class="wcfg-order">
              <button class="wcfg-mv" data-move="-1" ${i === 0 ? 'disabled' : ''} title="Move up">▲</button>
              <button class="wcfg-mv" data-move="1" ${i === this.cfg.length - 1 ? 'disabled' : ''} title="Move down">▼</button>
            </div>
          </div>`;
      }).join('');

      list.querySelectorAll('.wcfg-row').forEach(row => {
        const id = row.getAttribute('data-id')!;
        const c = this.cfg.find(x => x.id === id)!;
        row.querySelector('input[type="checkbox"]')?.addEventListener('change', e => {
          c.visible = (e.target as HTMLInputElement).checked;
          this.applyCfgChange(renderList);
        });
        row.querySelectorAll('.wcfg-sz').forEach(btn => btn.addEventListener('click', () => {
          c.size = btn.getAttribute('data-size') as WidgetSize;
          this.applyCfgChange(renderList);
        }));
        row.querySelectorAll('.wcfg-mv').forEach(btn => btn.addEventListener('click', () => {
          const dir = parseInt(btn.getAttribute('data-move')!, 10);
          const idx = this.cfg.indexOf(c);
          const swap = idx + dir;
          if (swap < 0 || swap >= this.cfg.length) return;
          [this.cfg[idx], this.cfg[swap]] = [this.cfg[swap], this.cfg[idx]];
          this.applyCfgChange(renderList);
        }));
      });
    };

    footer.querySelector('#wcfg-reset')?.addEventListener('click', () => {
      this.cfg = defaultWidgetCfg();
      this.applyCfgChange(renderList);
    });

    renderList();
    createModal('Customize widgets', content, () => {});
  }

  private applyCfgChange(rerenderList?: () => void): void {
    this.persistCfg();
    this.buildRail();
    this.update();
    rerenderList?.();
  }

  private openAddWidget(): void {
    const hidden = this.cfg.filter(c => !c.visible);
    if (!hidden.length) { createToast('All widgets are already shown', 'info'); return; }
    const content = document.createElement('div');
    content.className = 'wadd';
    content.innerHTML = `
      <div class="wadd-hint">Add a widget back to your dashboard:</div>
      <div class="wadd-list">
        ${hidden.map(c => {
          const m = WIDGET_META.find(x => x.id === c.id)!;
          return `<button class="wadd-item" data-add="${c.id}">
            <span class="wadd-name">${m.name}</span>
            <span class="wadd-desc">${m.desc}</span>
            <span class="wadd-plus">＋</span>
          </button>`;
        }).join('')}
      </div>`;
    createModal('Add widget', content, () => { /* noop */ });
    content.querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-add')!;
      const c = this.cfg.find(x => x.id === id);
      if (c) {
        c.visible = true;
        this.applyCfgChange();
        createToast('Widget added', 'success');
      }
      document.querySelector('.modal-overlay')?.remove();
    }));
  }

  private hideWidget(id: string): void {
    const c = this.cfg.find(x => x.id === id);
    if (!c) return;
    c.visible = false;
    this.applyCfgChange();
    const name = WIDGET_META.find(m => m.id === id)?.name || 'Widget';
    createToast(`${name} hidden`, 'info');
  }

  /* ── Delegated events ────────────────────────────────────── */
  private onClick = (e: Event): void => {
    const remove = (e.target as HTMLElement).closest?.('[data-remove]') as HTMLElement | null;
    if (remove) { this.hideWidget(remove.dataset.remove as string); return; }
    const target = (e.target as HTMLElement).closest?.('[data-act]') as HTMLElement | null;
    if (!target) return;
    const act = target.dataset.act as string;
    switch (act) {
      case 'water-inc': store.adjustWater(1); store.haptic(); break;
      case 'water-dec': store.adjustWater(-1); store.haptic(); break;
      case 'mood': store.logMood(target.dataset.mood as string); break;
      case 'note-add': this.addNote(); break;
      case 'note-del': store.deleteNote(target.dataset.id as string); break;
      case 'timer-toggle': this.toggleTimer(); break;
      case 'timer-reset': this.resetTimer(); break;
      case 'timer-switch': this.switchTimer(); break;
      case 'timer-focus-preset': this.setFocusMin(Number(target.dataset.min)); break;
      case 'timer-break-preset': this.setBreakMin(Number(target.dataset.min)); break;
      case 'batch-complete': this.batchApply(true); break;
      case 'batch-skip': this.batchApply(false); break;
      case 'timer-custom': this.openTimerCustom(); break;
    }
  };

  private openTimerCustom(): void {
    const content = document.createElement('div');
    content.className = 'wcfg-timer';
    content.innerHTML = `
      <div class="form-group"><label>Focus presets (minutes, comma separated)</label><input type="text" id="tc-focus" value="${this.focusPresets.join(',')}" placeholder="15,25,45"><span class="wcfg-hint">1–180, max 8 values</span></div>
      <div class="form-group"><label>Break presets (minutes, comma separated)</label><input type="text" id="tc-break" value="${this.breakPresets.join(',')}" placeholder="5,10,15"><span class="wcfg-hint">1–60, max 8 values</span></div>
      <div class="form-actions"><button class="btn btn-ghost" id="tc-reset">Reset defaults</button><button class="btn btn-primary" id="tc-save">Save presets</button></div>`;
    createModal('Customize timer', content, () => { /* noop */ });

    const focusInput = content.querySelector('#tc-focus') as HTMLInputElement;
    const breakInput = content.querySelector('#tc-break') as HTMLInputElement;

    const parse = (raw: string, max: number): number[] =>
      [...new Set(raw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n) && n >= 1 && n <= max))].slice(0, 8);

    const save = (): void => {
      const f = parse(focusInput.value, 180);
      const b = parse(breakInput.value, 60);
      if (f.length) this.focusPresets = f;
      if (b.length) this.breakPresets = b;
      if (!f.includes(this.timer.focusMin)) this.timer.focusMin = f[0] ?? 25;
      if (!b.includes(this.timer.breakMin)) this.timer.breakMin = b[0] ?? 5;
      try { localStorage.setItem('hc-timer-presets', JSON.stringify({ focus: this.focusPresets, break: this.breakPresets })); } catch { /* ignore */ }
      if (this.timer.mode === 'focus' && !this.timer.running) this.timer.remaining = this.timer.focusMin * 60;
      if (this.timer.mode === 'break' && !this.timer.running) this.timer.remaining = this.timer.breakMin * 60;
      this.renderTimer();
      createToast('Timer presets saved', 'success');
      (document.querySelector('.modal-overlay') as HTMLElement | null)?.remove();
    };

    content.querySelector('#tc-save')?.addEventListener('click', save);
    content.querySelector('#tc-reset')?.addEventListener('click', () => {
      this.focusPresets = [...DEFAULT_FOCUS_PRESETS];
      this.breakPresets = [...DEFAULT_BREAK_PRESETS];
      focusInput.value = this.focusPresets.join(',');
      breakInput.value = this.breakPresets.join(',');
    });
    content.addEventListener('keydown', e => { if ((e as KeyboardEvent).key === 'Enter') save(); });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if ((e.target as HTMLElement).id === 'capture-input' && e.key === 'Enter') {
      this.addNote();
    }
  };

  private addNote(): void {
    const input = this.root.querySelector('#capture-input') as HTMLInputElement | null;
    const sel = this.root.querySelector('#capture-select') as HTMLSelectElement | null;
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
    const label = dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
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
    this.tip.style.transform = e.clientY < 90 ? 'translate(-50%, 16px)' : 'translate(-50%, calc(-100% - 12px))';
  };

  private update(): void {
    this.tip.style.display = 'none';
    this.renderProgress();
    this.renderStreaks();
    this.renderHeatmap();
    this.renderTimer();
    this.renderMood();
    this.renderWater();
    this.renderBatch();
    this.renderCapture();
    this.renderNeofetch();
  }

  /* ── Today progress + XP ─────────────────────────────────── */
  private renderProgress(): void {
    const el = this.root.querySelector('#w-progress') as HTMLElement | null;
    if (!el) return;
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

    const size = this.sizeOf('progress');
    const cells = size === 'lg' ? 18 : 14;
    const filled = Math.min(cells, Math.round(pct * cells));
    const showCursor = pct < 1;
    const emptyCount = Math.max(0, cells - filled - (showCursor ? 1 : 0));

    const txp = s.completions.length * 10;
    const lvl = Math.floor(Math.sqrt(txp / 100)) + 1;
    const cur = (lvl - 1) ** 2 * 100;
    const nxt = lvl ** 2 * 100;
    const xpPct = Math.min(100, ((txp - cur) / (nxt - cur)) * 100);

    const trendHtml = size === 'lg'
      ? `<div class="prog-trend" title="Last 7 days">${this.weeklyTrend().map(p => `<span class="pt-bar" style="height:${Math.max(8, Math.round(p * 100))}%"></span>`).join('')}<span class="pt-label">7d</span></div>`
      : '';

    el.innerHTML = `
      <span class="widget-title">Today${size === 'lg' ? ' <span class="widget-sub">weekly view</span>' : ''}</span>
      <div class="ring-wrap">
        <svg viewBox="0 0 80 80" class="ring" role="img" aria-label="${doneCount} of ${total} done">
          <circle class="ring-bg" cx="40" cy="40" r="34"></circle>
          <circle class="ring-fg" cx="40" cy="40" r="34" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"></circle>
        </svg>
        <div class="ring-center"><span class="ring-pct">${Math.round(pct * 100)}%</span><span class="ring-sub">${doneCount}/${total}</span></div>
      </div>
      ${size === 'sm' ? '' : `
      <div class="cmd-progress">
        <div class="cmd-prompt"><span class="terminal-prompt">$</span> progress --today</div>
        <div class="cmd-bar" aria-label="${Math.round(pct * 100)} percent of today's habits complete">
          <span class="cb-open">[</span><span class="cb-fill">${'█'.repeat(filled)}</span>${showCursor ? '<span class="cb-cursor">█</span>' : ''}<span class="cb-empty">${'░'.repeat(emptyCount)}</span><span class="cb-close">]</span>
          <span class="cb-pct">${Math.round(pct * 100)}%</span>
        </div>
      </div>
      <div class="xp-mini">
        <div class="xp-mini-head"><span>Lv ${lvl}</span><span>${txp} XP</span></div>
        <div class="xp-mini-bar"><div style="width:${xpPct}%"></div></div>
      </div>`}
      ${trendHtml}`;
  }

  /* ── Streak board ────────────────────────────────────────── */
  private renderStreaks(): void {
    const el = this.root.querySelector('#w-streaks') as HTMLElement | null;
    if (!el) return;
    const size = this.sizeOf('streaks');
    const limit = size === 'sm' ? 3 : size === 'lg' ? 9 : 5;
    const s = store.getState();
    const today = getTodayString();
    const vacation = store.getSettings().vacationMode;
    const all = s.habits.filter(h => !h.archivedAt)
      .map(h => ({ h, st: store.getHabitStreak(h.id), doneToday: s.completions.filter(x => x.habitId === h.id && x.date === today).length > 0 }))
      .sort((a, b) => b.st.current - a.st.current);
    const items = all.slice(0, limit);

    if (!items.length) {
      el.innerHTML = `<span class="widget-title">Streaks</span><div class="widget-empty">No habits yet</div>`;
      return;
    }
    const total = all.reduce((n, x) => n + x.st.current, 0);
    el.innerHTML = `
      <span class="widget-title">Streaks${size === 'lg' ? ` <span class="widget-sub">${all.length} tracked · ${total}d total</span>` : ''}</span>
      <div class="streak-board sb-${size}">
        ${items.map(({ h, st, doneToday }) => `
          <div class="sb-row">
            <span class="sb-name"><span class="sb-dot" style="background:${h.color}"></span>${h.icon} ${h.name}</span>
            <span class="sb-vals">
              ${st.current > 0 && !doneToday && !vacation && !store.isSkipped(h.id, today) ? '<span class="sb-risk" title="At risk — not done today">at risk</span>' : ''}
              <span class="sb-cur">🔥${st.current}</span>
              ${size === 'sm' ? '' : `<span class="sb-best">★${st.longest}</span>`}
            </span>
          </div>`).join('')}
      </div>`;
  }

  /* ── GitHub-style contribution heatmap (last 30 days) ────── */
  private renderHeatmap(): void {
    const el = this.root.querySelector('#w-heatmap') as HTMLElement | null;
    if (!el) return;
    const s = store.getState();
    if (!s.habits.some(h => !h.archivedAt)) {
      el.innerHTML = `<span class="widget-title">Heatmap</span><div class="widget-empty">No habits yet</div>`;
      return;
    }
    const today = getTodayString();
    const size = this.sizeOf('heatmap');
    const days = size === 'sm' ? 14 : DAYS_BACK;
    const cells: { date: string; n: number }[] = [];
    let max = 1;
    for (let i = days - 1; i >= 0; i--) {
      const d = getDateString(addDays(new Date(), -i));
      const n = s.completions.filter(c => c.date === d).length;
      if (n > max) max = n;
      cells.push({ date: d, n });
    }
    const firstDow = (new Date(cells[0].date + 'T00:00:00').getDay() + 6) % 7;
    const padded: ({ date: string; n: number } | null)[] = [...Array(firstDow).fill(null), ...cells];
    const weeks: (typeof padded)[] = [];
    for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

    el.innerHTML = `
      <span class="widget-title">Heatmap</span>
      <div class="gh-heatmap"><div class="gh-weeks">
        ${weeks.map(w => `<div class="gh-week">${w.map(c => c === null
          ? '<span class="gh-cell gh-empty"></span>'
          : `<span class="gh-cell gh-l${c.n === 0 ? 0 : Math.min(4, Math.ceil((c.n / max) * 4))}${c.date === today ? ' gh-today' : ''}" data-date="${c.date}" data-n="${c.n}"></span>`).join('')}</div>`).join('')}
      </div></div>`;
  }

  /* ── Combined focus / break timer ────────────────────────── */
  private timerStatsToday(): { focusMin: number; focusSessions: number; breakSessions: number } {
    const today = getTodayString();
    const f = this.focusLog.filter(x => x.date === today);
    const b = this.breakLog.filter(x => x.date === today);
    return { focusMin: f.reduce((s, x) => s + x.minutes, 0), focusSessions: f.length, breakSessions: b.length };
  }

  private renderTimer(): void {
    const el = this.root.querySelector('#w-timer') as HTMLElement | null;
    if (!el) return;
    const size = this.sizeOf('timer');
    const label = this.timer.mode === 'focus' ? 'FOCUS' : 'BREAK';
    const mm = pad(Math.floor(this.timer.remaining / 60));
    const ss = pad(this.timer.remaining % 60);
    const st = this.timerStatsToday();
    const history = size === 'lg'
      ? `<div class="focus-history"><span class="fh-label">Today</span><div class="fh-bar"><div style="width:${Math.min(100, (st.focusMin / 120) * 100)}%"></div></div><span class="fh-val">${st.focusMin}m</span></div>`
      : '';
    const presetFocus = this.focusPresets.map(m => `<button class="btn btn-sm ${this.timer.focusMin === m ? 'btn-primary' : 'btn-ghost'}" data-act="timer-focus-preset" data-min="${m}">${m}m</button>`).join('');
    const presetBreak = this.breakPresets.map(m => `<button class="btn btn-sm ${this.timer.breakMin === m ? 'btn-primary' : 'btn-ghost'}" data-act="timer-break-preset" data-min="${m}">${m}m</button>`).join('');
    el.innerHTML = `
      <span class="widget-title">Focus timer${size === 'lg' ? ` <span class="widget-sub">${st.focusSessions} sessions</span>` : ''}</span>
      <div class="focus-mode ${this.timer.running ? 'running' : ''}">${label} · ${mm}:${ss}</div>
      ${size !== 'sm' ? `<div class="widget-stat">Today: ${st.focusMin}m focus · ${st.focusSessions} session${st.focusSessions === 1 ? '' : 's'} · ${st.breakSessions} break${st.breakSessions === 1 ? '' : 's'}</div>` : ''}
      ${history}
      <div class="preset-row preset-labelled"><span class="preset-label">Focus</span>${presetFocus}</div>
      <div class="preset-row preset-labelled"><span class="preset-label">Break</span>${presetBreak}</div>
      <div class="focus-actions">
        <button class="btn btn-sm btn-primary" data-act="timer-toggle">${this.timer.running ? 'Pause' : 'Start'}</button>
        <button class="btn btn-sm btn-ghost" data-act="timer-reset">Reset</button>
        <button class="btn btn-sm btn-ghost" data-act="timer-switch">${this.timer.mode === 'focus' ? '→ Break' : '→ Focus'}</button>
        <button class="btn btn-sm btn-ghost" data-act="timer-custom" title="Customize timer presets">⋯</button>
      </div>`;
  }

  private currentDuration(): number {
    return (this.timer.mode === 'focus' ? this.timer.focusMin : this.timer.breakMin) * 60;
  }

  private toggleTimer(): void {
    if (this.timer.running) {
      this.stopTimerInterval();
      this.timer.running = false;
      this.renderTimer();
      return;
    }
    if (this.timer.remaining <= 0) this.timer.remaining = this.currentDuration();
    this.timer.running = true;
    this.timerTimer = window.setInterval(() => {
      this.timer.remaining -= 1;
      if (this.timer.remaining <= 0) {
        if (this.timer.mode === 'focus') {
          this.logFocus(this.timer.focusMin);
          this.timer.mode = 'break';
          this.timer.remaining = this.timer.breakMin * 60;
          this.flash('w-timer', 'Focus complete — take a break');
        } else {
          this.logBreak(this.timer.breakMin);
          this.timer.mode = 'focus';
          this.timer.remaining = this.timer.focusMin * 60;
          this.flash('w-timer', 'Break over — back to it');
        }
        this.timer.running = false;
        this.stopTimerInterval();
      }
      this.renderTimer();
    }, 1000);
    this.renderTimer();
  }

  private stopTimerInterval(): void {
    if (this.timerTimer) { clearInterval(this.timerTimer); this.timerTimer = undefined; }
  }

  private resetTimer(): void {
    this.stopTimerInterval();
    this.timer.running = false;
    this.timer.remaining = this.currentDuration();
    this.renderTimer();
  }

  private switchTimer(): void {
    this.stopTimerInterval();
    this.timer.running = false;
    this.timer.mode = this.timer.mode === 'focus' ? 'break' : 'focus';
    this.timer.remaining = this.currentDuration();
    this.renderTimer();
  }

  private setFocusMin(min: number): void {
    this.timer.focusMin = min;
    if (this.timer.mode === 'focus' && !this.timer.running) this.timer.remaining = min * 60;
    this.renderTimer();
  }

  private setBreakMin(min: number): void {
    this.timer.breakMin = min;
    if (this.timer.mode === 'break' && !this.timer.running) this.timer.remaining = min * 60;
    this.renderTimer();
  }

  private logFocus(minutes: number): void {
    this.focusLog.push({ date: getTodayString(), minutes });
    this.focusLog = this.focusLog.slice(-500);
    try { localStorage.setItem('hc-focus', JSON.stringify(this.focusLog)); } catch { /* ignore */ }
  }

  private logBreak(minutes: number): void {
    this.breakLog.push({ date: getTodayString(), minutes });
    this.breakLog = this.breakLog.slice(-500);
    try { localStorage.setItem('hc-breaks', JSON.stringify(this.breakLog)); } catch { /* ignore */ }
  }

  private renderMood(): void {
    const el = this.root.querySelector('#w-mood') as HTMLElement | null;
    if (!el) return;
    const size = this.sizeOf('mood');
    const todayMood = store.getTodayMood();
    const recent = store.getRecentMoods(size === 'lg' ? 21 : 7);
    const dots = recent.map(r => {
      const m = MOODS.find(x => x.key === r.mood);
      return `<span class="mood-dot${m ? ' active' : ''}" title="${r.date}${m ? ': ' + m.label : ''}">${m ? m.emoji : '·'}</span>`;
    }).join('');
    const avg = store.getRecentMoods(7).filter(r => r.mood).length;
    el.innerHTML = `
      <span class="widget-title">Mood${size === 'lg' ? ` <span class="widget-sub">last ${recent.length} days</span>` : ''}</span>
      <div class="mood-buttons mood-${size}">${MOODS.map(m => `<button class="mood-btn${todayMood === m.key ? ' active' : ''}" data-act="mood" data-mood="${m.key}" title="${m.label}">${m.emoji}</button>`).join('')}</div>
      ${size === 'sm' ? '' : `<div class="mood-dots">${dots}</div>`}
      ${size === 'lg' ? `<div class="widget-stat">${avg} logged this week</div>` : ''}`;
  }

  /* ── Water intake ────────────────────────────────────────── */
  private renderWater(): void {
    const el = this.root.querySelector('#w-water') as HTMLElement | null;
    if (!el) return;
    const size = this.sizeOf('water');
    const goal = store.waterGoal();
    const count = store.getTodayWater();
    const pct = Math.min(100, (count / goal) * 100);
    const waters = store.getState().waters;
    const history = size === 'lg'
      ? `<div class="water-week">${Array.from({ length: 7 }, (_, i) => {
          const d = getDateString(addDays(new Date(), -(6 - i)));
          const g = waters.find(x => x.date === d)?.glasses || 0;
          return `<span class="ww-cell${g >= goal ? ' full' : g ? ' part' : ''}" title="${d}: ${g}/${goal}" style="opacity:${d === getTodayString() ? 1 : 0.75}"></span>`;
        }).join('')}<span class="pt-label">7d</span></div>`
      : '';
    el.innerHTML = `
      <span class="widget-title">Water <span class="widget-sub">${count}/${goal}</span></span>
      <div class="water-bar"><div style="width:${pct}%"></div></div>
      <div class="water-actions">
        <button class="btn btn-sm btn-ghost" data-act="water-dec">−</button>
        <span class="water-cups">${'💧'.repeat(Math.min(count, goal))}${count > goal ? ' +' + (count - goal) : ''}</span>
        <button class="btn btn-sm btn-primary" data-act="water-inc">+</button>
      </div>${history}`;
  }

  /* ── Batch: complete / skip many ─────────────────────────── */
  private renderBatch(): void {
    const el = this.root.querySelector('#w-batch') as HTMLElement | null;
    if (!el) return;
    const size = this.sizeOf('batch');
    const limit = size === 'sm' ? 3 : size === 'lg' ? 50 : 6;
    const s = store.getState();
    const today = getTodayString();
    const due = s.habits.filter(h => {
      if (h.archivedAt || !store.isHabitScheduledToday(h)) return false;
      const c = s.completions.find(x => x.habitId === h.id && x.date === today);
      const done = h.mode === 'checkbox' ? !!c : !!(c && c.value >= h.target);
      return !done;
    }).slice(0, limit);
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
      </div>`;
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
  private renderCapture(): void {
    const el = this.root.querySelector('#w-capture') as HTMLElement | null;
    if (!el) return;
    const size = this.sizeOf('capture');
    const noteLimit = size === 'sm' ? 1 : size === 'lg' ? 8 : 4;
    const s = store.getState();
    const habits = s.habits.filter(h => !h.archivedAt);
    const notes = s.notes.slice(0, noteLimit);
    el.innerHTML = `
      <span class="widget-title">Quick capture${size === 'lg' ? ` <span class="widget-sub">${s.notes.length} total</span>` : ''}</span>
      <div class="capture-form">
        <input type="text" id="capture-input" placeholder="Note…" maxlength="140">
        ${size === 'sm' ? '' : `<select id="capture-select">
          <option value="">Habit (optional)</option>
          ${habits.map(h => `<option value="${h.id}">${h.icon} ${h.name}</option>`).join('')}
        </select>`}
        <button class="btn btn-sm btn-primary" data-act="note-add">Add</button>
      </div>
      <div class="note-list">
        ${notes.length ? notes.map(n => `<div class="note-row"><span class="note-text">${n.text}</span><button class="note-del" data-act="note-del" data-id="${n.id}" title="Delete">✕</button></div>`).join('') : '<div class="widget-empty">No notes yet</div>'}
      </div>`;
  }

  /* ── Neofetch system panel ───────────────────────────────── */
  private renderNeofetch(): void {
    const el = this.root.querySelector('#w-neofetch') as HTMLElement | null;
    if (!el) return;
    const size = this.sizeOf('neofetch');
    const s = store.getState();
    const habits = s.habits.filter(h => !h.archivedAt).length;
    const best = s.habits.reduce((m, h) => Math.max(m, store.getHabitStreak(h.id).current), 0);
    const p = store.todayProgress();
    const rows = [
      ['habits', habits],
      ['routines', s.routines.length],
      ['checks', s.completions.length],
      ['best🔥', best],
      ['shields', s.shields.filter(x => !x.usedAt).length],
      ['moods', s.moods.length],
      ['notes', s.notes.length],
    ];
    const shown = size === 'sm' ? rows.slice(0, 4) : rows;
    el.innerHTML = `
      <span class="widget-title">System${size === 'lg' ? ' <span class="widget-sub">full panel</span>' : ''}</span>
      <pre class="neofetch">${size === 'lg' ? 'today    ' + Math.round(store.todayProgress().pct * 100) + '%\n' : ''}${shown.map(([k, v]) => `${(k as string).padEnd(8)} ${v}`).join('\n')}</pre>`;
  }

  private flash(id: string, msg: string): void {
    const el = this.root.querySelector(`#${id}`) as HTMLElement | null;
    if (el) { el.classList.add('flash'); window.setTimeout(() => el.classList.remove('flash'), 1200); }
    createToast(msg, 'info');
  }
}

export function createWidgetRail(root: HTMLElement): WidgetRail {
  return new WidgetRail(root);
}
