import { store } from '../stores/appStore';
import { getTodayString, getDateString, addDays, subDays, getYearStart, getDayOfYear, getHeatmapLevel } from '../utils/date';
import { createTerminalBlock, createEmptyState } from './TerminalUI';

export class HeatmapComponent {
  private container: HTMLElement; private unsubscribe: () => void; private year: number;
  constructor(c: HTMLElement) { this.container = c; this.year = new Date().getFullYear(); this.unsubscribe = store.subscribe(() => this.render()); this.render(); }
  destroy() { this.unsubscribe(); }
  render() {
    const state = store.getState();
    const data = store.getHeatmapData(this.year);
    const today = getTodayString();
    const sel = state.selectedDate;

    this.container.innerHTML = '';
    const wrap = document.createElement('div'); wrap.className = 'heatmap-wrapper';
    const header = document.createElement('div'); header.className = 'heatmap-header';
    header.innerHTML = `<div class="heatmap-title"><span class="terminal-prompt">$</span><span class="heatmap-command">cat heatmap_${this.year}.txt</span></div><div class="heatmap-controls"><button class="btn btn-ghost btn-sm" id="py">‹</button><span class="heatmap-year">${this.year}</span><button class="btn btn-ghost btn-sm" id="ny">›</button><button class="btn btn-ghost btn-sm" id="td">Today</button></div>`;
    header.querySelector('#py')?.addEventListener('click', () => this.changeYear(-1));
    header.querySelector('#ny')?.addEventListener('click', () => this.changeYear(1));
    header.querySelector('#td')?.addEventListener('click', () => this.goToday());
    wrap.appendChild(header);

    if (data.size === 0) { wrap.appendChild(createEmptyState('📊', 'No activity', 'Complete habits to fill graph', { label: 'Add Habit', onClick: () => window.dispatchEvent(new CustomEvent('show-habit-form')) })); this.container.appendChild(wrap); return; }

    wrap.appendChild(this.createGrid(data, today, sel));
    wrap.appendChild(this.createLegend());
    wrap.appendChild(this.createStats(data));
    this.container.appendChild(wrap);
  }

  private createGrid(data: Map<string, number>, today: string, sel: string): HTMLElement {
    const g = document.createElement('div'); g.className = 'heatmap-grid';
    const start = getYearStart(new Date(this.year, 0, 1));
    const fdow = start.getDay();
    const days = new Date(this.year, 11, 31).getDate() + 334;
    const weeks = Math.ceil((days + fdow) / 7);
    const max = Math.max(...data.values(), 1);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const daysLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    let html = '<div class="heatmap-months">';
    let cm = -1;
    for (let w = 0; w < weeks; w++) {
      const ws = addDays(start, w * 7 - fdow);
      const m = ws.getMonth();
      if (m !== cm && m >= 0 && m < 12) { cm = m; const wo = Math.max(0, Math.floor((getDayOfYear(new Date(this.year, m, 1)) + fdow) / 7)); html += `<div class="heatmap-month-label" style="grid-column:${wo+1}">${months[m]}</div>`; }
    }
    html += '</div><div class="heatmap-days">' + daysLabels.map(d => `<div class="heatmap-day-label">${d}</div>`).join('') + '</div><div class="heatmap-cells">';

    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const di = w * 7 + d - fdow;
        if (di < 0 || di >= days) { html += '<div class="heatmap-cell empty"></div>'; continue; }
        const dt = addDays(start, di);
        const ds = getDateString(dt);
        const cnt = data.get(ds) || 0;
        const lvl = getHeatmapLevel(cnt, max);
        const td = ds === today, sd = ds === sel, fut = dt > new Date(today);
        let cls = `heatmap-cell level-${lvl}`; if (td) cls += ' today'; if (sd) cls += ' selected'; if (fut) cls += ' future'; if (cnt) cls += ' has-activity';
        html += `<div class="${cls}" data-date="${ds}" data-count="${cnt}" data-level="${lvl}" title="${ds}: ${cnt} completion${cnt!==1?'s':''}" role="button" tabindex="0"></div>`;
      }
    }
    html += '</div>'; g.innerHTML = html;
    g.querySelectorAll('.heatmap-cell:not(.empty)').forEach(c => { c.addEventListener('click', () => store.setSelectedDate(c.getAttribute('data-date')!)); c.addEventListener('keydown', e => { const ke = e as KeyboardEvent; if (ke.key==='Enter'||ke.key===' ') { ke.preventDefault(); store.setSelectedDate(c.getAttribute('data-date')!); } }); });
    return g;
  }

  private createLegend(): HTMLElement { const l = document.createElement('div'); l.className = 'heatmap-legend'; l.innerHTML = `<span class="legend-label">Less</span><div class="legend-colors"><div class="legend-color level-0" style="background:var(--heatmap-0)"></div><div class="legend-color level-1" style="background:var(--heatmap-1)"></div><div class="legend-color level-2" style="background:var(--heatmap-2)"></div><div class="legend-color level-3" style="background:var(--heatmap-3)"></div><div class="legend-color level-4" style="background:var(--heatmap-4)"></div></div><span class="legend-label">More</span>`; return l; }

  private createStats(data: Map<string, number>): HTMLElement {
    const total = [...data.values()].reduce((a,b)=>a+b,0);
    const active = [...data.values()].filter(v=>v>0).length;
    const cs = this.calcCurrentStreak(data);
    const ls = this.calcLongestStreak(data);
    const s = document.createElement('div'); s.className = 'heatmap-stats';
    s.innerHTML = `<div class="stat"><span class="stat-value">${total}</span><span class="stat-label">Total</span></div><div class="stat"><span class="stat-value">${active}</span><span class="stat-label">Active Days</span></div><div class="stat"><span class="stat-value">${cs}</span><span class="stat-label">Current Streak</span></div><div class="stat"><span class="stat-value">${ls}</span><span class="stat-label">Longest Streak</span></div>`;
    return s;
  }

  private calcCurrentStreak(data: Map<string, number>): number { const today = getTodayString(); let s = 0; let d = new Date(today); while (true) { const ds = getDateString(d); if (data.get(ds)! > 0) { s++; d = subDays(d, 1); } else break; if (s > 365) break; } return s; }
  private calcLongestStreak(data: Map<string, number>): number { const dates = [...data.keys()].sort(); let ls = 0, cs = 0, ld: Date|null = null; for (const ds of dates) { const d = new Date(ds+'T00:00:00'); if (ld && this.daysBetween(ld, d)===1) cs++; else { ls = Math.max(ls, cs); cs = 1; } ld = d; } return Math.max(ls, cs); }
  private daysBetween(d1: Date, d2: Date): number { return Math.floor((new Date(d2.getFullYear(),d2.getMonth(),d2.getDate()).getTime() - new Date(d1.getFullYear(),d1.getMonth(),d1.getDate()).getTime())/(1000*60*60*24)); }

  private changeYear(d: number) { this.year += d; this.render(); }
  private goToday() { this.year = new Date().getFullYear(); store.goToToday(); }
}

export function createHeatmap(c: HTMLElement) { return new HeatmapComponent(c); }