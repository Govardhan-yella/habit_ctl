import { Habit, HabitMode, TextColorMode } from '../types';
import { iconByName } from '../data/tablerIcons';

/** Mode glyphs used as a fallback when a habit/routine has no logo of its own. */
export const MODE_ICONS: Record<HabitMode, string> = {
  checkbox: '☐', counter: '⊞', number: '⌗', timer: '⏱', health: '♥',
};

/** Preset accent colours offered next to the native colour picker. */
export const COLOR_SWATCHES = [
  '#7aa2f7', '#bb9af7', '#f7768e', '#ff9e64', '#e0af68', '#9ece6a',
  '#73daca', '#7dcfff', '#b4f9f8', '#ff7edb', '#c0caf5', '#a9b1d6',
  '#4ade80', '#fbbf24', '#f87171', '#38bdf8', '#a78bfa', '#fb7185',
];

/** Legacy emoji set, kept for backward compatibility. */
export const EMOJI_GROUPS: { label: string; icons: string[] }[] = [
  { label: 'Fitness', icons: ['🏃', '💪', '🚴', '🏊', '🧘', '🤸', '🥊', '⚽', '🏋️', '🚶'] },
  { label: 'Mind & Learn', icons: ['📚', '🧠', '✍️', '📝', '🎓', '💡', '🗣️', '🌍'] },
  { label: 'Health', icons: ['💧', '🥗', '😴', '🍎', '❤️', '🦷', '🧴', '💊', '🚭'] },
  { label: 'Work & Money', icons: ['💻', '💰', '📈', '🗂️', '✉️', '📅', '⚙️', '🎯'] },
  { label: 'Creative', icons: ['🎸', '🎨', '🎵', '📷', '🎬', '✏️', '🧶', '🎹'] },
  { label: 'Life', icons: ['🌱', '☀️', '🌙', '⏰', '🔥', '✅', '🧹', '🐶', '🙏', '🎁'] },
];

/** Nerd Font PUA glyphs — only shown when a Nerd Font is detected on the device. */
export const NERD_GLYPHS: { label: string; glyphs: { ch: string; name: string }[] }[] = [
  { label: 'Dev', glyphs: [
    { ch: '\ue796', name: 'code' }, { ch: '\ue702', name: 'git' }, { ch: '\ue725', name: 'branch' },
    { ch: '\uf120', name: 'terminal' }, { ch: '\uf308', name: 'docker' }, { ch: '\ue73c', name: 'python' },
    { ch: '\ue718', name: 'node' }, { ch: '\ue781', name: 'js' }, { ch: '\ue7ba', name: 'react' },
    { ch: '\uf1c0', name: 'database' }, { ch: '\uf0c2', name: 'cloud' }, { ch: '\uf013', name: 'gear' },
    { ch: '\uf00c', name: 'check' }, { ch: '\uf06d', name: 'flame' }, { ch: '\uf02d', name: 'book' }, { ch: '\uf004', name: 'heart' },
  ]},
];

/**
 * Logos are stored in a single field as a tagged string so one column can
 * hold every kind of logo:
 *   'tabler:<name>'  — inline SVG from the curated Tabler set
 *   'nerd:<char>'    — Nerd Font PUA glyph
 *   'data:<base64>'  — uploaded image (downscaled on upload)
 *   '<emoji|text>'   — legacy emoji / short text (still supported)
 */
export type LogoKind = 'tabler' | 'nerd' | 'image' | 'text';

export function logoKind(value: string | undefined): LogoKind {
  const v = value ?? '';
  if (v.startsWith('tabler:')) return 'tabler';
  if (v.startsWith('nerd:')) return 'nerd';
  if (v.startsWith('data:')) return 'image';
  return 'text';
}

export function tablerName(value: string): string {
  return value.startsWith('tabler:') ? value.slice('tabler:'.length) : '';
}

export function nerdChar(value: string): string {
  return value.startsWith('nerd:') ? value.slice('nerd:'.length) : '';
}

/** Inline SVG markup for a Tabler icon, sized for inline use. */
export function tablerSvg(name: string, size = 18, strokeWidth = 1.9): string {
  const ic = iconByName(name);
  if (!ic) return '';
  return ic.svg
    .replace(/width="24" height="24"/, `width="${size}" height="${size}"`)
    .replace('stroke-width="2"', `stroke-width="${strokeWidth}"`);
}

/**
 * Render a logo to HTML. Falls back to the mode glyph when the stored logo
 * is missing or unrecognised.
 */
export function renderHabitLogo(habit: Pick<Habit, 'icon' | 'mode' | 'color'>, size = 18): string {
  const ic = habit.icon;
  if (!ic) return MODE_ICONS[habit.mode];
  switch (logoKind(ic)) {
    case 'image':
      return `<img class="habit-logo-img" src="${ic}" alt="">`;
    case 'tabler': {
      const svg = tablerSvg(tablerName(ic), size);
      return svg || MODE_ICONS[habit.mode];
    }
    case 'nerd':
      return `<span class="habit-logo-nerd">${nerdChar(ic)}</span>`;
    default:
      return ic;
  }
}

/**
 * Render a routine logo to HTML. Routines have no mode glyph, so an unknown
 * logo falls back to a neutral bullet.
 */
export function renderRoutineLogo(routine: { icon?: string; color?: string }, size = 18): string {
  const ic = routine.icon;
  if (!ic) return '◈';
  switch (logoKind(ic)) {
    case 'image':
      return `<img class="habit-logo-img" src="${ic}" alt="">`;
    case 'tabler': {
      const svg = tablerSvg(tablerName(ic), size);
      return svg || '◈';
    }
    case 'nerd':
      return `<span class="habit-logo-nerd">${nerdChar(ic)}</span>`;
    default:
      return ic;
  }
}

/**
 * Plain-text logo label for contexts that cannot render SVG (e.g. <option>).
 */
export function habitLogoText(habit: Pick<Habit, 'icon' | 'mode'>): string {
  const ic = habit.icon;
  if (!ic) return MODE_ICONS[habit.mode];
  switch (logoKind(ic)) {
    case 'nerd':
      return nerdChar(ic);
    case 'tabler': {
      const name = tablerName(ic);
      const found = iconByName(name);
      return found ? `◈ ${found.name}` : MODE_ICONS[habit.mode];
    }
    case 'image':
      return '◈';
    default:
      return ic;
  }
}

/* ------------------------------------------------------------------ *
 * Text colour
 * ------------------------------------------------------------------ */

/** Resolve the effective text colour mode (legacy `textColor` alone = custom). */
export function textColorMode(item: { textColor?: string; textColorMode?: TextColorMode }): TextColorMode {
  if (item.textColorMode) return item.textColorMode;
  return item.textColor ? 'custom' : 'default';
}

/**
 * Resolve the actual colour to use for a name.
 * Returns undefined when the theme's text colour should be used.
 * 'auto' derives the colour from the item's accent colour.
 */
export function resolveTextColor(item: { color: string; textColor?: string; textColorMode?: TextColorMode }): string | undefined {
  const mode = textColorMode(item);
  if (mode === 'custom') return item.textColor || undefined;
  if (mode === 'auto') return item.color || undefined;
  return undefined;
}

/** Inline style for a name's text colour override. Empty when inheriting. */
export function habitTextStyle(item: { color: string; textColor?: string; textColorMode?: TextColorMode }): string {
  const c = resolveTextColor(item);
  return c ? ` style="color:${c}"` : '';
}
