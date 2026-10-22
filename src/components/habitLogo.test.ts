import { describe, it, expect } from 'vitest';
import { logoKind, tablerName, nerdChar, tablerSvg, habitLogoText, renderHabitLogo, habitTextStyle, MODE_ICONS } from '../components/habitLogo';

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

describe('habitTextStyle', () => {
  it('returns an empty string when there is no override', () => {
    expect(habitTextStyle({ textColor: undefined })).toBe('');
    expect(habitTextStyle({ textColor: '' })).toBe('');
  });

  it('returns an inline colour style when overridden', () => {
    expect(habitTextStyle({ textColor: '#f7768e' })).toBe(' style="color:#f7768e"');
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
