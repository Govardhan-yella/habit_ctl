import { store } from '../stores/appStore';
import { Routine, Habit } from '../types';
import { getTodayString } from '../utils/date';
import { createTerminalBlock, createEmptyState, createProgressBar } from './TerminalUI';
import { habitTextStyle, renderRoutineLogo } from './appearance';

export class RoutinesComponent {
  private c: HTMLElement; private u: () => void;
  constructor(c: HTMLElement) { this.c = c; this.u = store.subscribe(() => this.render()); this.render(); }
  destroy() { this.u(); }
  render() {
    const s = store.getState(); const rs = s.routines; const hs = s.habits; const today = getTodayString();
    this.c.innerHTML = '';
    if (!rs.length) { this.c.appendChild(createEmptyState('📋', 'No routines', 'Group habits into routines', { label: 'Create', onClick: () => this.showForm() })); return; }
    const w = document.createElement('div'); w.className = 'routines-wrapper';
    const h = document.createElement('div'); h.className = 'routines-header';
    h.innerHTML = `<div class="routines-title"><span class="terminal-prompt">$</span><span class="routines-command">cat routines.txt</span></div><button class="btn btn-primary btn-sm" id="ar">+ New</button>`;
    h.querySelector('#ar')?.addEventListener('click', () => this.showForm());
    w.appendChild(h);
    const l = document.createElement('div'); l.className = 'routines-list';
    rs.forEach((r: Routine) => l.appendChild(this.makeItem(r, hs, today)));
    w.appendChild(l); this.c.appendChild(w);
  }
  private makeItem(r: Routine, hs: Habit[], today: string): HTMLElement {
    const rh = hs.filter(h => r.habitIds.includes(h.id));
    const cs = store.getState().completions;
    let done = 0; rh.forEach(h => { const c = cs.find(x => x.habitId===h.id && x.date===today); if (h.mode==='checkbox'?!!c:c&&c.value>=h.target) done++; });
    const total = rh.length; const pct = total?done/total*100:0; const complete = done===total&&total>0;
    const el = document.createElement('div'); el.className = `routine-item ${complete?'complete':''}`; el.dataset.rid = r.id;
    el.innerHTML = `<div class="routine-header"><div class="routine-indicator" style="background:${r.color}"></div><div class="routine-info"><div class="routine-name-row"><span class="routine-icon">${renderRoutineLogo(r)}</span><span class="routine-name"${habitTextStyle(r)}>${r.name}</span><span class="routine-schedule">${this.sched(r.schedule)}</span></div><div class="routine-progress">${createProgressBar(pct, 100, r.color).outerHTML}<span class="routine-count">${done}/${total}</span></div></div><div class="routine-actions"><button class="btn btn-ghost btn-sm btn-edit" data-id="${r.id}">Edit</button><button class="btn btn-ghost btn-sm btn-del" data-id="${r.id}">Delete</button></div></div><div class="routine-habits">${rh.map(h=>this.habitEl(h,today)).join('')}</div>`;
    el.querySelector('.btn-edit')?.addEventListener('click', e=>{e.stopPropagation();this.showForm(r);});
    el.querySelector('.btn-del')?.addEventListener('click', e=>{e.stopPropagation();if(confirm(`Delete "${r.name}"?`))store.deleteRoutine(r.id);});
    return el;
  }
  private habitEl(h: Habit, today: string): string { const cs = store.getState().completions; const c = cs.find(x=>x.habitId===h.id&&x.date===today); const d = h.mode==='checkbox'?!!c:c&&c.value>=h.target; const icons={checkbox:'☐',counter:'⊞',number:'⌗',timer:'⏱',health:'♥'}; return `<div class="routine-habit ${d?'done':''}"><span style="color:${h.color}">${icons[h.mode]}</span><span${habitTextStyle(h)}>${h.name}</span><span>${d?'✓':'○'}</span></div>`; }
  private sched(s: any): string { switch(s.type){case'daily':return'Daily';case'weekdays':return'Mon-Fri';case'custom':return['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].filter((_,i)=>s.days?.includes(i)).join(', ');default:return'Custom';}}
  private showForm(r?: Routine) { window.dispatchEvent(new CustomEvent('show-routine-form',{detail:r})); }
}
export function createRoutines(c: HTMLElement) { return new RoutinesComponent(c); }