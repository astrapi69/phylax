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
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#ffffff',
        theme_color: '#1f2937',
        categories: ['productivity'],
        icons: [
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
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
        // Exclude empty placeholder index files from F-02 scaffold.
        // Remove entries from this list as modules gain real code.
        'src/**/index.ts',
        'src/App.tsx',
      ],
      thresholds: {
        // Project-wide floor per quality-checks.md
        // TODO [F-05b]: add per-module thresholds for domain 90%,
        // features 85%, ui 85%, lib 90% as those modules gain real code.
        lines: 85,
        branches: 85,
        functions: 85,
        statements: 85,
        'src/crypto/**': {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
        'src/db/**': {
          lines: 95,
          branches: 95,
          functions: 95,
          statements: 95,
        },
      },
    },
  },
});
