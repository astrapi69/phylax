import type { FieldEntry } from '../../lib';
import type { LabeledSupplementGroup } from './filterSupplements';

/**
 * Flatten labeled supplement groups into a `FieldEntry[]` for
 * `buildFieldMatchPlan`. Order MUST mirror
 * `SupplementCategoryGroup` + `SupplementCard` render order so the
 * cursor assigned to each match matches the visual top-to-bottom
 * reading order; Up/Down navigation then follows that order.
 *
 * Render order (per group, repeated in group iteration order):
 *   1. Translated category label (heading)
 *   2. Per supplement in card order:
 *      a. name
 *      b. brand (optional)
 *      c. recommendation (optional)
 *      d. rationale (optional)
 *
 * Optional fields are emitted only when present so the cursor stays
 * tight (no zero-mark fields). Filter coverage
 * (`filterSupplements.groupMatches`) and matchPlan coverage MUST
 * stay aligned: every field the filter searches must be scanned by
 * the plan, otherwise a retained group could end up with zero
 * marks.
 */
export function extractSupplementFields(groups: LabeledSupplementGroup[]): FieldEntry[] {
  const fields: FieldEntry[] = [];
  for (const group of groups) {
    fields.push({ key: `cat:${group.category}:label`, text: group.label });
    for (const s of group.supplements) {
      fields.push({ key: `sup:${s.id}:name`, text: s.name });
      if (s.brand) {
        fields.push({ key: `sup:${s.id}:brand`, text: s.brand });
      }
      if (s.recommendation) {
        fields.push({ key: `sup:${s.id}:recommendation`, text: s.recommendation });
      }
      if (s.rationale) {
        fields.push({ key: `sup:${s.id}:rationale`, text: s.rationale });
      }
    }
  }
  return fields;
}
