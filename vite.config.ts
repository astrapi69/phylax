/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
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
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#ffffff',
        theme_color: '#1f2937',
        categories: ['health', 'productivity'],
        icons: [
          { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
          { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
          { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
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
    setupFiles: ['./src/crypto/test-setup.ts', './src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/crypto/test-setup.ts',
        'src/**/*.test.{ts,tsx}',
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
        // Project-wide floor per quality-checks.md
        lines: 85,
        branches: 85,
        functions: 85,
        statements: 85,
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
          branches: 95,
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
        // 90% for unlock (known untested error branch, audit debt #8)
        'src/features/unlock/**': {
          lines: 90,
          branches: 85,
          functions: 100,
          statements: 90,
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
});
