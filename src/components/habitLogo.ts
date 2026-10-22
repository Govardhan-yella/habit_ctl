import { Habit, HabitMode } from '../types';
import { iconByName } from '../data/tablerIcons';

/** Mode glyphs used as a fallback when a habit has no logo of its own. */
export const MODE_ICONS: Record<HabitMode, string> = {
  checkbox: '☐', counter: '⊞', number: '⌗', timer: '⏱', health: '♥',
};

/**
 * Habit logos are stored in `Habit.icon` as a tagged string so a single field
 * can hold every kind of logo:
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
 * Plain-text logo label for contexts that cannot render SVG (e.g. <option>).
 * Returns an emoji/text for legacy logos, or a short glyph for icon logos.
 */
export function habitLogoText(habit: Pick<Habit, 'icon' | 'mode'>): string {
  const ic = habit.icon;
  if (!ic) return MODE_ICONS[habit.mode];
  switch (logoKind(ic)) {
    case 'nerd':
      return nerdChar(ic);
    case 'tabler': {
      const name = tablerName(ic);
      const ic2 = iconByName(name);
      return ic2 ? `◈ ${ic2.name}` : MODE_ICONS[habit.mode];
    }
    case 'image':
      return '◈';
    default:
      return ic;
  }
}

/**
 * Inline style for a habit's text colour override. Empty when the habit
 * inherits the theme's text colour.
 */
export function habitTextStyle(habit: Pick<Habit, 'textColor'>): string {
  return habit.textColor ? ` style="color:${habit.textColor}"` : '';
}

/**
 * Render a habit logo to HTML. Falls back to the mode glyph when the stored
 * logo is missing or unrecognised.
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
