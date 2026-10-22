import { describe, it, expect } from 'vitest';
import {
  logoKind, tablerName, nerdChar, tablerSvg, habitLogoText,
  renderHabitLogo, renderRoutineLogo, habitTextStyle,
  resolveTextColor, textColorMode, MODE_ICONS,
} from './appearance';

describe('logoKind', () => {
  it('detects each logo type from its tag', () => {
    expect(logoKind('tabler:run')).toBe('tabler');
    expect(logoKind('nerd:\ue796')).toBe('nerd');
    expect(logoKind('data:image/png;base64,AAA')).toBe('image');
    expect(logoKind('🏃')).toBe('text');
    expect(logoKind('')).toBe('text');
    expect(logoKind(undefined)).toBe('text');
  });
});

describe('tablerName / nerdChar', () => {
  it('strips the tag prefix', () => {
    expect(tablerName('tabler:book')).toBe('book');
    expect(tablerName('book')).toBe('');
    expect(nerdChar('nerd:\uf013')).toBe('\uf013');
    expect(nerdChar('x')).toBe('');
  });
});

describe('tablerSvg', () => {
  it('renders a known icon with the requested size', () => {
    const svg = tablerSvg('run', 18);
    expect(svg).toContain('<svg');
    expect(svg).toContain('width="18"');
    expect(svg).toContain('height="18"');
    expect(svg).toContain('currentColor');
  });

  it('returns an empty string for an unknown icon', () => {
    expect(tablerSvg('definitely-not-an-icon')).toBe('');
  });
});

describe('textColorMode', () => {
  it('defaults to default when nothing is set', () => {
    expect(textColorMode({})).toBe('default');
    expect(textColorMode({ textColor: '' })).toBe('default');
  });

  it('treats a legacy textColor alone as custom', () => {
    expect(textColorMode({ textColor: '#ff0000' })).toBe('custom');
  });

  it('honours an explicit mode', () => {
    expect(textColorMode({ textColorMode: 'auto' })).toBe('auto');
    expect(textColorMode({ textColorMode: 'default', textColor: '#ff0000' })).toBe('default');
    expect(textColorMode({ textColorMode: 'custom' })).toBe('custom');
  });
});

describe('resolveTextColor', () => {
  it('returns undefined in default mode so the theme colour wins', () => {
    expect(resolveTextColor({ color: '#7aa2f7' })).toBeUndefined();
    expect(resolveTextColor({ color: '#7aa2f7', textColorMode: 'default' })).toBeUndefined();
  });

  it('derives the colour from the accent in auto mode', () => {
    expect(resolveTextColor({ color: '#f7768e', textColorMode: 'auto' })).toBe('#f7768e');
  });

  it('uses the explicit colour in custom mode', () => {
    expect(resolveTextColor({ color: '#f7768e', textColor: '#00ff00', textColorMode: 'custom' })).toBe('#00ff00');
  });

  it('falls back to undefined when custom mode has no colour', () => {
    expect(resolveTextColor({ color: '#f7768e', textColorMode: 'custom' })).toBeUndefined();
  });
});

describe('habitTextStyle', () => {
  it('returns an empty string when there is no override', () => {
    expect(habitTextStyle({ color: '#7aa2f7', textColor: undefined })).toBe('');
    expect(habitTextStyle({ color: '#7aa2f7', textColor: '' })).toBe('');
    expect(habitTextStyle({ color: '#7aa2f7', textColorMode: 'default' })).toBe('');
  });

  it('returns an inline colour style when overridden', () => {
    expect(habitTextStyle({ color: '#7aa2f7', textColor: '#f7768e' })).toBe(' style="color:#f7768e"');
  });

  it('returns the accent colour in auto mode', () => {
    expect(habitTextStyle({ color: '#f7768e', textColorMode: 'auto' })).toBe(' style="color:#f7768e"');
  });
});

describe('renderHabitLogo', () => {
  const base = { mode: 'checkbox' as const, color: '#7aa2f7' };

  it('falls back to the mode glyph when there is no logo', () => {
    expect(renderHabitLogo({ ...base, icon: '' })).toBe(MODE_ICONS.checkbox);
  });

  it('renders a tabler icon as inline svg', () => {
    const html = renderHabitLogo({ ...base, icon: 'tabler:run' });
    expect(html).toContain('<svg');
    expect(html).not.toContain('tabler:run');
  });

  it('falls back to the mode glyph for an unknown tabler name', () => {
    expect(renderHabitLogo({ ...base, icon: 'tabler:nope' })).toBe(MODE_ICONS.checkbox);
  });

  it('renders an uploaded image as an img tag', () => {
    const html = renderHabitLogo({ ...base, icon: 'data:image/png;base64,AAA' });
    expect(html).toContain('<img');
    expect(html).toContain('habit-logo-img');
  });

  it('renders a nerd glyph in a nerd-font span', () => {
    const html = renderHabitLogo({ ...base, icon: 'nerd:\uf013' });
    expect(html).toContain('habit-logo-nerd');
  });

  it('renders legacy emoji as-is', () => {
    expect(renderHabitLogo({ ...base, icon: '🏃' })).toBe('🏃');
  });
});

describe('renderRoutineLogo', () => {
  it('falls back to a neutral bullet when there is no logo', () => {
    expect(renderRoutineLogo({})).toBe('◈');
    expect(renderRoutineLogo({ icon: '' })).toBe('◈');
  });

  it('renders a tabler icon as inline svg', () => {
    const html = renderRoutineLogo({ icon: 'tabler:target' });
    expect(html).toContain('<svg');
    expect(html).not.toContain('tabler:target');
  });

  it('falls back to the bullet for an unknown tabler name', () => {
    expect(renderRoutineLogo({ icon: 'tabler:nope' })).toBe('◈');
  });

  it('renders an uploaded image as an img tag', () => {
    expect(renderRoutineLogo({ icon: 'data:image/png;base64,AAA' })).toContain('habit-logo-img');
  });

  it('renders legacy emoji as-is', () => {
    expect(renderRoutineLogo({ icon: '☀' })).toBe('☀');
  });
});

describe('habitLogoText', () => {
  const base = { mode: 'counter' as const };

  it('returns the mode glyph when there is no logo', () => {
    expect(habitLogoText({ ...base, icon: '' })).toBe(MODE_ICONS.counter);
  });

  it('never leaks the raw tag prefix', () => {
    expect(habitLogoText({ ...base, icon: 'tabler:run' })).not.toContain('tabler:');
    expect(habitLogoText({ ...base, icon: 'nerd:\uf013' })).not.toContain('nerd:');
    expect(habitLogoText({ ...base, icon: 'data:image/png;base64,AAA' })).not.toContain('data:');
  });

  it('keeps emoji logos intact', () => {
    expect(habitLogoText({ ...base, icon: '💧' })).toBe('💧');
  });
});
