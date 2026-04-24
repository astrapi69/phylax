/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };

// Base path differs by mode:
// - production: served from GitHub Pages at astrapi69.github.io/phylax/ (D-01)
// - development: served from localhost at the root for dev ergonomics
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const base = isProduction ? '/phylax/' : '/';

  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Phylax',
          short_name: 'Phylax',
          description: 'Dein lokales, verschluesseltes Gesundheitsprofil.',
          lang: 'de',
          dir: 'ltr',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait-primary',
          background_color: '#ffffff',
          theme_color: '#1f2937',
          categories: ['health', 'productivity'],
          icons: [
            { src: 'icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
            { src: 'icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
            { src: 'icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
            { src: 'icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
            { src: 'icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
            { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
            { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icons/icon-maskable-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: 'icons/icon-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: `${base}index.html`,
          // No runtime caching: Phylax has no external resources.
          // All assets are bundled and cached via precaching.
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    server: {
      port: 6173,
      strictPort: true,
      open: true,
    },
    preview: {
      port: 6174,
      strictPort: true,
      open: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      globals: false,
      environment: 'jsdom',
      setupFiles: [
        './src/test/pin-language.ts',
        './src/crypto/test-setup.ts',
        './src/test/setup.ts',
      ],
      include: ['src/**/*.test.{ts,tsx}'],
      // Vitest 4 expanded the default `toFake` list to include
      // `queueMicrotask`, `requestAnimationFrame`, and friends. React 18's
      // scheduler relies on `queueMicrotask` to flush effects after
      // `renderHook`; if the microtask queue is mocked, effects never run
      // and tests hang under fake timers. Restrict `toFake` to the
      // Vitest-3 default set of timer primitives to keep existing
      // `vi.useFakeTimers()` callsites working without per-test overrides.
      fakeTimers: {
        toFake: [
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
          'setImmediate',
          'clearImmediate',
          'Date',
        ],
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'text-summary', 'lcov'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/test/**',
          'src/crypto/test-setup.ts',
          'src/**/*.test.{ts,tsx}',
          // Test-only mock factories live under testHelpers/ next to
          // the module they shadow. Exercised by vi.mock in other
          // test files, not by direct unit tests.
          'src/**/testHelpers/**',
          'src/vite-env.d.ts',
          'src/main.tsx',
          'src/pwa/**',
          // Route definitions are declarative config, verified by E2E tests
          'src/router/routes.tsx',
          // Exclude empty placeholder index files from F-02 scaffold.
          // Remove entries from this list as modules gain real code.
          'src/**/index.ts',
          'src/App.tsx',
        ],
        thresholds: {
          // Project-wide thresholds recalibrated for Vitest 4's V8
          // AST-aware provider (ADR-0016). Values sit at measured - 1
          // as a drift buffer; previous uniform 85% was set against
          // inflated Vitest-3 numbers.
          lines: 92,
          branches: 80,
          functions: 92,
          statements: 90,
          // Per-module thresholds [F-05b]
          // 100% for security-critical modules
          'src/crypto/**': {
            lines: 100,
            branches: 100,
            functions: 100,
            statements: 100,
          },
          'src/db/repositories/**': {
            lines: 100,
            branches: 100,
            functions: 100,
            statements: 100,
          },
          // 95% for data/state/auth modules
          'src/db/**': {
            lines: 95,
            branches: 90,
            functions: 95,
            statements: 95,
          },
          'src/features/onboarding/**': {
            lines: 95,
            branches: 90,
            functions: 100,
            statements: 95,
          },
          'src/features/auto-lock/**': {
            lines: 95,
            // Branches recalibrated 95 -> 89 for Vitest 4's V8 provider
            // (ADR-0016); measured 90.00% under new AST remapping.
            branches: 89,
            functions: 100,
            statements: 95,
          },
          'src/features/pwa-update/**': {
            lines: 95,
            branches: 95,
            functions: 100,
            statements: 95,
          },
          'src/router/**': {
            lines: 95,
            branches: 90,
            functions: 95,
            statements: 95,
          },
          // Unlock thresholds recalibrated for Vitest 4 V8 provider
          // (ADR-0016). 100% functions target was aspirational under
          // Vitest 3's inflated numbers; dropped to honest 95 rather
          // than carrying a permanent-waiver. Real 100% would need
          // new tests, tracked separately.
          'src/features/unlock/**': {
            lines: 90,
            branches: 83,
            functions: 95,
            statements: 88,
          },
          // 85% for UI shell (render-heavy, fewer logic branches)
          'src/features/app-shell/**': {
            lines: 85,
            branches: 85,
            functions: 100,
            statements: 85,
          },
        },
      },
    },
  };
});
