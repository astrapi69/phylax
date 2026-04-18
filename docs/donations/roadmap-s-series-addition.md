# ROADMAP Addition: S-Series (Spenden-Integration)

Add this section to `docs/ROADMAP.md` between Phase 3 and the Release section.

---

## Phase 3.5: Spenden-Integration (S-Serie)

Goal: Nutzer koennen das Projekt unterstuetzen. Hinweise sind dezent, respektvoll, ohne Dark Patterns. Spenden-State lokal, kein Tracking.

Siehe `docs/donation-strategy.md` fuer vollstaendige Konzept-Dokumentation.

- [ ] **S-01** Settings-Abschnitt "Phylax unterstuetzen" mit Projekt-Kontext und externem Link
- [ ] **S-02** Einmaliger Onboarding-Hinweis nach erstem Profil-Create/Import, mit "Verstanden"/"Unterstuetzen" Buttons und localStorage-Flag
- [ ] **S-03** 90-Tage-Reminder-Banner auf Profile-View mit drei Dismiss-Pfaden (Spenden: +180 Tage, Nicht-jetzt: +90 Tage, Close: +90 Tage)

### Pending Entscheidungen vor Implementierung

- Landingpage-URL (eigene Domain vs. GitHub vs. beides)
- Initial aktive Spenden-Kanaele (Vorschlag: GitHub Sponsors + Liberapay + Bank-Link)
- Landingpage-Sprache (Deutsch vs. beides)

---

## Phase 4: Release-Vorbereitung (geplant nach S-Serie)

- [ ] **R-01** PWA-Icons in allen geforderten Groessen
- [ ] **R-02** manifest.json review und final polish
- [ ] **R-03** README.md Ueberarbeitung mit Screenshots und Quickstart
- [ ] **R-04** Spenden-Landingpage erstellen und verlinken
- [ ] **R-05** Initial GitHub Release mit Changelog
