import type {
  Profile,
  Observation,
  LabReport,
  LabValue,
  Supplement,
  OpenPoint,
  ProfileVersion,
  TimelineEntry,
  BaseData,
} from '../../../domain';

/**
 * Strip DomainEntity fields (id, profileId, createdAt, updatedAt)
 * that are assigned at import time, not by the parser.
 */
type Parsed<T> = Omit<T, 'id' | 'profileId' | 'createdAt' | 'updatedAt'>;

/**
 * Parsed BaseData with profileType optional.
 * The parser cannot determine profileType from the Markdown
 * (it is not in the source document). The import step (O-08)
 * sets it based on user choice.
 */
export interface ParsedBaseData extends Omit<BaseData, 'profileType'> {
  profileType?: 'self' | 'proxy';
}

export interface ParsedProfile extends Omit<Parsed<Profile>, 'baseData'> {
  baseData: ParsedBaseData;
}

export type ParsedObservation = Parsed<Observation>;

export type ParsedLabReport = Parsed<LabReport>;

/**
 * Parsed lab value with reportIndex instead of reportId.
 * reportIndex links to the index in ParseResult.labReports array
 * since no database ID exists yet at parse time.
 */
export interface ParsedLabValue extends Parsed<LabValue> {
  reportIndex: number;
}

export type ParsedSupplement = Parsed<Supplement>;
export type ParsedOpenPoint = Parsed<OpenPoint>;
export type ParsedProfileVersion = Parsed<ProfileVersion>;
export type ParsedTimelineEntry = Parsed<TimelineEntry>;

export interface ParseResult {
  profile: ParsedProfile | null;
  observations: ParsedObservation[];
  labReports: ParsedLabReport[];
  labValues: ParsedLabValue[];
  supplements: ParsedSupplement[];
  openPoints: ParsedOpenPoint[];
  profileVersions: ParsedProfileVersion[];
  timelineEntries: ParsedTimelineEntry[];
  report: ParseReport;
  originalMarkdown: string;
}

export interface ParseReport {
  recognized: RecognizedSection[];
  warnings: ParseWarning[];
  unrecognized: UnrecognizedBlock[];
  metadata: ParseMetadata;
}

export interface RecognizedSection {
  heading: string;
  entityType: string;
  itemCount: number;
}

export interface ParseWarning {
  section: string;
  message: string;
  rawContent?: string;
}

export interface UnrecognizedBlock {
  heading: string;
  content: string;
}

export interface ParseMetadata {
  profileVersion?: string;
  lastUpdate?: string;
  changeReason?: string;
}
