export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const r = Math.round(A.r + (B.r - A.r) * t);
  const g = Math.round(A.g + (B.g - A.g) * t);
  const blue = Math.round(A.b + (B.b - A.b) * t);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + blue).toString(16).slice(1);
}

/** Five-step heatmap ramp derived from the theme's own accent, blended over its surface.
 *  Keeps every theme's heatmap in that theme's colour and guarantees the lowest step
 *  stays visibly distinct from the card background. */
export function heatRamp(surface: string, accent: string): [string, string, string, string, string] {
  return [
    mix(surface, accent, 0.18),
    mix(surface, accent, 0.38),
    mix(surface, accent, 0.6),
    mix(surface, accent, 0.8),
    accent,
  ];
}
