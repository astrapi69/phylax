/**
 * Stryker mutation testing configuration.
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
 */
export default {
  packageManager: 'npm',
  testRunner: 'vitest',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  coverageAnalysis: 'perTest',

  mutate: [
    'src/crypto/**/*.ts',
    'src/db/repositories/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
    '!src/**/test-setup.ts',
    '!src/**/test-helpers.ts',
    '!src/**/index.ts',
  ],

  reporters: ['html', 'clear-text', 'progress'],
  htmlReporter: {
    fileName: 'reports/mutation/index.html',
  },

  timeoutMS: 60000,
  concurrency: 4,

  // Threshold set in T-04c based on the measured post-fix baseline.
  // Policy: break = measured - 5 (rounded down) to absorb minor
  // measurement noise without masking real regressions.
  //
  // Baseline after T-04c (crypto only): 100.00% on covered code (45/45
  // killed, compile-error mutants excluded). Break set at 95 so a real
  // regression of more than one covered mutant breaks CI.
  thresholds: {
    high: 95,
    low: 85,
    break: 95,
  },
};
