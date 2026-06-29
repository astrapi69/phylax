#!/usr/bin/env node

/**
 * Generate the Open Graph / Twitter social-preview cards (1200x630) used by
 * the SEO metadata in index.html (D-04).
 *
 * Uses @resvg/resvg-js (same WASM rasterizer as generate-icons.mjs) to render
 * an inline dark-theme brand card. Two locale variants differ only in the
 * tagline and the feature labels:
 *   public/og-image.png     - German (primary, og:locale de_DE)
 *   public/og-image-en.png  - English (og:locale:alternate en_US)
 *
 * Dignified register: brand wordmark, tagline, four feature glyphs. No
 * marketing voice, no medical-emergency framing. Colours follow the manifest
 * theme (#111827 background, #1f2937 panel, white text, muted emerald accent).
 *
 * Run via: make og-images
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const WIDTH = 1200;
const HEIGHT = 630;

const BG = '#111827';
const PANEL = '#1f2937';
const WHITE = '#ffffff';
const MUTED = '#9ca3af';
const ACCENT = '#34d399';

// Feature glyphs drawn in a local 56x56 box, stroked in the accent colour.
// lock = encryption, document = PDF export, group = multi-profile,
// cloud-off = no cloud.
const GLYPHS = {
  lock: `
    <rect x="12" y="26" width="32" height="24" rx="4" fill="none" stroke="${ACCENT}" stroke-width="3.5"/>
    <path d="M18 26 V18 a10 10 0 0 1 20 0 V26" fill="none" stroke="${ACCENT}" stroke-width="3.5"/>
    <circle cx="28" cy="36" r="3.5" fill="${ACCENT}"/>
    <path d="M28 39 V44" stroke="${ACCENT}" stroke-width="3.5" stroke-linecap="round"/>`,
  document: `
    <path d="M14 6 h22 l8 8 v36 a0 0 0 0 1 0 0 h-30 a0 0 0 0 1 0 0 Z" fill="none" stroke="${ACCENT}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M36 6 v8 h8" fill="none" stroke="${ACCENT}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M20 26 h16 M20 34 h16 M20 42 h10" stroke="${ACCENT}" stroke-width="3.5" stroke-linecap="round"/>`,
  group: `
    <circle cx="21" cy="20" r="8" fill="none" stroke="${ACCENT}" stroke-width="3.5"/>
    <path d="M9 46 a12 12 0 0 1 24 0" fill="none" stroke="${ACCENT}" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="38" cy="24" r="7" fill="none" stroke="${ACCENT}" stroke-width="3.5"/>
    <path d="M34 38 a11 11 0 0 1 14 8" fill="none" stroke="${ACCENT}" stroke-width="3.5" stroke-linecap="round"/>`,
  cloudOff: `
    <path d="M18 42 a10 10 0 0 1 1 -20 a13 13 0 0 1 24 4 a9 9 0 0 1 1 16 Z" fill="none" stroke="${ACCENT}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M10 10 L46 48" stroke="${ACCENT}" stroke-width="3.5" stroke-linecap="round"/>`,
};

const VARIANTS = [
  {
    out: 'public/og-image.png',
    lang: 'de',
    tagline: 'Lebende Gesundheit - Verlauf, Kontext, Datenhoheit',
    features: ['Verschlüsselt', 'PDF-Export', 'Mehrprofil', 'Keine Cloud'],
  },
  {
    out: 'public/og-image-en.png',
    lang: 'en',
    tagline: 'Living Health - Trajectory, Context, Data Sovereignty',
    features: ['Encrypted', 'PDF export', 'Multi-profile', 'No cloud'],
  },
];

function featureColumn(glyphKey, label, centerX) {
  const top = 430;
  return `
    <g transform="translate(${centerX - 28}, ${top})">${GLYPHS[glyphKey]}</g>
    <text x="${centerX}" y="${top + 86}" text-anchor="middle"
      font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="26" fill="${MUTED}">${label}</text>`;
}

function buildSvg(variant) {
  const glyphKeys = ['lock', 'document', 'group', 'cloudOff'];
  const centers = [240, 480, 720, 960];
  const columns = glyphKeys
    .map((key, i) => featureColumn(key, variant.features[i], centers[i]))
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>
    <rect x="40" y="40" width="${WIDTH - 80}" height="${HEIGHT - 80}" rx="28" fill="${PANEL}"/>

    <!-- Wordmark: Phi mark + Phylax -->
    <text x="104" y="210" font-family="DejaVu Serif, serif" font-size="140" font-weight="bold" fill="${WHITE}">&#934;</text>
    <text x="280" y="210" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="116" font-weight="bold" fill="${WHITE}">Phylax</text>

    <!-- Tagline -->
    <text x="104" y="320" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="40" fill="${MUTED}">${variant.tagline}</text>

    <!-- Feature glyphs -->
    ${columns}
  </svg>`;
}

for (const variant of VARIANTS) {
  const svg = buildSvg(variant);
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } });
  const png = resvg.render().asPng();
  const outPath = resolve(root, variant.out);
  writeFileSync(outPath, png);
  // eslint-disable-next-line no-console -- build script, not production code
  console.log(`Generated: ${variant.out} (${WIDTH}x${HEIGHT}, ${variant.lang})`);
}

// eslint-disable-next-line no-console -- build script
console.log('Done. OG images generated.');
