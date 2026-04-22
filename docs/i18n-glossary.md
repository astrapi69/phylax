# German-English Terminology Glossary

Single source of truth for Phylax UI translations.

I18N-02 sub-commits (02-a through 02-e) reference this document. Future
translation targets (ES/FR/EL under P-11 and later) start from this
DE-EN baseline rather than re-deriving choices.

When a translation choice is not covered here, add it with a one-line
reasoning note. Keep entries alphabetical within each section.

## Core domain

| DE                     | EN                     | Notes                                                          |
| ---------------------- | ---------------------- | -------------------------------------------------------------- |
| Abweichender Laborwert | abnormal lab value     | ai-chat context counts; "abnormal" matches medical-EN register |
| Arzt / Aerztin         | doctor                 | generic                                                        |
| Bekannte Diagnosen     | Known diagnoses        | profile-view section heading                                   |
| Beobachtung            | observation            | fits "living health" concept                                   |
| Betreuer               | caregiver              | proxy-profile context                                          |
| Gefuehrte Sitzung      | guided session         |                                                                |
| Gesamteinschaetzung    | overall assessment     | lab-report summary heading                                     |
| Gewichtsverlauf        | weight trend           | profile-summary base-data line                                 |
| Hausarzt               | primary care physician | not "GP" (UK/AU) or "family doctor" (US informal)              |
| Laborbefund            | lab report             | the document                                                   |
| Laborwerte             | lab values             | not "lab results" (implies finalization)                       |
| Medizinischer Befund   | medical finding        | observation card field                                         |
| Muster                 | pattern                |                                                                |
| Offene Punkte          | open points            | keep literal - Phylax-specific, not "tasks" or "action items"  |
| Offener Punkt          | open point             | singular form                                                  |
| Profil                 | profile                |                                                                |
| Roh-Ausgabe            | raw output             | import cleanup flow (AI result)                                |
| Selbstregulation       | self-regulation        | established English term                                       |
| Supplement             | supplement             |                                                                |
| Unbekannt              | Unknown                | import source fallback                                         |
| Ungeloest              | unresolved             | open-points heading qualifier in profile-summary               |
| Verlauf (nav label)    | timeline               |                                                                |
| Verlaufseintrag        | timeline entry         | singular; plural "Verlaufseintraege" -> "timeline entries"     |
| Verlaufsnotiz          | timeline entry         | synonym used in import + profile-list UIs                      |
| Warnhinweis            | warning                | generic warning (import parse warnings, etc.)                  |
| Warnsignal             | warning sign           | medical red-flag sense                                         |
| Zielprofil             | target profile         | import destination fallback                                    |

## Profile and base data

| DE                         | EN                   | Notes                        |
| -------------------------- | -------------------- | ---------------------------- |
| Aktuelle Medikamente       | Current medications  | profile-view section heading |
| Alter                      | age                  |                              |
| Basisdaten                 | base data            |                              |
| Diagnosen                  | diagnoses            |                              |
| Eigenes Profil             | own profile          |                              |
| Einschraenkungen           | limitations          |                              |
| Externe Referenzen         | External references  | profile-view section heading |
| Geburtsdatum               | date of birth        |                              |
| Gewicht                    | weight               |                              |
| Groesse                    | height               |                              |
| Kontextnotizen             | Context notes        | profile-view base-data       |
| Letzte Aenderung           | Last change          | profile-view header field    |
| Medikamente                | medications          |                              |
| Mein Profil                | My profile           | fallback display name        |
| Profilauswahl              | profile selection    | import flow step             |
| Relevante Einschraenkungen | Relevant limitations | profile-view section heading |
| Stellvertretend fuer       | proxy for            |                              |
| Stellvertreterprofil       | proxy profile        |                              |
| Ziel (Gewicht)             | target (weight)      | weight target                |

## AI and commit flow

| DE                                   | EN              | Notes                                                                |
| ------------------------------------ | --------------- | -------------------------------------------------------------------- |
| Aenderung                            | change          |                                                                      |
| Anbieter                             | Provider        | AI provider dropdown label                                           |
| API-Schluessel                       | API key         | AI config field                                                      |
| benutzerdefiniert                    | custom          | model suffix                                                         |
| Chat-Verlauf                         | Chat log        | ARIA label (role="log" precedent); use "Chat history" for visible UI |
| Fortschritt                          | Progress        | guided-session indicator                                             |
| KI                                   | AI              | abbreviation                                                         |
| KI-Assistent                         | AI assistant    |                                                                      |
| Konversation                         | conversation    | system framing context                                               |
| Master-Passwort                      | master password |                                                                      |
| Modell                               | Model           | AI config field                                                      |
| Nachricht                            | message         | chat entry, input label                                              |
| Profil teilen                        | share profile   |                                                                      |
| Roh-Markdown                         | raw Markdown    |                                                                      |
| Sitzung                              | session         | guided session                                                       |
| Uebernehmen (commit fragment action) | apply           | end-user register; "commit" reserved for git-speak                   |
| Versionseintrag                      | version note    | "note" reads more naturally than "entry" for a description field     |
| Versionsgeschichte                   | version history |                                                                      |
| Vorschau                             | preview         |                                                                      |

## Common actions and chrome

| DE                   | EN                     | Notes                        |
| -------------------- | ---------------------- | ---------------------------- |
| Abbrechen            | Cancel                 |                              |
| Aendern              | Change                 | change stored value (button) |
| Auswaehlen           | Select                 |                              |
| Datei auswaehlen     | Choose file            | file picker label            |
| Datenschutz          | privacy                |                              |
| Einstellungen        | settings               |                              |
| Entsperren           | Unlock                 |                              |
| Erledigt             | Done                   |                              |
| Erstellen...         | Creating...            | form submit pending state    |
| Exportieren          | Export                 | action label                 |
| Ja, ersetzen         | Yes, replace           | destructive confirm          |
| Laden...             | Loading...             |                              |
| Leeren               | Clear                  |                              |
| Schliessen           | Close                  |                              |
| Senden               | Send                   | chat submit button           |
| Sortierung           | Sort                   | observations sort label      |
| Speichern            | Save                   |                              |
| Sperren              | Lock                   |                              |
| Sprache              | language               | for the language switcher    |
| Systemsprache folgen | Follow system language | auto option                  |
| Version              | Version                | profile header (semver)      |
| Weiter               | Next                   |                              |
| Zurueck              | Back                   |                              |

## Table headers and field labels

| DE            | EN             | Notes                                                                       |
| ------------- | -------------- | --------------------------------------------------------------------------- |
| Begruendung   | Rationale      | supplement card field                                                       |
| Bericht-Nr.   | Report no.     | abbreviation                                                                |
| Bewertung     | Assessment     | lab-values table row header                                                 |
| Einheit       | Unit           |                                                                             |
| Einschaetzung | Assessment     | lab-values category heading; same EN as "Bewertung" (context disambiguates) |
| Empfehlung    | Recommendation | supplement card field                                                       |
| Ergebnis      | Result         |                                                                             |
| Labor         | Lab            |                                                                             |
| Parameter     | Parameter      |                                                                             |
| Referenz      | Reference      |                                                                             |
| Relevanz      | Relevance      | observation card + lab-report section                                       |

## Error and status messages

| DE                                                 | EN                                         | Notes                                                        |
| -------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| API-Schluessel ungueltig.                          | Invalid API key.                           |                                                              |
| App ist gesperrt.                                  | The app is locked.                         |                                                              |
| Der KI-Dienst ist voruebergehend nicht erreichbar. | The AI service is temporarily unavailable. |                                                              |
| Fehler beim KI-Dienst.                             | AI service error.                          |                                                              |
| Fehler beim Speichern.                             | Error saving.                              |                                                              |
| Kein Profil gefunden.                              | No profile found.                          |                                                              |
| Keine Internetverbindung.                          | No internet connection.                    |                                                              |
| leerer Abschnitt uebersprungen                     | empty section skipped                      | import preview info-level notice for placeholder H3 headings |
| Zu viele Anfragen.                                 | Too many requests.                         |                                                              |

## Support and donation

| DE                      | EN                  | Notes                                                                                        |
| ----------------------- | ------------------- | -------------------------------------------------------------------------------------------- |
| Projekt unterstuetzen   | Support the project |                                                                                              |
| Spenden / Unterstuetzen | support             | "support" over "donate" - broader scope (stars, issues, code, word-of-mouth, plus Liberapay) |
| Unterstuetzen           | Support             |                                                                                              |

## Badges and statuses

| DE                          | EN                    | Notes                |
| --------------------------- | --------------------- | -------------------- |
| aktualisiert                | updated               | commit-preview badge |
| neu                         | new                   | commit-preview badge |
| Pausiert / pausiert         | Paused / paused       | supplement category  |
| Regelmaessig / regelmaessig | Regular / regular     | supplement category  |
| Taeglich / taeglich         | Daily / daily         | supplement category  |
| unveraendert                | unchanged             | commit-preview badge |
| Bei Bedarf / bei Bedarf     | As needed / as needed | supplement category  |

## Theme

| DE          | EN         | Notes                    |
| ----------- | ---------- | ------------------------ |
| Automatisch | Auto       | theme toggle label       |
| Darstellung | Appearance | settings section heading |
| Dunkel      | Dark       |                          |
| Hell        | Light      |                          |

## Conventions

- Translation targets natural English suitable for a general-audience
  health-profile app.
- No regional variant: "color" not "colour", "authorize" not "authorise".
  American spelling as the default, consistent with most cross-border
  SaaS conventions.
- Sentences retain punctuation from the DE source (periods, ellipses,
  question marks).
- Umlauts are never used. Source DE uses ASCII substitution
  (ae/oe/ue/ss) per I18N-01l-a. EN has no umlauts anyway.
- Interpolation placeholders (`{{name}}`, `{{count}}`, `{{min}}`, etc.)
  stay byte-identical across languages.
- Plural forms use i18next `_one` / `_other` suffixes when the source
  code passes a `count` parameter.
- Capitalization follows context: button labels Title Case ("Cancel",
  "Apply"), section headings Title Case ("Appearance"), sentence text
  in sentences.
