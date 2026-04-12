/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
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
        // Exclude empty placeholder index files from F-02 scaffold.
        // Remove entries from this list as modules gain real code.
        'src/**/index.ts',
        'src/App.tsx',
      ],
      thresholds: {
        // Project-wide floor per quality-checks.md
        // TODO [F-05b]: add per-module thresholds for db 95%, domain 90%,
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
      },
    },
  },
});
