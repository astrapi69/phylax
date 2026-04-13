import type { DomainEntity } from '../../db/repositories/encryptedRepository';

/**
 * Supplement intake category.
 *
 * Maps to the real profile's German categories:
 * - 'daily' = "Beibehalten-taeglich"
 * - 'regular' = "Beibehalten-3-4x/Woche" or similar regular schedule
 * - 'paused' = "Pausiert"
 * - 'on-demand' = "Bei Bedarf"
 */
export type SupplementCategory = 'daily' | 'regular' | 'paused' | 'on-demand';

/**
 * A supplement or nutritional product in the user's plan.
 *
 * Simple entity with category status (E1 strategy).
 * No separate schedule entity; the category and recommendation
 * fields capture the taking pattern.
 */
export interface Supplement extends DomainEntity {
  /** Product name, e.g. "Vitamin D3 2000 IE" */
  name: string;
  /** Brand name, e.g. "tetesept" */
  brand?: string;
  /** Current intake category */
  category: SupplementCategory;
  /** When/how to take, e.g. "Morgens mit Fruehstueck" */
  recommendation?: string;
  /** Why this supplement, e.g. "Empfohlen nach Bluttest Dezember 2024" */
  rationale?: string;
}
