# Example Profile Mapping

This document maps the sections of a real living health profile (v1.3.1) to the Phase 2 domain model. It serves as the reference for the parser and as the acceptance test: if a section cannot be represented, the model is wrong.

## 1. Basisdaten -> Profile.baseData

| Profile field              | Domain field                 | Example                                     |
| -------------------------- | ---------------------------- | ------------------------------------------- |
| Geburtsdatum               | baseData.birthDate           | "1982-05-15"                                |
| Alter                      | baseData.age                 | 43                                          |
| Groesse                    | baseData.heightCm            | 178                                         |
| Gewicht (aktuell)          | baseData.weightKg            | 96.5                                        |
| Zielgewicht                | baseData.targetWeightKg      | 85                                          |
| Gewichtsverlauf            | baseData.weightHistory       | [{ date: "2025-01-01", weightKg: 98 }, ...] |
| Hausarzt                   | baseData.primaryDoctor       | { name: "Dr. ...", address: "..." }         |
| Bekannte Diagnosen         | baseData.knownDiagnoses      | ["Impingement links", "Veneninsuffizienz"]  |
| Aktuelle Medikamente       | baseData.currentMedications  | ["Ibuprofen bei Bedarf"]                    |
| Relevante Einschraenkungen | baseData.relevantLimitations | ["Gelenkprobleme beidseitig"]               |
| Prose context              | baseData.contextNotes        | Lifestyle or caregiver notes                |

**Profile-level fields:**

| Profile section                         | Domain field               | Example                               |
| --------------------------------------- | -------------------------- | ------------------------------------- |
| Version                                 | profile.version            | "1.3.1"                               |
| Letzte Aktualisierung / Aenderungsgrund | profile.lastUpdateReason   | "Blutbild Maerz 2026 ergaenzt"        |
| Warnsignale                             | profile.warningSigns       | ["Brustschmerzen bei Belastung", ...] |
| Externe Referenzen                      | profile.externalReferences | ["Lebende Gesundheit Serie: <url>"]   |

## 2. Beobachtungen -> Observation

Each themed section under "Beobachtungen" maps to one Observation entity.

**Example: "Schulter (links)"**

| Sub-section              | Domain field                                    | Notes                                                              |
| ------------------------ | ----------------------------------------------- | ------------------------------------------------------------------ |
| Beobachtung              | observation.fact                                | Markdown text describing what happens                              |
| Muster                   | observation.pattern                             | Markdown text describing recurrences                               |
| Selbstregulation         | observation.selfRegulation                      | Markdown list (bullet points with specific exercises, adjustments) |
| Status                   | observation.status                              | "Chronisch-rezidivierend" (free text)                              |
| Aerztlicher Befund       | observation.medicalFinding                      | "Impingement-Syndrom, konservativ"                                 |
| Relevanz fuer Abnehmziel | observation.relevanceNotes                      | Cross-theme link text                                              |
| Ursprung / Eigenanamnese | observation.extraSections["Ursprung"]           | Detailed origin story                                              |
| Kausalitaetskette        | observation.extraSections["Kausalitaetskette"]  | Cause-effect chain text                                            |
| Sekundaere Ursache       | observation.extraSections["Sekundaere Ursache"] | Secondary cause text                                               |
| Einschaetzung            | observation.extraSections["Einschaetzung"]      | Assessment (may be "Selbst + KI-gestuetzt")                        |
| Vorgeschichte            | observation.extraSections["Vorgeschichte"]      | Historical context                                                 |

**theme**: The heading text, e.g. "Schulter (links)", "Ernaehrung und Gewicht", "Blutdruck"

**source**: Default 'user'. If marked "(Einschaetzung: Selbst + KI-gestuetzt)" then 'ai' for AI-assisted content, 'medical' for doctor-quoted content.

**Observations with [offen] markers**: The "[offen]" text is preserved in the relevant field content. It is not a separate domain concept; it is inline Markdown.

## 3. Blutwerte -> LabReport + LabValue

Each "Blutbild vom [date]" section maps to one LabReport with multiple LabValues.

**LabReport mapping:**

| Profile field                  | Domain field                  | Example                                             |
| ------------------------------ | ----------------------------- | --------------------------------------------------- |
| Date in heading                | labReport.reportDate          | "2026-03-15"                                        |
| Labor                          | labReport.labName             | "Synlab"                                            |
| Arzt                           | labReport.doctorName          | "Dr. ..."                                           |
| Befundnr.                      | labReport.reportNumber        | "ABC123"                                            |
| Context line                   | labReport.contextNote         | "Routinekontrolle, Ueberweisung vom Hausarzt"       |
| Per-category Einschaetzung     | labReport.categoryAssessments | { "Blutbild": "Alle Werte im Normbereich...", ... } |
| Zusammenfassende Einschaetzung | labReport.overallAssessment   | Overall assessment text                             |
| Relevanz fuer Abnehmziel       | labReport.relevanceNotes      | Cross-theme link text                               |

**LabValue mapping (per row in the values table):**

| Profile column   | Domain field            | Example                     |
| ---------------- | ----------------------- | --------------------------- |
| Category heading | labValue.category       | "Blutbild", "Nierenwerte"   |
| Parameter        | labValue.parameter      | "Haemoglobin"               |
| Ergebnis         | labValue.result         | "14.2" (string, not number) |
| Einheit          | labValue.unit           | "g/dl"                      |
| Referenz         | labValue.referenceRange | "13.5-17.5"                 |
| Bewertung        | labValue.assessment     | "normal"                    |

Non-numeric results like "negativ", ">100", "1:40" are preserved as strings.

## 4. Ergaenzungsplan -> Supplement

Each row in the supplements table maps to one Supplement.

| Profile column | Domain field                       | Example                                   |
| -------------- | ---------------------------------- | ----------------------------------------- |
| Praeparat      | supplement.name + supplement.brand | "Vitamin D3 2000 IE" / "tetesept"         |
| Kategorie      | supplement.category                | 'daily', 'regular', 'paused', 'on-demand' |
| Empfehlung     | supplement.recommendation          | "Morgens mit Fruehstueck"                 |
| Begruendung    | supplement.rationale               | "Empfohlen nach Bluttest Dez 2024"        |

**Category mapping:**

| German                 | Domain value |
| ---------------------- | ------------ |
| Beibehalten-taeglich   | 'daily'      |
| Beibehalten-3-4x/Woche | 'regular'    |
| Pausiert               | 'paused'     |
| Bei Bedarf             | 'on-demand'  |

## 5. Offene Punkte -> OpenPoint

Each checklist item maps to one OpenPoint. The context heading becomes the grouping key.

| Profile field   | Domain field          | Example                            |
| --------------- | --------------------- | ---------------------------------- |
| Item text       | openPoint.text        | "Vitamin D nachkontrollieren"      |
| Section heading | openPoint.context     | "Wiederholungs-Blutabnahme"        |
| Checkbox state  | openPoint.resolved    | false (unchecked) / true (checked) |
| Priority marker | openPoint.priority    | "Hoch" if present                  |
| Time reference  | openPoint.timeHorizon | "Innerhalb 3 Monate" if present    |
| Sub-details     | openPoint.details     | Additional context text            |

## 6. Verlaufsnotizen -> TimelineEntry

Each dated section maps to one TimelineEntry.

| Profile field     | Domain field          | Example                |
| ----------------- | --------------------- | ---------------------- |
| Period in heading | timelineEntry.period  | "Dezember 2024"        |
| Title after dash  | timelineEntry.title   | "Brustkorbbeschwerden" |
| Bulleted content  | timelineEntry.content | Markdown bullets       |
| Author            | timelineEntry.source  | 'user' (default)       |

## 7. Versionshistorie -> ProfileVersion

Each row in the version history table maps to one ProfileVersion.

| Profile column | Domain field                     | Example                        |
| -------------- | -------------------------------- | ------------------------------ |
| Version        | profileVersion.version           | "1.3.1"                        |
| Datum          | profileVersion.changeDate        | "2026-04-13"                   |
| Aenderung      | profileVersion.changeDescription | "Blutbild Maerz 2026 ergaenzt" |

## 8. Selbstregulationsverhalten -> Computed (not stored)

The "Selbstregulationsverhalten" summary section is a rollup of individual Observation.selfRegulation fields. It is generated on export, not stored as a separate entity. The export logic iterates observations and concatenates their selfRegulation fields, grouped by theme.

## 9. Sections not mapped

The following profile sections are informational or structural and do not map to domain entities:

- **Table of contents**: navigational aid, not data
- **Inline version markers** like "(NEU v1.3)" or "(v1.2)": these are visual indicators in the source Markdown. They can be stripped during import or preserved as part of the text content.
