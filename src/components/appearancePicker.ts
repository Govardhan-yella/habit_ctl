import { createToast } from './TerminalUI';
import { TextColorMode } from '../types';
import {
  COLOR_SWATCHES, EMOJI_GROUPS, NERD_GLYPHS,
  logoKind, tablerName, nerdChar, tablerSvg,
} from './appearance';
import { ICON_GROUPS as TABLER_GROUPS } from '../data/tablerIcons';

export interface AppearanceValue {
  icon: string;
  color: string;
  textColor?: string;
  textColorMode?: TextColorMode;
}

export interface AppearancePickerOptions {
  /** Show the text colour row (habits + routines both do). */
  textColor?: boolean;
  /** Label for the accent colour row. */
  colorLabel?: string;
  /** Fallback accent colour for new items. */
  defaultColor?: string;
  /** Fallback logo for new items. */
  defaultIcon?: string;
  /** Label for the text colour hint. */
  textHint?: string;
}

let uid = 0;

/** Detect a Nerd Font on the device — its glyphs are PUA code points, so without a patched font they render as tofu. */
export function isNerdFontAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.font = '16px monospace';
    const monoW = ctx.measureText('\ue796').width;
    ctx.font = '16px "Symbols Nerd Font", "JetBrainsMono Nerd Font", "Hack Nerd Font", "FiraCode Nerd Font", monospace';
    return ctx.measureText('\ue796').width !== monoW;
  } catch { return false; }
}

/** Downscale a File to a JPEG data URL capped at maxPx (keeps stored icons small). */
export async function downscaleImage(file: File, maxPx = 128, quality = 0.85): Promise<string> {
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

/**
 * A reusable appearance picker: logo (Tabler / emoji / Nerd / upload), accent
 * colour and optional text colour strategy. Used by both the habit form and
 * the routine form so the two stay in sync.
 */
export function createAppearancePicker(initial: AppearanceValue, opts: AppearancePickerOptions = {}): {
  el: HTMLElement;
  getValue: () => AppearanceValue;
} {
  const id = `ap${++uid}`;
  const defaultColor = opts.defaultColor ?? '#7aa2f7';
  const defaultIcon = opts.defaultIcon ?? 'tabler:run';
  const nerdAvailable = isNerdFontAvailable();

  let icon = initial.icon || defaultIcon;
  const color = initial.color || defaultColor;
  let textColorMode: TextColorMode = initial.textColorMode ?? (initial.textColor ? 'custom' : 'default');
  const textColor = initial.textColor ?? '#e6e6e6';

  const kind = logoKind(icon);
  let activeTab: 'icons' | 'emoji' | 'dev' | 'upload' =
    kind === 'tabler' ? 'icons' : kind === 'nerd' ? 'dev' : kind === 'image' ? 'upload' : 'emoji';

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

  const el = document.createElement('div');
  el.className = 'appearance-picker';
  el.innerHTML = `
    <div class="form-group">
      <label>Logo</label>
      <div class="logo-row">
        <div class="logo-preview" id="${id}-preview"></div>
        <input type="text" id="${id}-icon" maxlength="4" placeholder="Custom emoji or text">
        <label class="logo-upload" title="Upload a custom image (auto-downscaled)">
          <input type="file" id="${id}-file" accept="image/*" hidden>⬆ Upload
        </label>
      </div>
      <div class="logo-tabs">
        <button type="button" class="logo-tab" data-tab="icons">Icons</button>
        <button type="button" class="logo-tab" data-tab="emoji">Emoji</button>
        <button type="button" class="logo-tab" data-tab="dev">Dev</button>
        <button type="button" class="logo-tab" data-tab="upload">Upload</button>
      </div>
      <div class="icon-groups" data-panel="icons">${tablerHtml}</div>
      <div class="icon-groups" data-panel="emoji">${emojiHtml}</div>
      <div class="icon-groups" data-panel="dev">${devHtml}</div>
      <div class="logo-upload-panel" data-panel="upload">
        <span class="rem-empty">Upload any image — it will be downscaled to ~128px on-device.</span>
      </div>
    </div>
    <div class="form-group">
      <label>${opts.colorLabel ?? 'Colour'}</label>
      <div class="color-row">
        <input type="color" id="${id}-color" value="${color}">
        <div class="color-swatches" data-sw="accent">${COLOR_SWATCHES.map(c => `<button type="button" class="color-swatch" data-color="${c}" style="background:${c}"></button>`).join('')}</div>
      </div>
    </div>
    ${opts.textColor === false ? '' : `
    <div class="form-group">
      <label>Text colour</label>
      <div class="seg-control" role="group" aria-label="Text colour mode">
        <button type="button" class="seg-btn" data-mode="default">Default</button>
        <button type="button" class="seg-btn" data-mode="auto">Auto</button>
        <button type="button" class="seg-btn" data-mode="custom">Custom</button>
      </div>
      <div class="color-row" data-text-custom style="display:none">
        <input type="color" id="${id}-textcolor" value="${textColor}">
        <div class="color-swatches" data-sw="text">${COLOR_SWATCHES.map(c => `<button type="button" class="color-swatch" data-textcolor="${c}" style="background:${c}"></button>`).join('')}</div>
      </div>
      <span class="setting-hint" data-text-hint></span>
    </div>`}
  `;

  const preview = el.querySelector(`#${id}-preview`) as HTMLElement;
  const iconInput = el.querySelector(`#${id}-icon`) as HTMLInputElement;
  const colorInput = el.querySelector(`#${id}-color`) as HTMLInputElement;
  const textColorInput = el.querySelector(`#${id}-textcolor`) as HTMLInputElement;
  const textHint = el.querySelector('[data-text-hint]') as HTMLElement | null;
  const textCustomRow = el.querySelector('[data-text-custom]') as HTMLElement | null;

  function applyLogoColor(): void {
    const c = colorInput.value || defaultColor;
    preview.querySelectorAll('svg').forEach(svg => {
      (svg as SVGElement).style.color = c;
    });
  }

  function setLogo(value: string): void {
    icon = value;
    iconInput.value = value.startsWith('data:') || value.startsWith('tabler:') || value.startsWith('nerd:') ? '' : value;
    if (value.startsWith('data:')) {
      preview.innerHTML = `<img src="${value}" alt="">`;
    } else if (value.startsWith('tabler:')) {
      preview.innerHTML = tablerSvg(tablerName(value), 26) || '✦';
    } else if (value.startsWith('nerd:')) {
      preview.innerHTML = `<span class="logo-nerd">${nerdChar(value)}</span>`;
    } else {
      preview.innerHTML = value || '✦';
    }
    applyLogoColor();
  }

  function showTab(tab: string): void {
    activeTab = tab as typeof activeTab;
    el.querySelectorAll('.logo-tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === tab));
    el.querySelectorAll('[data-panel]').forEach(p => {
      (p as HTMLElement).style.display = p.getAttribute('data-panel') === tab ? 'flex' : 'none';
    });
  }

  function clearActivePicks(): void {
    el.querySelectorAll('.icon-pick').forEach(b => b.classList.remove('active'));
  }

  function markPick(selector: string): void {
    const btn = el.querySelector(selector);
    if (btn) btn.classList.add('active');
  }

  // --- logo interactions ---
  el.querySelectorAll('.logo-tab').forEach(tab => tab.addEventListener('click', () => showTab(tab.getAttribute('data-tab')!)));

  el.querySelectorAll('.icon-pick-svg').forEach(btn => btn.addEventListener('click', () => {
    setLogo(`tabler:${btn.getAttribute('data-tabler')!}`);
    clearActivePicks();
    btn.classList.add('active');
    showTab('icons');
  }));

  el.querySelectorAll('.icon-pick[data-emoji]').forEach(btn => btn.addEventListener('click', () => {
    setLogo(btn.getAttribute('data-emoji')!);
    clearActivePicks();
    btn.classList.add('active');
    showTab('emoji');
  }));

  el.querySelectorAll('.icon-pick-nerd').forEach(btn => btn.addEventListener('click', () => {
    setLogo(`nerd:${btn.getAttribute('data-nerd')!}`);
    clearActivePicks();
    btn.classList.add('active');
    showTab('dev');
  }));

  iconInput.addEventListener('input', () => {
    if (!iconInput.value) return;
    clearActivePicks();
    setLogo(iconInput.value);
  });

  el.querySelector(`#${id}-file`)?.addEventListener('change', async e => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      setLogo(await downscaleImage(f, 128, 0.85));
      clearActivePicks();
      showTab('upload');
      createToast('Logo added (downscaled)', 'success');
    } catch {
      createToast('Failed to load image', 'error');
    }
    (e.target as HTMLInputElement).value = '';
  });

  // --- accent colour ---
  function syncAccentActive(): void {
    el.querySelectorAll('[data-sw="accent"] .color-swatch').forEach(s => {
      s.classList.toggle('active', s.getAttribute('data-color')?.toLowerCase() === colorInput.value.toLowerCase());
    });
  }
  el.querySelectorAll('[data-sw="accent"] .color-swatch').forEach(btn => btn.addEventListener('click', () => {
    colorInput.value = btn.getAttribute('data-color')!;
    syncAccentActive();
    applyLogoColor();
  }));
  colorInput.addEventListener('input', () => { syncAccentActive(); applyLogoColor(); });
  syncAccentActive();

  // --- text colour mode ---
  function syncTextMode(): void {
    el.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-mode') === textColorMode));
    if (textCustomRow) textCustomRow.style.display = textColorMode === 'custom' ? 'flex' : 'none';
    if (textHint) {
      textHint.textContent =
        textColorMode === 'auto'
          ? (opts.textHint ?? 'Follows the accent colour above.')
          : textColorMode === 'custom'
            ? 'Applies to the name only.'
            : 'Uses the theme text colour.';
    }
  }
  function syncTextActive(): void {
    el.querySelectorAll('[data-sw="text"] .color-swatch').forEach(s => {
      s.classList.toggle('active', s.getAttribute('data-textcolor')?.toLowerCase() === textColorInput.value.toLowerCase());
    });
  }
  el.querySelectorAll('.seg-btn').forEach(btn => btn.addEventListener('click', () => {
    textColorMode = btn.getAttribute('data-mode') as TextColorMode;
    syncTextMode();
  }));
  textColorInput.addEventListener('input', syncTextActive);
  el.querySelectorAll('[data-sw="text"] .color-swatch').forEach(btn => btn.addEventListener('click', () => {
    textColorInput.value = btn.getAttribute('data-textcolor')!;
    syncTextActive();
  }));

  // --- initial state ---
  setLogo(icon);
  if (kind === 'text' && icon) {
    markPick(`.icon-pick[data-emoji="${CSS.escape(icon)}"]`);
    if (icon.length > 4) iconInput.value = '';
  } else if (kind === 'tabler') {
    markPick(`.icon-pick-svg[data-tabler="${CSS.escape(tablerName(icon))}"]`);
  } else if (kind === 'nerd') {
    markPick(`.icon-pick-nerd[data-nerd="${CSS.escape(nerdChar(icon))}"]`);
  }
  showTab(activeTab);
  syncTextMode();
  syncTextActive();

  return {
    el,
    getValue: () => ({
      icon,
      color: colorInput.value || defaultColor,
      textColor: textColorMode === 'custom' ? (textColorInput.value || textColor) : undefined,
      textColorMode,
    }),
  };
}
