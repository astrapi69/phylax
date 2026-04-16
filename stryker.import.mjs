import { strykerBase, STRYKER_EXCLUDES } from './stryker.config.mjs';

/** Per-module config: import (src/features/profile-import/import). */
export default {
  ...strykerBase,
  mutate: ['src/features/profile-import/import/**/*.ts', ...STRYKER_EXCLUDES],
  // T-04g baseline: 81.16% total / 83.58% covered after Category A fixes.
  // Remaining 22 survivors: 4 Category B (countEntities index-name
  // leniency, already disabled inline), 18 Category C (isTargetEmpty
  // per-entity branches, useImport isEmpty per-entity branches).
  thresholds: { high: 90, low: 80, break: 75 },
};
