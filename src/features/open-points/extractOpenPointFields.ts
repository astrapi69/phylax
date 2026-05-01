import type { FieldEntry } from '../../lib';
import type { ContextGroup } from './useOpenPoints';

/**
 * Flatten context groups into a `FieldEntry[]` for
 * `buildFieldMatchPlan`. Order MUST mirror `ContextGroup` +
 * `OpenPointItem` render order so the cursor assigned to each
 * match matches the visual top-to-bottom reading order;
 * Up/Down navigation then follows that order.
 *
 * Render order (per group, repeated in group iteration order):
 *   1. Context heading (group label)
 *   2. Per item in iteration order:
 *      a. text
 *      b. priority (badge, optional)
 *      c. timeHorizon (badge, optional)
 *      d. details (Markdown, optional)
 *
 * Optional fields are emitted only when present so the cursor
 * stays tight (no zero-mark fields). Filter coverage
 * (`filterOpenPoints.groupMatches`) and matchPlan coverage MUST
 * stay aligned: every field the filter searches must be scanned by
 * the plan, otherwise a retained group could end up with zero
 * marks.
 */
export function extractOpenPointFields(groups: ContextGroup[]): FieldEntry[] {
  const fields: FieldEntry[] = [];
  for (const group of groups) {
    fields.push({ key: `ctx:${group.context}:label`, text: group.context });
    for (const item of group.items) {
      fields.push({ key: `op:${item.id}:text`, text: item.text });
      if (item.priority) {
        fields.push({ key: `op:${item.id}:priority`, text: item.priority });
      }
      if (item.timeHorizon) {
        fields.push({ key: `op:${item.id}:timeHorizon`, text: item.timeHorizon });
      }
      if (item.details && item.details.trim() !== '') {
        fields.push({ key: `op:${item.id}:details`, text: item.details });
      }
    }
  }
  return fields;
}
