#!/usr/bin/env node

/**
 * Generate PNG icons from SVG sources for the PWA manifest.
 *
 * Uses @resvg/resvg-js (pure WASM, no native deps) to rasterize SVGs.
 * Run via: make icons
 *
 * Outputs:
 *   public/icons/icon-192x192.png
 *   public/icons/icon-512x512.png
 *   public/icons/icon-maskable-512x512.png
 *   public/apple-touch-icon.png (180x180)
 *   public/favicon.ico (32x32, actually a PNG served as .ico)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function renderSvgToPng(svgPath, width, height) {
  const svg = readFileSync(svgPath, 'utf-8');
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
  });
  const rendered = resvg.render();
  return rendered.asPng();
}

const sourceSvg = resolve(root, 'public/icons/source.svg');
const maskableSvg = resolve(root, 'public/icons/source-maskable.svg');

const targets = [
  { src: sourceSvg, out: 'public/icons/icon-192x192.png', size: 192 },
  { src: sourceSvg, out: 'public/icons/icon-512x512.png', size: 512 },
  { src: maskableSvg, out: 'public/icons/icon-maskable-512x512.png', size: 512 },
  { src: sourceSvg, out: 'public/apple-touch-icon.png', size: 180 },
  { src: sourceSvg, out: 'public/favicon.ico', size: 32 },
];

for (const target of targets) {
  const png = renderSvgToPng(target.src, target.size, target.size);
  const outPath = resolve(root, target.out);
  writeFileSync(outPath, png);
  // eslint-disable-next-line no-console -- build script, not production code
  console.log(`Generated: ${target.out} (${target.size}x${target.size})`);
}

// Copy source SVG as favicon.svg
const svgContent = readFileSync(sourceSvg);
writeFileSync(resolve(root, 'public/favicon.svg'), svgContent);
// eslint-disable-next-line no-console -- build script
console.log('Copied: public/favicon.svg');

// eslint-disable-next-line no-console -- build script
console.log('Done. All icons generated.');
