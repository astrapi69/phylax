/**
 * Stryker mutation testing - shared base configuration.
 *
 * See docs/decisions/ADR-0011 (added in T-04h) for scope, thresholds,
 * survivor-handling policy, and cadence. Per-module scope is extended
 * across T-04d (repositories), T-04f (parser), T-04g (import).
 *
 * Blanket exclusions applied to every mutate path:
 *   - *.test.ts / *.test.tsx: the tests themselves are not mutated
 *   - test-setup.ts:          vitest setup files with environment polyfills
 *   - test-helpers.ts:        shared test utilities
 *   - index.ts:               barrel re-exports with no logic
 *
 * Per-mutant exclusions (equivalent mutants or intentional-weakness tests)
 * are annotated inline in the source via `// Stryker disable next-line ...`
 * comments rather than collected here. That keeps the justification next
 * to the code it concerns.
 *
 * Per-module configs (stryker.crypto.mjs, stryker.repos.mjs, etc.)
 * import this base and override mutate + thresholds. The base config
 * itself contains ALL modules with the lowest threshold (parser's 55)
 * so that a single `npx stryker run` sanity-checks the full codebase.
 * The nightly CI runs each per-module config for accurate per-module
 * threshold enforcement.
 */

export const STRYKER_EXCLUDES = [
  '!src/**/*.test.ts',
  '!src/**/*.test.tsx',
  '!src/**/test-setup.ts',
  '!src/**/test-helpers.ts',
  '!src/**/index.ts',
];

export const strykerBase = {
  packageManager: 'npm',
  testRunner: 'vitest',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  coverageAnalysis: 'perTest',

  reporters: ['html', 'clear-text', 'progress'],
  htmlReporter: {
    fileName: 'reports/mutation/index.html',
  },

  timeoutMS: 60000,
  concurrency: 4,
};

// Default export: full combined scope, lowest module threshold.
export default {
  ...strykerBase,

  mutate: [
    'src/crypto/**/*.ts',
    'src/db/repositories/**/*.ts',
    'src/features/profile-import/parser/**/*.ts',
    'src/features/profile-import/import/**/*.ts',
    ...STRYKER_EXCLUDES,
  ],

  // Combined threshold = lowest module (parser at 55).
  // Per-module enforcement happens via module-specific configs.
  thresholds: {
    high: 90,
    low: 70,
    break: 55,
  },
};
