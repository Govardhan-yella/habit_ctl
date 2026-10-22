#!/usr/bin/env node
/**
 * Regenerates src/data/tablerIcons.ts from @tabler/icons.
 * Run after changing the curated set or bumping @tabler/icons:
 *   node scripts/gen-tabler-icons.mjs
 *
 * The curated set is intentionally small so the app ships only the icons it
 * uses (perfect tree-shaking) instead of the full 5,000+ icon library.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'node_modules/@tabler/icons/icons/outline/');

/** Group -> icon names (must exist under icons/outline/). */
const GROUPS = {
  Fitness: ['run','walk','barbell','yoga','bike','swimming','jump-rope','stretching','soccer-field','ball-basketball','ball-tennis','ski-jumping','dumbbell','heart-rate-monitor','shoe','mountain','trees','treadmill','kayak','medal'],
  'Mind & Learn': ['book','brain','pencil','school','language','bulb','notebook','vocabulary','microscope','math-function','certificate','world','presentation','chess','books','headphones','puzzle','abc','ruler-measure','flask'],
  Health: ['droplet','salad','moon-stars','apple','heart','dental','pill','smoking-no','stethoscope','scale','bottle','bed','first-aid-kit','walk','sun-high','soup','ice-cream-2','carrot','bandage','eye'],
  'Work & Money': ['code','terminal-2','coin','chart-line','target','briefcase','calendar','mail','settings','file-text','device-laptop','wallet','pig-money','clock','git-branch','brand-github','database','cloud','rocket','trophy'],
  Creative: ['guitar-pick','palette','music','camera','movie','brush','piano','microphone','color-swatch','photo','vinyl','wand','needle-thread','scissors','headphones','speakerphone'],
  Life: ['plant-2','sun','flame','check','home','dog','cat','cake','gift','shopping-cart','coffee','tools-kitchen-2','trash','sparkles','confetti','trophy','star','mood-smile','friends','heart-handshake','car','plane','leaf','moon'],
};

/** Normalise a Tabler SVG: drop the class attr, force 24x24 + currentColor stroke. */
function normalise(svg) {
  return svg
    .replace(/\s+class="[^"]*"/g, '')
    .replace(/<svg[^>]*>/, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">')
    .replace(/\s{2,}/g, ' ')
    .replace(/> </g, '><')
    .trim();
}

const have = new Set(fs.readdirSync(srcDir).filter(f => f.endsWith('.svg')).map(f => f.replace('.svg', '')));
const missing = [];
for (const [group, names] of Object.entries(GROUPS)) {
  for (const n of names) if (!have.has(n)) missing.push(`${group}: ${n}`);
}
if (missing.length) {
  console.error('Missing icons:\n  ' + missing.join('\n  '));
  process.exit(1);
}

const data = Object.entries(GROUPS).map(([label, names]) => ({
  label,
  icons: names.map(name => ({ name, svg: normalise(fs.readFileSync(path.join(srcDir, `${name}.svg`), 'utf8')) })),
}));

const total = data.reduce((a, g) => a + g.icons.length, 0);
const ts = `// Auto-generated from @tabler/icons (MIT). Curated habit icon set.
// Regenerate with: node scripts/gen-tabler-icons.mjs — do not edit by hand.

export interface TablerIcon { name: string; svg: string; }

export const ICON_GROUPS: { label: string; icons: TablerIcon[] }[] = ${JSON.stringify(data, null, 2)};

export const ALL_ICONS: TablerIcon[] = ICON_GROUPS.flatMap(g => g.icons);

export function iconByName(name: string): TablerIcon | undefined {
  return ALL_ICONS.find(i => i.name === name);
}
`;

fs.writeFileSync(path.join(root, 'src/data/tablerIcons.ts'), ts);
console.log(`Wrote src/data/tablerIcons.ts — ${total} icons (${(Buffer.byteLength(ts) / 1024).toFixed(1)} KB)`);
