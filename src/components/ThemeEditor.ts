import { store } from '../stores/appStore';
import { ThemeColors } from '../types';
import { createModal, createToast } from './TerminalUI';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const n = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a); const B = hexToRgb(b);
  const r = Math.round(A.r + (B.r - A.r) * t);
  const g = Math.round(A.g + (B.g - A.g) * t);
  const blue = Math.round(A.b + (B.b - A.b) * t);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + blue).toString(16).slice(1);
}

const FIELDS: Array<{ key: keyof Omit<ThemeColors, 'heatmap'>; label: string }> = [
  { key: 'bg', label: 'Background' },
  { key: 'bgSecondary', label: 'Surface' },
  { key: 'fg', label: 'Text' },
  { key: 'fgMuted', label: 'Muted text' },
  { key: 'accent', label: 'Accent' },
  { key: 'accentMuted', label: 'Accent muted' },
  { key: 'border', label: 'Border' },
  { key: 'success', label: 'Success' },
  { key: 'warning', label: 'Warning' },
  { key: 'error', label: 'Error' },
];

export function openThemeEditor(): void {
  const base = store.getState().theme.colors;

  const content = document.createElement('div');
  content.className = 'theme-editor';
  content.innerHTML = `
    <div class="form-group"><label>Theme name</label><input type="text" id="te-name" placeholder="My theme" value="Custom Theme"></div>
    <div class="theme-editor-body">
      <div class="theme-editor-fields">
        ${FIELDS.map(f => `<div class="te-field"><label>${f.label}</label><input type="color" id="te-${f.key}" value="${base[f.key]}"></div>`).join('')}
      </div>
      <div class="theme-editor-preview" id="te-preview">
        <div class="tep-top"><span class="tep-dot"></span><span class="tep-title">habit_ctl</span></div>
        <div class="tep-row"><span class="tep-box"></span><span class="tep-name">Morning run</span><span class="tep-streak">🔥 12</span></div>
        <div class="tep-row"><span class="tep-box tep-box-done"></span><span class="tep-name">Read 20 pages</span><span class="tep-streak">Lv 4</span></div>
        <div class="tep-heat">${[0, 1, 2, 3, 4].map(i => `<span class="tep-cell" data-l="${i}"></span>`).join('')}</div>
        <button class="tep-btn" type="button">+ Add habit</button>
      </div>
    </div>
    <div class="form-actions"><button class="btn btn-ghost" id="te-cancel">Cancel</button><button class="btn btn-primary" id="te-save">Save Theme</button></div>
  `;

  createModal('New Theme', content, () => {});

  const val = (key: string) => (content.querySelector(`#te-${key}`) as HTMLInputElement).value;

  function readColors(): ThemeColors {
    const bg = val('bg'); const bgSecondary = val('bgSecondary'); const accent = val('accent');
    return {
      bg,
      bgSecondary,
      fg: val('fg'),
      fgMuted: val('fgMuted'),
      accent,
      accentMuted: val('accentMuted'),
      border: val('border'),
      success: val('success'),
      warning: val('warning'),
      error: val('error'),
      heatmap: {
        level0: bgSecondary,
        level1: mix(bgSecondary, accent, 0.25),
        level2: mix(bgSecondary, accent, 0.5),
        level3: mix(bgSecondary, accent, 0.75),
        level4: accent,
      },
    };
  }

  function renderPreview(): void {
    const c = readColors();
    const pv = content.querySelector('#te-preview') as HTMLElement;
    pv.style.background = c.bg;
    pv.style.color = c.fg;
    pv.style.borderColor = c.border;
    (pv.querySelector('.tep-top') as HTMLElement).style.borderBottomColor = c.border;
    (pv.querySelector('.tep-dot') as HTMLElement).style.background = c.accent;
    (pv.querySelector('.tep-title') as HTMLElement).style.color = c.fgMuted;
    (pv.querySelector('.tep-btn') as HTMLElement).style.background = c.accent;
    (pv.querySelector('.tep-btn') as HTMLElement).style.color = c.bg;
    pv.querySelectorAll('.tep-box').forEach((b, i) => {
      (b as HTMLElement).style.borderColor = c.fgMuted;
      if (i === 1) (b as HTMLElement).style.background = c.success;
    });
    pv.querySelectorAll('.tep-cell').forEach(el => {
      const l = parseInt((el as HTMLElement).dataset.l || '0');
      (el as HTMLElement).style.background = (c.heatmap as any)[`level${l}`];
    });
  }

  content.querySelectorAll('.theme-editor-fields input').forEach(inp => inp.addEventListener('input', renderPreview));
  renderPreview();

  content.querySelector('#te-cancel')?.addEventListener('click', () => document.querySelector('.modal-overlay')?.remove());
  content.querySelector('#te-save')?.addEventListener('click', async () => {
    const name = (content.querySelector('#te-name') as HTMLInputElement).value.trim() || 'Custom Theme';
    const colors = readColors();
    const theme = await store.createCustomTheme({ name, colors, isCustom: true, isPro: false });
    store.setTheme(theme.id);
    createToast(`Theme "${name}" created`, 'success');
    document.querySelector('.modal-overlay')?.remove();
  });
}
