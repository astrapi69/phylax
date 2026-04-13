import type {
  ParseResult,
  ParseMetadata,
  RecognizedSection,
  ParseWarning,
  UnrecognizedBlock,
  ParsedProfile,
} from './types';
import { splitIntoSections } from './helpers/splitIntoSections';
import { parseBasisdaten } from './sections/parseBasisdaten';
import { parseBeobachtungen } from './sections/parseBeobachtungen';
import { parseBlutwerte } from './sections/parseBlutwerte';
import { parseSupplements } from './sections/parseSupplements';
import { parseOffenePunkte } from './sections/parseOffenePunkte';
import { parseVerlaufsnotizen } from './sections/parseVerlaufsnotizen';
import { parseVersionshistorie } from './sections/parseVersionshistorie';
import { parseWarnsignale, parseExterneReferenzen } from './sections/parseWarnsignale';

/**
 * Section heading patterns mapped to parser functions.
 * Order does not matter; sections are matched by heading text.
 */
const SECTION_PATTERNS: Array<{
  pattern: RegExp;
  key: string;
}> = [
  { pattern: /basisdaten/i, key: 'basisdaten' },
  { pattern: /(?:relevante\s+)?vorgeschichte|beobachtungen/i, key: 'beobachtungen' },
  { pattern: /blutwerte|laborwerte|blutbild/i, key: 'blutwerte' },
  { pattern: /belastungsreaktionen/i, key: 'belastungsreaktionen' },
  { pattern: /vertr(?:ae|\u00e4)glichkeiten|supplemente|medikamente/i, key: 'supplements' },
  { pattern: /gewichtsmanagement|ernaehrung.*gewicht|abnehmplan/i, key: 'gewichtsmanagement' },
  { pattern: /warnsignale/i, key: 'warnsignale' },
  { pattern: /selbstregulationsverhalten/i, key: 'selbstregulation_summary' },
  { pattern: /externe\s+referenzen/i, key: 'externe_referenzen' },
  { pattern: /verlaufsnotizen/i, key: 'verlaufsnotizen' },
  { pattern: /offene\s+punkte/i, key: 'offene_punkte' },
];

const VERSION_PATTERN = /(?:Medizinisches\s+)?Profil.*?(?:Version|v)\s*([\d.]+)/i;
const UPDATE_PATTERN = /Letzte\s+Aktualisierung:?\s*(.+)/i;
const CHANGE_REASON_PATTERN = /(?:Aenderungsgrund|Grund)\s+v[\d.]+:?\s*(.+)/i;

/**
 * Parse a Markdown living health profile into structured domain objects.
 *
 * This is a pure function with no side effects. It does not access
 * repositories, encryption, or storage. The result is a detached
 * preview structure ready for import (O-08).
 *
 * The parser never throws on malformed input. Errors are captured
 * as warnings in the ParseReport.
 */
export function parseProfile(markdown: string): ParseResult {
  const sections = splitIntoSections(markdown, 2);
  const recognized: RecognizedSection[] = [];
  const warnings: ParseWarning[] = [];
  const unrecognized: UnrecognizedBlock[] = [];
  const metadata = extractMetadata(sections[0]?.content ?? '');

  let profile: ParsedProfile | null = null;
  const result: ParseResult = {
    profile: null,
    observations: [],
    labReports: [],
    labValues: [],
    supplements: [],
    openPoints: [],
    profileVersions: [],
    timelineEntries: [],
    report: { recognized: [], warnings: [], unrecognized: [], metadata },
    originalMarkdown: markdown,
  };

  for (const section of sections) {
    if (section.level === 0) continue; // preamble handled via metadata

    const sectionKey = identifySection(section.heading);

    switch (sectionKey) {
      case 'basisdaten': {
        const baseData = parseBasisdaten(section.content);
        profile = {
          baseData,
          warningSigns: [],
          externalReferences: [],
          version: metadata.profileVersion ?? '1.0',
          lastUpdateReason: metadata.changeReason,
        };
        recognized.push({ heading: section.heading, entityType: 'Profile', itemCount: 1 });
        break;
      }

      case 'beobachtungen':
      case 'belastungsreaktionen':
      case 'gewichtsmanagement': {
        const { observations: obs, warnings: obsWarnings } = parseBeobachtungen(section.content);
        result.observations.push(...obs);
        warnings.push(...obsWarnings);
        recognized.push({
          heading: section.heading,
          entityType: 'Observation',
          itemCount: obs.length,
        });
        break;
      }

      case 'blutwerte': {
        const { labReports, labValues, warnings: labWarnings } = parseBlutwerte(section.content);
        result.labReports.push(...labReports);
        result.labValues.push(...labValues);
        warnings.push(...labWarnings);
        recognized.push({
          heading: section.heading,
          entityType: 'LabReport+LabValue',
          itemCount: labReports.length,
        });
        break;
      }

      case 'supplements': {
        const supplements = parseSupplements(section.content);
        result.supplements.push(...supplements);
        recognized.push({
          heading: section.heading,
          entityType: 'Supplement',
          itemCount: supplements.length,
        });
        break;
      }

      case 'warnsignale': {
        const signs = parseWarnsignale(section.content);
        if (profile) {
          profile.warningSigns = signs;
        }
        recognized.push({
          heading: section.heading,
          entityType: 'Profile.warningSigns',
          itemCount: signs.length,
        });
        break;
      }

      case 'externe_referenzen': {
        const refs = parseExterneReferenzen(section.content);
        if (profile) {
          profile.externalReferences = refs;
        }
        recognized.push({
          heading: section.heading,
          entityType: 'Profile.externalReferences',
          itemCount: refs.length,
        });
        break;
      }

      case 'verlaufsnotizen': {
        const entries = parseVerlaufsnotizen(section.content);
        result.timelineEntries.push(...entries);
        recognized.push({
          heading: section.heading,
          entityType: 'TimelineEntry',
          itemCount: entries.length,
        });
        break;
      }

      case 'offene_punkte': {
        const points = parseOffenePunkte(section.content);
        result.openPoints.push(...points);
        recognized.push({
          heading: section.heading,
          entityType: 'OpenPoint',
          itemCount: points.length,
        });
        break;
      }

      case 'selbstregulation_summary': {
        // Computed on export, not imported. Skip silently.
        recognized.push({
          heading: section.heading,
          entityType: 'Skipped (computed)',
          itemCount: 0,
        });
        break;
      }

      default: {
        // Check for Versionshistorie (often at H3 level within another section, or standalone)
        if (/versionshistorie/i.test(section.heading)) {
          const versions = parseVersionshistorie(section.content);
          result.profileVersions.push(...versions);
          recognized.push({
            heading: section.heading,
            entityType: 'ProfileVersion',
            itemCount: versions.length,
          });
        } else {
          unrecognized.push({
            heading: section.heading,
            content: section.content.substring(0, 500),
          });
        }
      }
    }
  }

  // Also look for Versionshistorie inside any section's content (often at bottom as H3)
  if (result.profileVersions.length === 0) {
    const vhMatch = markdown.match(
      /###\s*Versionshistorie\s*\n([\s\S]*?)(?=\n##\s|\n###\s[^V]|$)/i,
    );
    if (vhMatch?.[1]) {
      const versions = parseVersionshistorie(vhMatch[1]);
      result.profileVersions.push(...versions);
      if (versions.length > 0) {
        recognized.push({
          heading: 'Versionshistorie (inline)',
          entityType: 'ProfileVersion',
          itemCount: versions.length,
        });
      }
    }
  }

  result.profile = profile;
  result.report = { recognized, warnings, unrecognized, metadata };

  return result;
}

function identifySection(heading: string): string | null {
  for (const { pattern, key } of SECTION_PATTERNS) {
    if (pattern.test(heading)) return key;
  }
  return null;
}

function extractMetadata(preamble: string): ParseMetadata {
  const metadata: ParseMetadata = {};

  const versionMatch = VERSION_PATTERN.exec(preamble);
  if (versionMatch?.[1]) {
    metadata.profileVersion = versionMatch[1];
  }

  const updateMatch = UPDATE_PATTERN.exec(preamble);
  if (updateMatch?.[1]) {
    metadata.lastUpdate = updateMatch[1].trim();
  }

  const changeMatch = CHANGE_REASON_PATTERN.exec(preamble);
  if (changeMatch?.[1]) {
    metadata.changeReason = changeMatch[1].trim();
  }

  return metadata;
}
