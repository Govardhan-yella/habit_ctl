import { store } from '../stores/appStore';
import { Habit, HabitMode, ScheduleType, Reminder, Template } from '../types';
import { requestNotificationPermission } from '../services/reminders';
import { createModal, createToast } from './TerminalUI';
import { ICON_GROUPS as TABLER_GROUPS, iconByName } from '../data/tablerIcons';

/** Legacy emoji set kept for backward compatibility / "Emoji" tab. */
const EMOJI_GROUPS: { label: string; icons: string[] }[] = [
  { label: 'Fitness', icons: ['🏃', '💪', '🚴', '🏊', '🧘', '🤸', '🥊', '⚽', '🏋️', '🚶'] },
  { label: 'Mind & Learn', icons: ['📚', '🧠', '✍️', '📝', '🎓', '💡', '🗣️', '🌍'] },
  { label: 'Health', icons: ['💧', '🥗', '😴', '🍎', '❤️', '🦷', '🧴', '💊', '🚭'] },
  { label: 'Work & Money', icons: ['💻', '💰', '📈', '🗂️', '✉️', '📅', '⚙️', '🎯'] },
  { label: 'Creative', icons: ['🎸', '🎨', '🎵', '📷', '🎬', '✏️', '🧶', '🎹'] },
  { label: 'Life', icons: ['🌱', '☀️', '🌙', '⏰', '🔥', '✅', '🧹', '🐶', '🙏', '🎁'] },
];

/** Nerd Font PUA glyphs — only shown when a Nerd Font is detected. */
const NERD_GLYPHS: { label: string; glyphs: { ch: string; name: string }[] }[] = [
  { label: 'Dev', glyphs: [
    { ch: '\ue796', name: 'code' }, { ch: '\ue702', name: 'git' }, { ch: '\ue725', name: 'branch' },
    { ch: '\uf120', name: 'terminal' }, { ch: '\uf308', name: 'docker' }, { ch: '\ue73c', name: 'python' },
    { ch: '\ue718', name: 'node' }, { ch: '\ue781', name: 'js' }, { ch: '\ue7ba', name: 'react' },
    { ch: '\uf1c0', name: 'database' }, { ch: '\uf0c2', name: 'cloud' }, { ch: '\uf013', name: 'gear' },
    { ch: '\uf00c', name: 'check' }, { ch: '\uf06d', name: 'flame' }, { ch: '\uf02d', name: 'book' }, { ch: '\uf004', name: 'heart' },
  ]},
];

const COLOR_SWATCHES = [
  '#7aa2f7', '#bb9af7', '#f7768e', '#ff9e64', '#e0af68', '#9ece6a',
  '#73daca', '#7dcfff', '#b4f9f8', '#ff7edb', '#c0caf5', '#a9b1d6',
  '#4ade80', '#fbbf24', '#f87171', '#38bdf8', '#a78bfa', '#fb7185',
];

function isNerdFontAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.font = '16px monospace';
    const monoW = ctx.measureText('\ue796').width;
    ctx.font = '16px "Symbols Nerd Font", "JetBrainsMono Nerd Font", "Hack Nerd Font", "FiraCode Nerd Font", monospace';
    const nerdW = ctx.measureText('\ue796').width;
    return nerdW !== monoW;
  } catch { return false; }
}

/** Downscale a File to a JPEG data URL capped at maxPx (keeps icons small). */
async function downscaleImage(file: File, maxPx = 128, quality = 0.85): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function renderTablerIcon(name: string, size = 22): string {
  const ic = iconByName(name);
  if (!ic) return '';
  return ic.svg.replace(/width="24" height="24"/, `width="${size}" height="${size}"`);
}

/** Open the New Habit / Edit Habit modal. Pass a habit to edit, omit to create. */
export function openHabitForm(habit?: Habit): void {
  const isEdit = !!habit;
  const schedType: ScheduleType = habit?.schedule.type || 'daily';
  const reminders: Reminder[] = habit?.reminders ? habit.reminders.map(r => ({ ...r, days: [...r.days] })) : [];
  const templates: Template[] = store.getState().templates;
  const nerdAvailable = isNerdFontAvailable();

  const initialIcon = habit?.icon ?? '';
  const isInitialData = initialIcon.startsWith('data:');
  const isInitialTabler = initialIcon.startsWith('tabler:');
  const isInitialNerd = initialIcon.startsWith('nerd:');
  // A brand-new habit starts on the Icons tab, which is also where the default
  // logo (tabler:run) comes from.
  let activeTab: 'icons' | 'emoji' | 'dev' | 'upload' =
    !initialIcon ? 'icons'
      : isInitialTabler ? 'icons'
      : isInitialNerd ? 'dev'
      : isInitialData ? 'upload'
      : 'emoji';

  const content = document.createElement('div');
  content.className = 'habit-form';
  const modeOpts: HabitMode[] = ['checkbox', 'counter', 'number', 'timer', 'health'];

  const tablerHtml = TABLER_GROUPS.map(g => `
    <div class="icon-group">
      <span class="icon-group-label">${g.label}</span>
      <div class="icon-picker icon-picker-tabler">
        ${g.icons.map(ic => `<button type="button" class="icon-pick icon-pick-svg" data-tabler="${ic.name}" title="${ic.name}" aria-label="${ic.name}">${ic.svg.replace(/width="24" height="24"/, 'width="22" height="22"')}</button>`).join('')}
      </div>
    </div>
  `).join('');

  const emojiHtml = EMOJI_GROUPS.map(g => `
    <div class="icon-group">
      <span class="icon-group-label">${g.label}</span>
      <div class="icon-picker">
        ${g.icons.map(ic => `<button type="button" class="icon-pick" data-emoji="${ic}">${ic}</button>`).join('')}
      </div>
    </div>
  `).join('');

  const devHtml = nerdAvailable
    ? NERD_GLYPHS.map(g => `
      <div class="icon-group">
        <span class="icon-group-label">${g.label}</span>
        <div class="icon-picker icon-picker-nerd">
          ${g.glyphs.map(gl => `<button type="button" class="icon-pick icon-pick-nerd" data-nerd="${gl.ch}" title="${gl.name}" aria-label="${gl.name}">${gl.ch}</button>`).join('')}
        </div>
      </div>
    `).join('')
    : `<div class="icon-empty">No Nerd Font detected. Install a patched Nerd Font to use dev glyphs.</div>`;

  content.innerHTML = `
    ${!isEdit && templates.length ? `<div class="form-group"><label>Start from template</label><select id="h-template"><option value="">— none —</option>${templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}</select></div>` : ''}
    <div class="form-group"><label>Name</label><input type="text" id="h-name" required placeholder="e.g., Morning run" value="${habit?.name ?? ''}"></div>
    <div class="form-group">
      <label>Logo</label>
      <div class="logo-row">
        <div class="logo-preview" id="h-logo-preview"></div>
        <input type="text" id="h-icon" value="" maxlength="4" placeholder="Custom emoji or text">
        <label class="logo-upload" title="Upload a custom image (auto-downscaled)">
          <input type="file" id="h-logo-file" accept="image/*" hidden>⬆ Upload
        </label>
      </div>
      <div class="logo-tabs">
        <button type="button" class="logo-tab ${activeTab === 'icons' ? 'active' : ''}" data-tab="icons">Icons</button>
        <button type="button" class="logo-tab ${activeTab === 'emoji' ? 'active' : ''}" data-tab="emoji">Emoji</button>
        <button type="button" class="logo-tab ${activeTab === 'dev' ? 'active' : ''}" data-tab="dev">Dev</button>
        <button type="button" class="logo-tab ${activeTab === 'upload' ? 'active' : ''}" data-tab="upload">Upload</button>
      </div>
      <div class="icon-groups" id="logo-panel-icons" style="display:${activeTab === 'icons' ? 'flex' : 'none'}">${tablerHtml}</div>
      <div class="icon-groups" id="logo-panel-emoji" style="display:${activeTab === 'emoji' ? 'flex' : 'none'}">${emojiHtml}</div>
      <div class="icon-groups" id="logo-panel-dev" style="display:${activeTab === 'dev' ? 'flex' : 'none'}">${devHtml}</div>
      <div class="logo-upload-panel" id="logo-panel-upload" style="display:${activeTab === 'upload' ? 'flex' : 'none'}">
        <span class="rem-empty">Upload any image — it will be downscaled to ~128px on-device.</span>
      </div>
    </div>
    <div class="form-group">
      <label>Colour</label>
      <div class="color-row">
        <input type="color" id="h-color" value="${habit?.color ?? '#7aa2f7'}">
        <div class="color-swatches">${COLOR_SWATCHES.map(c => `<button type="button" class="color-swatch" data-color="${c}" style="background:${c}"></button>`).join('')}</div>
      </div>
    </div>
    <div class="form-group">
      <label>Text colour</label>
      <div class="color-row">
        <label class="toggle-inline" title="Use the theme's text colour for the habit name">
          <input type="checkbox" id="h-textcolor-on" ${habit?.textColor ? 'checked' : ''}> Custom
        </label>
        <input type="color" id="h-textcolor" value="${habit?.textColor ?? '#e6e6e6'}" ${habit?.textColor ? '' : 'disabled'}>
        <div class="color-swatches" id="h-textcolor-swatches" ${habit?.textColor ? '' : 'style="display:none"'}>${COLOR_SWATCHES.map(c => `<button type="button" class="color-swatch" data-textcolor="${c}" style="background:${c}"></button>`).join('')}</div>
      </div>
      <span class="setting-hint">Applies to the habit name only. Leave off to inherit the theme text colour.</span>
    </div>
    <div class="form-group"><label>Mode</label><select id="h-mode">${modeOpts.map(m => `<option value="${m}" ${habit?.mode === m ? 'selected' : ''}>${m[0].toUpperCase()}${m.slice(1)}</option>`).join('')}</select></div>
    <div class="form-group" id="target-group" style="display:${habit && habit.mode !== 'checkbox' ? 'block' : 'none'}"><label>Target</label><input type="number" id="h-target" value="${habit?.target ?? 1}" min="1"></div>
    <div class="form-group" id="unit-group" style="display:${habit && habit.mode !== 'checkbox' ? 'block' : 'none'}"><label>Unit (optional)</label><input type="text" id="h-unit" placeholder="km, pages, min" value="${habit?.unit ?? ''}"></div>
    <div class="form-group"><label>Schedule</label><select id="h-sched"><option value="daily" ${schedType === 'daily' ? 'selected' : ''}>Daily</option><option value="weekdays" ${schedType === 'weekdays' ? 'selected' : ''}>Weekdays</option><option value="custom" ${schedType === 'custom' ? 'selected' : ''}>Custom</option></select></div>
    <div class="form-group" id="custom-days" style="display:${schedType === 'custom' ? 'block' : 'none'}"><label>Days</label><div class="day-checkboxes">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => `<label><input type="checkbox" value="${i}" ${habit?.schedule.days?.includes(i) ? 'checked' : ''}> ${d}</label>`).join('')}</div></div>
    <div class="form-group"><label>Reminders</label><div id="rem-list" class="rem-list"></div><button type="button" class="btn btn-ghost btn-sm" id="rem-add">+ Add reminder</button></div>
    <div class="form-actions">
      <button class="btn btn-ghost btn-sm" id="h-save-tpl" title="Save these settings as a reusable template">Save as template</button>
      <span class="form-spacer"></span>
      <button class="btn btn-ghost" id="h-cancel">Cancel</button><button class="btn btn-primary" id="h-save">${isEdit ? 'Save' : 'Create'}</button>
    </div>
  `;

  createModal(isEdit ? 'Edit Habit' : 'New Habit', content, () => {});

  function syncModeVisibility(): void {
    const show = (content.querySelector('#h-mode') as HTMLSelectElement).value !== 'checkbox';
    (content.querySelector('#target-group') as HTMLElement).style.display = show ? 'block' : 'none';
    (content.querySelector('#unit-group') as HTMLElement).style.display = show ? 'block' : 'none';
  }
  function syncSchedVisibility(): void {
    (content.querySelector('#custom-days') as HTMLElement).style.display = (content.querySelector('#h-sched') as HTMLSelectElement).value === 'custom' ? 'block' : 'none';
  }

  function renderReminders(): void {
    const remList = content.querySelector('#rem-list') as HTMLElement;
    remList.innerHTML = reminders.length ? reminders.map(r => `
      <div class="rem-item" data-id="${r.id}">
        <input type="time" class="rem-time" value="${r.time}">
        <div class="rem-days">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => `<label class="rem-day" title="${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}"><input type="checkbox" value="${i}" ${r.days.includes(i) ? 'checked' : ''}>${d}</label>`).join('')}</div>
        <button type="button" class="btn btn-ghost btn-sm rem-remove" title="Remove">✕</button>
      </div>`).join('') : '<span class="rem-empty">No reminders</span>';
    remList.querySelectorAll('.rem-item').forEach(item => {
      const id = item.getAttribute('data-id')!;
      const r = reminders.find(x => x.id === id)!;
      item.querySelector('.rem-time')?.addEventListener('change', e => { r.time = (e.target as HTMLInputElement).value; });
      item.querySelectorAll('.rem-day input').forEach(cb => cb.addEventListener('change', () => {
        r.days = Array.from(item.querySelectorAll('.rem-day input:checked')).map(c => parseInt((c as HTMLInputElement).value));
      }));
      item.querySelector('.rem-remove')?.addEventListener('click', () => {
        const idx = reminders.findIndex(x => x.id === id);
        if (idx >= 0) reminders.splice(idx, 1);
        renderReminders();
      });
    });
  }

  const iconInput = content.querySelector('#h-icon') as HTMLInputElement;
  const logoPreview = content.querySelector('#h-logo-preview') as HTMLElement;
  const colorInput = content.querySelector('#h-color') as HTMLInputElement;

  function setLogo(value: string): void {
    iconInput.value = value.startsWith('data:') || value.startsWith('tabler:') || value.startsWith('nerd:') ? '' : value;
    if (value.startsWith('data:')) {
      logoPreview.innerHTML = `<img src="${value}" alt="">`;
    } else if (value.startsWith('tabler:')) {
      const name = value.slice('tabler:'.length);
      logoPreview.innerHTML = renderTablerIcon(name, 26) || '✦';
    } else if (value.startsWith('nerd:')) {
      const ch = value.slice('nerd:'.length);
      logoPreview.innerHTML = `<span class="logo-nerd">${ch}</span>`;
    } else {
      logoPreview.innerHTML = value || '✦';
    }
    logoPreview.dataset.value = value;
    // keep tint in sync with current color if it's an SVG
    applyLogoColor();
  }

  function applyLogoColor(): void {
    logoPreview.querySelectorAll('svg').forEach(svg => {
      (svg as SVGElement).style.color = colorInput.value;
    });
  }

  function currentLogo(): string {
    const dataVal = logoPreview.dataset.value;
    if (dataVal && (dataVal.startsWith('data:') || dataVal.startsWith('tabler:') || dataVal.startsWith('nerd:'))) return dataVal;
    return (iconInput.value || '✦').trim();
  }

  // Tabs
  content.querySelectorAll('.logo-tab').forEach(tab => tab.addEventListener('click', () => {
    content.querySelectorAll('.logo-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const which = tab.getAttribute('data-tab');
    content.querySelectorAll('.icon-groups, .logo-upload-panel').forEach(p => (p as HTMLElement).style.display = 'none');
    (content.querySelector(`#logo-panel-${which}`) as HTMLElement).style.display = which === 'upload' ? 'flex' : 'flex';
  }));

  // Tabler icons
  content.querySelectorAll('.icon-pick-svg').forEach(btn => btn.addEventListener('click', () => {
    const name = btn.getAttribute('data-tabler')!;
    setLogo(`tabler:${name}`);
    content.querySelectorAll('.icon-pick').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    content.querySelectorAll('.logo-tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === 'icons'));
    content.querySelectorAll('.icon-groups, .logo-upload-panel').forEach(p => (p as HTMLElement).style.display = 'none');
    (content.querySelector('#logo-panel-icons') as HTMLElement).style.display = 'flex';
  }));

  // Emoji
  content.querySelectorAll('.icon-pick[data-emoji]').forEach(btn => btn.addEventListener('click', () => {
    setLogo(btn.getAttribute('data-emoji')!);
    content.querySelectorAll('.icon-pick').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    content.querySelectorAll('.logo-tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === 'emoji'));
    content.querySelectorAll('.icon-groups, .logo-upload-panel').forEach(p => (p as HTMLElement).style.display = 'none');
    (content.querySelector('#logo-panel-emoji') as HTMLElement).style.display = 'flex';
  }));

  // Nerd glyphs
  content.querySelectorAll('.icon-pick-nerd').forEach(btn => btn.addEventListener('click', () => {
    setLogo(`nerd:${btn.getAttribute('data-nerd')!}`);
    content.querySelectorAll('.icon-pick').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    content.querySelectorAll('.logo-tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === 'dev'));
    content.querySelectorAll('.icon-groups, .logo-upload-panel').forEach(p => (p as HTMLElement).style.display = 'none');
    (content.querySelector('#logo-panel-dev') as HTMLElement).style.display = 'flex';
  }));

  // Custom emoji/text
  iconInput.addEventListener('input', () => {
    if (!iconInput.value) return;
    content.querySelectorAll('.icon-pick').forEach(b => b.classList.remove('active'));
    setLogo(iconInput.value);
  });

  // Upload with downscale
  content.querySelector('#h-logo-file')?.addEventListener('change', async e => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const dataUrl = await downscaleImage(f, 128, 0.85);
      setLogo(dataUrl);
      content.querySelectorAll('.icon-pick').forEach(b => b.classList.remove('active'));
      content.querySelectorAll('.logo-tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === 'upload'));
      content.querySelectorAll('.icon-groups, .logo-upload-panel').forEach(p => (p as HTMLElement).style.display = 'none');
      (content.querySelector('#logo-panel-upload') as HTMLElement).style.display = 'flex';
      createToast('Logo added (downscaled)', 'success');
    } catch {
      createToast('Failed to load image', 'error');
    }
    (e.target as HTMLInputElement).value = '';
  });

  function syncColorActive(): void {
    content.querySelectorAll('.color-swatch[data-color]').forEach(s => {
      s.classList.toggle('active', s.getAttribute('data-color')?.toLowerCase() === colorInput.value.toLowerCase());
    });
  }
  content.querySelectorAll('.color-swatch[data-color]').forEach(btn => btn.addEventListener('click', () => {
    colorInput.value = btn.getAttribute('data-color')!;
    syncColorActive();
    applyLogoColor();
  }));
  colorInput.addEventListener('input', () => { syncColorActive(); applyLogoColor(); });
  syncColorActive();

  // ---- Text colour (optional override for the habit name) ----
  const textColorInput = content.querySelector('#h-textcolor') as HTMLInputElement;
  const textColorToggle = content.querySelector('#h-textcolor-on') as HTMLInputElement;
  const textSwatches = content.querySelector('#h-textcolor-swatches') as HTMLElement;

  function syncTextColorState(): void {
    const on = textColorToggle.checked;
    textColorInput.disabled = !on;
    textSwatches.style.display = on ? 'flex' : 'none';
    syncTextColorActive();
  }
  function syncTextColorActive(): void {
    textSwatches.querySelectorAll('.color-swatch[data-textcolor]').forEach(s => {
      s.classList.toggle('active', s.getAttribute('data-textcolor')?.toLowerCase() === textColorInput.value.toLowerCase());
    });
  }
  textColorToggle.addEventListener('change', syncTextColorState);
  textColorInput.addEventListener('input', syncTextColorActive);
  textSwatches.querySelectorAll('.color-swatch[data-textcolor]').forEach(btn => btn.addEventListener('click', () => {
    textColorInput.value = btn.getAttribute('data-textcolor')!;
    syncTextColorActive();
  }));
  syncTextColorState();

  // Restore initial icon
  if (initialIcon) {
    if (isInitialTabler) {
      setLogo(initialIcon);
      const name = initialIcon.slice('tabler:'.length);
      content.querySelector(`.icon-pick-svg[data-tabler="${CSS.escape(name)}"]`)?.classList.add('active');
    } else if (isInitialNerd) {
      setLogo(initialIcon);
      content.querySelector(`.icon-pick-nerd[data-nerd="${initialIcon.slice('nerd:'.length)}"]`)?.classList.add('active');
    } else if (isInitialData) {
      setLogo(initialIcon);
    } else {
      setLogo(initialIcon);
      content.querySelectorAll('.icon-pick[data-emoji]').forEach(btn => {
        if (btn.getAttribute('data-emoji') === initialIcon) btn.classList.add('active');
      });
      iconInput.value = initialIcon.length <= 4 ? initialIcon : '';
    }
    applyLogoColor();
  } else {
    // default to first tabler icon
    setLogo('tabler:run');
    applyLogoColor();
  }

  function applyTemplate(t: Template): void {
    (content.querySelector('#h-name') as HTMLInputElement).value = t.name;
    setLogo(t.icon);
    (content.querySelector('#h-color') as HTMLInputElement).value = t.color;
    syncColorActive();
    applyLogoColor();
    // templates carry no text colour, so fall back to the theme default
    textColorToggle.checked = false;
    syncTextColorState();
    (content.querySelector('#h-mode') as HTMLSelectElement).value = t.mode;
    (content.querySelector('#h-target') as HTMLInputElement).value = String(t.target);
    (content.querySelector('#h-unit') as HTMLInputElement).value = t.unit || '';
    (content.querySelector('#h-sched') as HTMLSelectElement).value = t.schedule.type;
    content.querySelectorAll('#custom-days input').forEach(cb => {
      (cb as HTMLInputElement).checked = t.schedule.days?.includes(parseInt((cb as HTMLInputElement).value)) ?? false;
    });
    reminders.length = 0;
    for (const r of t.reminders || []) reminders.push({ ...r, id: crypto.randomUUID(), days: [...r.days] });
    renderReminders();
    syncModeVisibility();
    syncSchedVisibility();
  }

  content.querySelector('#h-template')?.addEventListener('change', e => {
    const id = (e.target as HTMLSelectElement).value;
    const t = templates.find(x => x.id === id);
    if (t) applyTemplate(t);
  });

  content.querySelector('#h-mode')?.addEventListener('change', syncModeVisibility);
  content.querySelector('#h-sched')?.addEventListener('change', syncSchedVisibility);
  content.querySelector('#rem-add')?.addEventListener('click', async () => {
    await requestNotificationPermission();
    reminders.push({ id: crypto.randomUUID(), time: '09:00', days: [], enabled: true });
    renderReminders();
  });
  content.querySelector('#h-cancel')?.addEventListener('click', () => document.querySelector('.modal-overlay')?.remove());

  function currentValues() {
    const name = (content.querySelector('#h-name') as HTMLInputElement).value.trim();
    const mode = (content.querySelector('#h-mode') as HTMLSelectElement).value as HabitMode;
    const st = (content.querySelector('#h-sched') as HTMLSelectElement).value as ScheduleType;
    const schedule: { type: ScheduleType; days?: number[] } = { type: st };
    if (st === 'custom') schedule.days = Array.from(content.querySelectorAll('#custom-days input:checked')).map(cb => parseInt((cb as HTMLInputElement).value));
    const icon = currentLogo() || '✦';
    const color = (content.querySelector('#h-color') as HTMLInputElement).value;
    const textColor = textColorToggle.checked ? textColorInput.value : undefined;
    const target = parseInt((content.querySelector('#h-target') as HTMLInputElement).value) || 1;
    const unit = (content.querySelector('#h-unit') as HTMLInputElement).value || undefined;
    return { name, mode, schedule, icon, color, textColor, target, unit };
  }

  content.querySelector('#h-save-tpl')?.addEventListener('click', () => {
    const v = currentValues();
    if (!v.name) { createToast('Name the habit first', 'error'); return; }
    const tplName = window.prompt('Template name', v.name);
    if (!tplName) return;
    store.saveTemplate({ name: tplName.trim(), mode: v.mode, target: v.target, unit: v.unit, schedule: v.schedule, reminders: reminders.map(r => ({ ...r, days: [...r.days] })), icon: v.icon, color: v.color });
    createToast('Template saved', 'success');
  });
  content.querySelector('#h-save')?.addEventListener('click', async () => {
    const v = currentValues();
    if (!v.name) return;
    if (isEdit) {
      await store.updateHabit({ ...habit!, ...v, reminders });
      createToast('Habit updated', 'success');
    } else {
      await store.createHabit({ ...v, reminders });
      createToast('Habit created', 'success');
    }
    document.querySelector('.modal-overlay')?.remove();
  });
  renderReminders();
  syncModeVisibility();
  syncSchedVisibility();
}
