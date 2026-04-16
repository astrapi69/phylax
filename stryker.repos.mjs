import { strykerBase, STRYKER_EXCLUDES } from './stryker.config.mjs';

/** Per-module config: repositories (src/db/repositories). Threshold: 95. */
export default {
  ...strykerBase,
  mutate: ['src/db/repositories/**/*.ts', ...STRYKER_EXCLUDES],
  thresholds: { high: 95, low: 85, break: 95 },
};
