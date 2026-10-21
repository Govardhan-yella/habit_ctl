import { describe, it, expect } from 'vitest';
import { hexToRgb, mix, rgba, luminance, isDark, desaturate, matte } from './color';

describe('hexToRgb', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });
  it('expands 3-digit hex', () => {
    expect(hexToRgb('#0f0')).toEqual({ r: 0, g: 255, b: 0 });
  });
  it('falls back to black on garbage', () => {
    expect(hexToRgb('nonsense')).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('mix', () => {
  it('returns the start colour at t=0 and end at t=1', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
  });
  it('blends midway', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('rgba', () => {
  it('builds an rgba string', () => {
    expect(rgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });
});

describe('luminance / isDark', () => {
  it('treats black as dark and white as light', () => {
    expect(isDark('#000000')).toBe(true);
    expect(isDark('#ffffff')).toBe(false);
  });
  it('orders luminance correctly', () => {
    expect(luminance('#ffffff')).toBeGreaterThan(luminance('#888888'));
    expect(luminance('#888888')).toBeGreaterThan(luminance('#000000'));
  });
});

describe('desaturate', () => {
  it('leaves the colour untouched at amount 0', () => {
    expect(desaturate('#7aa2f7', 0)).toBe('#7aa2f7');
  });
  it('produces a greyscale at amount 1 (r === g === b)', () => {
    const { r, g, b } = hexToRgb(desaturate('#7aa2f7', 1));
    expect(r).toBe(g);
    expect(g).toBe(b);
  });
  it('reduces chroma as amount grows', () => {
    const spread = (hex: string) => {
      const { r, g, b } = hexToRgb(hex);
      return Math.max(r, g, b) - Math.min(r, g, b);
    };
    expect(spread(desaturate('#7aa2f7', 0.55))).toBeLessThan(spread('#7aa2f7'));
  });
});

describe('matte', () => {
  it('keeps a valid hex output', () => {
    expect(matte('#4ade80', 0.55)).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('lowers chroma compared to the source', () => {
    const spread = (hex: string) => {
      const { r, g, b } = hexToRgb(hex);
      return Math.max(r, g, b) - Math.min(r, g, b);
    };
    expect(spread(matte('#f87171', 0.55))).toBeLessThan(spread('#f87171'));
  });
});
