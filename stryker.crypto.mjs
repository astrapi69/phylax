import { strykerBase, STRYKER_EXCLUDES } from './stryker.config.mjs';

/** Per-module config: crypto (src/crypto). Threshold: 95. */
export default {
  ...strykerBase,
  mutate: ['src/crypto/**/*.ts', ...STRYKER_EXCLUDES],
  thresholds: { high: 95, low: 85, break: 95 },
};
