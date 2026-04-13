# ADR-0007: Phase 2 Data Model

**Date:** 2026-04-13
**Status:** Accepted

## Context

Phase 2 requires a domain model for importing real living health profiles. The model was designed against an actual profile (v1.3.1) containing observations with variable sub-sections, lab reports with nested values and per-category assessments, supplements with categories, open points with context grouping, timeline entries, and a version history.

Six design decisions were made.

## Decision A: Hybrid observation field strategy (A3)

Core triad (fact, pattern, selfRegulation) plus theme and status are typed fields. Medical finding and relevance notes are typed because they are semantically distinct. Everything else goes into `extraSections: Record<string, string>` with German keys preserved verbatim.

**Rejected:** A1 (all fields typed) creates sprawl of nullable fields. A2 (only triad typed) loses the semantic distinction of medical findings.

## Decision B: Observation-level provenance (B1)

Single `source: 'user' | 'ai' | 'medical'` field per observation. Coarse but honest: the real profile does not consistently mark provenance per field.

**Rejected:** B2 (per-field source) and B3 (provenance array) are premature. Will reconsider when AI features land in DP-06.

## Decision C: TimelineEntry as separate entity (C1)

Timeline entries (Verlaufsnotizen) are date-bounded, narrative, and retrospective. Observations are theme-bounded, structured, and ongoing. Different structure, different access patterns, different UI.

**Rejected:** C2 (discriminator on Observation) conflates two distinct concepts. C3 (nested history) forces awkward nesting.

## Decision D: Flat LabValue with reportId FK (D1)

LabValue is a top-level entity with a `reportId` foreign key to LabReport. Enables queries like "all Kreatinin values over time" without loading all reports.

**Rejected:** D2 (nested values in LabReport) forces full report loading for single-parameter queries.

## Decision E: Single Supplement entity (E1)

Supplement has a `category` field ('daily' | 'regular' | 'paused' | 'on-demand') and descriptive fields. No separate schedule entity.

**Rejected:** E2 (Supplement + SupplementSchedule) overengineered for the current profile structure. Revisit in DP-03.

## Decision F: Typed profile sections for original content (F1)

Warning signs and external references are typed arrays on Profile. The self-regulation summary is a computed rollup generated on export, not stored.

**Rejected:** F2 (generic sections map) loses type safety for consistently-present sections.

## Additional design choices

- **Observation.status is free text**, not an enum. Real profiles use descriptive phrases that resist categorization.
- **LabValue.result is string**, not number. Handles non-numeric results like "negativ", ">100", "1:40".
- **All Markdown content fields** (fact, pattern, selfRegulation, content) are stored as Markdown strings. The UI renders them as Markdown. Round-trip import/export preserves structure.
- **German section keys** in extraSections and categoryAssessments are preserved verbatim. The profile is a German-language artifact; translating keys would lose information.
- **BaseData.contextNotes** added as a free-text Markdown field for prose that does not fit the structured fields.

## Forward compatibility: Dexie schema impact

The Phase 2 domain model requires two new IndexedDB tables not present in the current schema v1:

- **lab_reports**: for LabReport entities (parent of LabValues)
- **timeline_entries**: for TimelineEntry entities

The Dexie migration to schema v2 will happen in the task that implements the first repository needing a new table. Existing tables (profiles, observations, lab_values, supplements, open_points, profile_versions, documents, meta) are unchanged. The domain model maps to the existing generic `payload: ArrayBuffer` columns via the EncryptedRepository base class.

## Consequences

- The hybrid model handles the real profile's variability without over-typing rare fields
- German keys in maps mean the parser does not need a translation layer
- Flat LabValue enables time-series queries that a nested model would make expensive
- Free-text status means UI filtering requires substring matching, not enum comparison
- The model is additive: new observation sections, lab categories, or supplement fields can be added without schema changes (they land in maps or as new optional typed fields)
