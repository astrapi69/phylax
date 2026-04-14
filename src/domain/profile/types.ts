import type { DomainEntity } from '../../db/repositories/encryptedRepository';

/**
 * Doctor or medical provider contact information.
 * Value type, not a persistent entity.
 */
export interface DoctorInfo {
  name: string;
  address?: string;
  specialty?: string;
}

/**
 * A single weight measurement at a point in time.
 * Value type used in BaseData.weightHistory.
 */
export interface WeightEntry {
  /** ISO date string "YYYY-MM-DD" */
  date: string;
  weightKg: number;
}

/**
 * Core profile base data: demographics, medical context, and
 * structural metadata for the living health profile.
 *
 * Value type embedded in Profile. Not a separate persistent entity.
 */
export interface BaseData {
  /**
   * User-visible profile name. Optional for backwards compatibility with
   * profiles created before the field existed. Use `getDisplayName` to
   * render with a type-aware fallback rather than reading this directly.
   */
  name?: string;
  /** ISO date "YYYY-MM-DD" */
  birthDate?: string;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  weightHistory: WeightEntry[];
  primaryDoctor?: DoctorInfo;
  knownDiagnoses: string[];
  currentMedications: string[];
  relevantLimitations: string[];
  profileType: 'self' | 'proxy';
  /** Caregiver name for proxy profiles */
  managedBy?: string;
  /**
   * Free-form Markdown for context that does not fit the structured fields.
   * Lifestyle notes, general health approach, caregiver context, etc.
   */
  contextNotes?: string;
}

/**
 * The top-level profile entity.
 *
 * One per Phylax installation in the MVP. Contains base data,
 * warning signs, external references, and version metadata.
 *
 * The self-regulation summary ("Selbstregulationsverhalten") is NOT
 * stored here. It is a computed rollup generated on export from the
 * individual Observation.selfRegulation fields.
 */
export interface Profile extends DomainEntity {
  baseData: BaseData;
  /** Individual warning signs, each as a separate string */
  warningSigns: string[];
  /** External references (URLs, document names, provider contacts) */
  externalReferences: string[];
  /** Semantic version string, e.g. "1.3.1" */
  version: string;
  /** Reason for the most recent update */
  lastUpdateReason?: string;
}
