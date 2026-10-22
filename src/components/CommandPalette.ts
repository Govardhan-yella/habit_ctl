import { store } from '../stores/appStore';
import { createModal } from './TerminalUI';

export function openCommandPalette() {
  const content = document.createElement('div');
  content.className = 'command-palette';
  content.innerHTML = `
    <div class="cp-input-wrap">
      <span class="cp-prompt">></span>
      <input type="text" id="cp-input" class="cp-input" placeholder="Type a command or search habits..." autocomplete="off">
    </div>
    <div class="cp-list" id="cp-list"></div>
  `;
  const overlay = createModal('Command Palette', content, () => {});
  const modalClose = () => { if (document.body.contains(overlay)) document.body.removeChild(overlay); };
  const input = content.querySelector('#cp-input') as HTMLInputElement;
  const list = content.querySelector('#cp-list') as HTMLElement;
  input.focus();

  type Item = { id: string; label: string; group: string; action: () => void };
  const items: Item[] = [
    { id: 'view-list', label: 'Go to List', group: 'View', action: () => { store.setView('list'); modalClose(); } },
    { id: 'view-heatmap', label: 'Go to Heatmap', group: 'View', action: () => { store.setView('heatmap'); modalClose(); } },
    { id: 'view-routines', label: 'Go to Routines', group: 'View', action: () => { store.setView('routines'); modalClose(); } },
    { id: 'view-stats', label: 'Go to Stats', group: 'View', action: () => { store.setView('stats'); modalClose(); } },
    { id: 'view-settings', label: 'Go to Settings', group: 'View', action: () => { store.setView('settings'); modalClose(); } },
    { id: 'add-habit', label: 'Add New Habit', group: 'Action', action: () => { modalClose(); window.dispatchEvent(new CustomEvent('show-habit-form')); } },
    { id: 'add-routine', label: 'Add New Routine', group: 'Action', action: () => { modalClose(); window.dispatchEvent(new CustomEvent('show-routine-form')); } },
    { id: 'today', label: 'Go to Today', group: 'Navigation', action: () => { store.goToToday(); modalClose(); } },
    { id: 'sync', label: 'Sync Now', group: 'Sync', action: async () => { modalClose(); const res = await store.syncNow(); const { createToast } = await import('./TerminalUI'); createToast(res.message, res.ok ? 'success' : 'error'); } },
  ];
  for (const h of store.getState().habits.filter(h => !h.archivedAt)) {
    items.push({ id: `habit-${h.id}`, label: h.name, group: 'Habits', action: () => { store.setView('list'); modalClose(); setTimeout(() => { document.querySelectorAll('.habit-item').forEach((el, i) => { if ((el as HTMLElement).textContent?.includes(h.name)) (el as HTMLElement).scrollIntoView({ block: 'center' }); }); }, 150); } });
  }

  let idx = 0;
  function render(q: string) {
    const qq = q.toLowerCase().trim();
    const filtered = qq ? items.filter(i => i.label.toLowerCase().includes(qq) || i.group.toLowerCase().includes(qq)) : items;
    list.innerHTML = filtered.map((it, i) => `<div class="cp-item ${i===idx?'active':''}" data-i="${i}"><span class="cp-group">${it.group}</span><span class="cp-label">${it.label}</span></div>`).join('');
    list.querySelectorAll('.cp-item').forEach((el, i) => {
      el.addEventListener('click', () => { filtered[i].action(); });
    });
    return filtered;
  }

  let filtered = render('');
  input.addEventListener('input', () => { idx = 0; filtered = render(input.value); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx + 1) % filtered.length; filtered = render(input.value); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = (idx - 1 + filtered.length) % filtered.length; filtered = render(input.value); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[idx]?.action(); }
  });
}
