# Phylax - Konzept

## Vision

Phylax (griechisch phylax, "Wächter") ist eine persönliche, datensouveräne Gesundheitsplattform als Progressive Web App. Alle Daten bleiben lokal auf dem Gerät des Nutzers, verschlüsselt mit einem Master-Passwort. Kein Backend, keine Cloud, keine Telemetrie, keine Datensammlung.

Phylax basiert auf dem Prinzip der **lebenden Gesundheit**: Gesundheit ist kein Zustand, den Fachleute messen und verwalten, sondern ein Prozess, den der Mensch selbst führt. Die App hilft dem Nutzer, ein **lebendes medizinisches Profil** zu erstellen, zu pflegen und zu versionieren, das als strukturierte Gesprächsbasis für Arztbesuche dient.

Das Profil ersetzt keine Patientenakte und keine ärztliche Beratung. Es ist das personenzentrierte Gegenstück zur institutionellen Akte: zusammengeführt statt fragmentiert, verlaufsgesteuert statt vergangenheitsfixiert, faktenbasiert statt fremdinterpretierend.

Konzeptuelle Grundlage ist die Artikelserie [Lebende Gesundheit](https://asterios-raptis.medium.com/lebende-gesundheit-die-serie-0193f66df9a3) auf Medium.

## Kernprinzipien

1. **Local-first**: Alle Daten liegen ausschliesslich im Browser des Nutzers (IndexedDB).
2. **Zero-Knowledge**: Daten werden vor dem Schreiben verschlüsselt. Ohne Master-Passwort sind sie unlesbar.
3. **Kein Backend**: Keine Server, keine eigenen APIs, keine Accounts. Nur HTML, JS, CSS.
4. **Offline-fähig**: Funktioniert vollständig ohne Internetverbindung (PWA mit Service Worker).
5. **KI strukturiert, KI diagnostiziert nicht**: Die KI in Phylax ist ein Strukturierungspartner. Sie stellt keine Diagnosen, gibt keine Therapieempfehlungen und übernimmt keine klinische Verantwortung. Sie strukturiert, was der Nutzer einbringt.
6. **Keine medizinische Beratung**: Phylax ist ein Dokumentationstool, kein Medizinprodukt. Kein Code, der Diagnosen stellt oder Empfehlungen gibt.
7. **Datenhoheit**: Der Nutzer entscheidet, was dokumentiert wird. Nicht das Kliniksystem, nicht die App.

## Vier Säulen der lebenden Gesundheit

Das Konzept beruht auf vier Säulen:

1. **Verlaufskompetenz**: Der Nutzer kennt Muster, die kein Arzt in 10 Minuten sieht.
2. **Kontextkontrolle**: Der Nutzer bringt die ganze Geschichte mit, nicht nur isolierte Symptome.
3. **Datenhoheit**: Der Nutzer entscheidet, was dokumentiert wird.
4. **Entscheidungsfähigkeit auf Augenhöhe**: Der Nutzer sucht Beratung, nicht Unterordnung.

## Core Principle: Structure, Never Diagnose

Phylax is a structuring tool, not a diagnostic system. It helps the user organize their own observations, lab values, and health decisions, but it never substitutes for medical judgment.

This has concrete implications across the application:

- **Every derived output carries a disclaimer.** Plans (diet, training, supplements, medications) generated from the profile data always include a visible reminder that the plan is a structured suggestion, not a medical prescription, and must be reviewed with a qualified healthcare provider.
- **Interpretations are labeled.** When the profile contains interpretive content (patterns, hypotheses about causes), the source is explicit: user self-assessment, AI-generated analysis, or quoted from a medical professional. The three are never conflated.
- **No automated decisions about treatment.** Phylax does not recommend dose changes, medication adjustments, or treatment stops based on data patterns. It surfaces patterns for the user to discuss with their doctor.
- **AI assistance is transparent.** Any AI-generated content (analyses, plan suggestions) is marked as such in the UI and stored with provenance metadata, so the user and their doctor can distinguish self-observation from machine-generated text.

This principle is not a legal disclaimer appended to the UI. It shapes feature decisions: a feature that subtly encourages the user to treat Phylax as an authority is a feature that violates the principle and should not be built.

## Zielgruppe

- Menschen, die ihre Gesundheit aktiv beobachten und dokumentieren wollen
- Patienten, die ein strukturiertes Profil für Arztbesuche aufbereiten möchten
- Angehörige, die ein Stellvertreterprofil für eine Person führen, die es nicht selbst kann (z.B. ältere Eltern mit Demenz, Kinder)
- Datenschutzbewusste Nutzer, die keiner Cloud-Lösung vertrauen

## Abgrenzung zu bestehenden Lösungen

| Lösung              | Unterschied zu Phylax                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| ePA (Deutschland)   | Zentral gespeichert bei Krankenkasse, kein strukturiertes Profil im Sinne der lebenden Gesundheit |
| Apple Health        | iOS-only, kein Export für Ärzte, Fokus Fitness, keine Beobachtungsstruktur                        |
| Ada Health          | Symptom-Checker (diagnostiziert), keine persönliche Akte                                          |
| MediVault           | Cloud-basiert, kein Zero-Knowledge                                                                |
| Einfache Notiz-Apps | Keine Verschlüsselung, keine Profilstruktur, keine KI-gestützte Erfassung                         |

## Das medizinische Profil

Das zentrale Artefakt in Phylax ist das **medizinische Profil** - ein lebendes, versioniertes Markdown-Dokument. Es wird verschlüsselt gespeichert, als Markdown angezeigt und exportiert.

### Profilstruktur

```markdown
# Medizinisches Profil

## 1. Basisdaten

Name, Alter, bekannte Diagnosen, aktuelle Medikamente,
relevante Einschränkungen, Profil gepflegt durch (bei Stellvertretung)

## 2. Blutwerte

Datum, Parameter, Ergebnis, Referenzbereich, kontextuelle Bewertung

## 3. Beobachtungen (gruppiert nach Thema)

### [Thema, z.B. Schulter / Ernährung / Blutdruck]

- Beobachtung: Was ist konkret geschehen?
- Muster: Was wiederholt sich?
- Selbstregulation: Welche Entscheidung wurde getroffen?
- Status: Stabil / Aktives Problem / In Besserung

## 4. Ergänzungsplan

Tageszeit, Präparat, Zweck

## 5. Offene Punkte

- [ ] Was muss beim nächsten Arztbesuch geklärt werden?
- [ ] Was muss beobachtet werden?
- [ ] Was fehlt noch an Informationen?

## 6. Versionshistorie

Datum, Änderung, Quelle
```

### Beobachtungsmodell

Jede gesundheitliche Beobachtung in Phylax hat drei Facetten:

- **Beobachtung (Fakt)**: Was ist konkret passiert? Was zeigen die Daten?
- **Muster (Verlauf)**: Was wiederholt sich - zeitlich, situativ, körperlich?
- **Selbstregulation (Entscheidung)**: Welche Massnahme wurde als Konsequenz ergriffen?

Beobachtungen werden nach **Themen** gruppiert (z.B. "Schulter", "Ernährung", "Blutdruck"), nicht nach starren Kategorien. Ein Thema kann subjektive Beobachtungen, Laborwerte, Medikamentenkontext und Lebensstilfaktoren gleichzeitig enthalten.

Beispiel:

```
### Schulter
- Beobachtung: Schmerz tritt auf bei Banddrücken über Kopf.
  Auch beim Autofahren durch den Sicherheitsgurt (gleiche Seite).
- Muster: Nur unter Belastung; nie in Ruhe, nie nachts;
  immer dieselbe Seite. Gleiches Muster bereits Jahre zuvor
  bei einem anderen Fahrzeug beobachtet.
- Selbstregulation: Training angepasst, Rotatorenmanschette
  gezielt gekräftigt.
- Status: In Besserung
```

### Unsicherheitsmarker

Das Profil dokumentiert ehrlich, was es nicht weiss:

- `[unklar]` - Angabe ist unvollständig oder mehrdeutig
- `[nachfragen]` - Beim nächsten Arztbesuch klären
- `[nächste Kontrolle]` - Wert muss erneut geprüft werden
- `[nur Angehörigen-Perspektive]` - Information stammt vom Stellvertreter, nicht ärztlich bestätigt

## KI als Strukturierungspartner

Die KI in Phylax ist der **primäre Eingabeweg** für die Profilerstellung. Der Nutzer bringt Fragmente mit (Laborbefunde, Medikamentenfotos, mündliche Beobachtungen), und die KI strukturiert sie in das Profilformat.

### Workflow

1. Nutzer hinterlegt seinen eigenen API-Key bei einem Anbieter seiner Wahl (Anthropic, OpenAI, Google, Mistral, oder lokale Modelle via LM Studio / Ollama / ein eigenes OpenAI-kompatibles Endpoint, siehe ADR-0019), verschlüsselt gespeichert
2. Nutzer startet eine geführte Profilsitzung
3. Die KI folgt dem **Prompt-Vertrag**: sie fragt, strukturiert, markiert Unsicherheiten
4. Chat-Nachrichten sind **ephemeral** - sie werden nicht von Phylax gespeichert
5. Am Ende produziert die KI ein strukturiertes Markdown-Profil-Fragment
6. Der Nutzer prüft das Ergebnis und übernimmt es in sein Profil
7. Das Profil wird versioniert (1.0, 1.1, 1.2...)

### Prompt-Vertrag

Der Prompt definiert einen Vertrag zwischen Mensch und Werkzeug:

- Die KI stellt keine Diagnosen
- Die KI interpretiert nicht - sie strukturiert
- Die KI fragt nach, wenn Angaben unklar oder unvollständig sind
- Die KI markiert Unsicherheiten mit `[unklar]` oder `[nachfragen]`
- Die KI benennt offene Punkte ehrlich
- Für jeden Bereich: Trennung zwischen Beobachtung, Muster und Selbstregulation

Der vollständige Prompt ist in der Artikelserie dokumentiert (Teil 1: Eigenprofil, Teil 4: Stellvertreterprofil mit KI).

### Fünf Funktionen der KI (keine davon diagnostisch)

1. **Strukturierung**: Aus Chaos wird Ordnung (Laborfoto wird Tabelle)
2. **Kontextualisierung**: Einzelwerte werden in Zusammenhänge gesetzt
3. **Wissenszugang**: Medikamentennamen, Referenzbereiche, Wechselwirkungen
4. **Lückenerkennung**: Was fehlt? Was sollte beim nächsten Termin gefragt werden?
5. **Dokumentenerstellung**: Strukturiertes Markdown-Profil als Ergebnis

### Fallback-Modi

Nutzer, die keine KI verwenden möchten (oder können), haben zwei Wege:

- **Manueller Modus**: Formularbasierte Eingabe von Beobachtungen, Laborwerten und offenen Punkten
- **Paste-in-Modus**: Nutzer führt eine KI-Sitzung extern (ChatGPT, Claude App) und fügt das resultierende Markdown in Phylax ein

## Stellvertreterprofil

Phylax unterstützt strukturell das Führen eines Profils für eine andere Person (Stellvertreterprofil). Anwendungsfälle: ältere Eltern mit Demenz, Kinder, Menschen mit geistiger Einschränkung.

Im MVP wird genau ein Profil pro Installation unterstützt. Das Datenmodell enthält von Anfang an ein `profileId`-Feld, damit Multi-Profil-Unterstützung später ohne Schema-Migration möglich ist.

Die vier Säulen der lebenden Gesundheit verschieben sich beim Stellvertreterprofil:

| Säule                  | Eigenprofil                           | Stellvertreterprofil                                                   |
| ---------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| Verlaufskompetenz      | Ich kenne meine Muster                | Ich beobachte die Muster eines anderen                                 |
| Kontextkontrolle       | Ich bringe meine Geschichte mit       | Ich rekonstruiere die Geschichte aus Fragmenten                        |
| Datenhoheit            | Ich entscheide, was dokumentiert wird | Ich entscheide stellvertretend, mit Verantwortung                      |
| Augenhöhe mit dem Arzt | Ich spreche für mich                  | Ich spreche für jemanden und muss beides können: zuhören und vertreten |

## Tech-Stack

- **Frontend**: React 19 (siehe ADR-0021), TypeScript, Vite
- **Storage**: IndexedDB via Dexie.js
- **Verschlüsselung**: Web Crypto API (AES-256-GCM), PBKDF2 für Key-Derivation (1.200.000 Iterationen, siehe ADR-0001); atomare Re-Encryption beim Master-Passwort-Wechsel (siehe ADR-0018)
- **Styling**: Tailwind CSS
- **PDF-Export**: jsPDF + jspdf-autotable (siehe ADR-0020)
- **PDF-Import**: pdfjs-dist (siehe ADR-0017)
- **PWA**: vite-plugin-pwa (Workbox)
- **Testing**: Vitest, Playwright (E2E)
- **i18n**: i18next (DE/EN im MVP, später ES/FR/EL)
- **KI-Integration**: Über API-Key des Nutzers, Multi-Provider (Anthropic, OpenAI, Google, Mistral, LM Studio, Ollama, custom OpenAI-kompatibel) per ADR-0019. Kein eigener Backend-Service

## Sicherheitsmodell

### Key-Derivation

1. Nutzer setzt Master-Passwort beim ersten Start
2. Zufälliges Salt (32 Bytes) wird in IndexedDB gespeichert
3. PBKDF2 mit 1.200.000 Iterationen leitet 256-Bit-Key ab (ADR-0001)
4. Key lebt nur im Session-Memory, nie auf Disk
5. Auto-Lock nach konfigurierbarer Inaktivität (Default 5 Minuten)

### Verschlüsselung

- AES-256-GCM pro Datensatz
- Eindeutige IV (12 Bytes) pro Record
- Authentication Tag schützt vor Manipulation
- Dokumente (PDF/Bilder) werden als verschlüsselte Blobs gespeichert
- API-Keys werden verschlüsselt gespeichert (gleicher Mechanismus wie Profildaten)

### Master-Passwort-Wechsel (P-06, ADR-0018)

- Re-Encryption ist atomar: alle Datensätze werden mit dem neuen Schlüssel neu verschlüsselt, bevor der alte Schlüssel aus dem Speicher entfernt wird.
- Bei einem Fehler während der Re-Encryption bleibt der alte Schlüssel aktiv und der vorherige Zustand erhalten; es gibt keinen halb-migrierten Zwischenzustand.
- Der In-Memory-Schlüssel-Wechsel ist eng begrenzt; alte Schlüsselbytes werden nicht logged und nicht persistiert.

### Threat Model

- **Schützt vor**: Diebstahl des Geräts (bei gesperrter App), neugierige Dritte, Cloud-Breaches (weil keine Cloud), Telemetrie-Leaks (weil keine Telemetrie)
- **Schützt nicht vor**: Keylogger auf dem Gerät, kompromittiertes Betriebssystem, schwaches Master-Passwort, physischer Zwang, Browser-Exploits

### KI-Sicherheit

- API-Calls gehen direkt vom Browser des Nutzers zum KI-Anbieter. Kein Zwischenserver.
- Chat-Nachrichten werden nicht in Phylax gespeichert. Nur das vom Nutzer bestätigte Profil-Fragment wird persistiert.
- Der API-Key verlässt das Gerät nur in verschlüsselten HTTPS-Requests an den gewählten Anbieter.
- Der Nutzer kann den API-Key jederzeit löschen und die KI-Funktion deaktivieren.

### KI-Anbieterwahl (AIP-01..05, ADR-0019)

Phylax unterstützt mehrere KI-Anbieter; jeder hat seine eigene Retentions- und Trainings-Policy:

- **Anthropic**: 30 Tage Retention für Safety-Review, anschliessend Auto-Delete; keine Trainingsverwendung.
- **OpenAI / Google / Mistral**: jeweils eigene Policies; im Wizard wird die anbieterspezifische Hinweistexte angezeigt, bevor der Nutzer den Anbieter aktiviert.
- **LM Studio / Ollama**: lokale Inferenz; Daten verlassen das Gerät nicht.
- **Custom OpenAI-kompatibles Endpoint**: der Nutzer trägt selbst Verantwortung für die Wahl des Endpoints.

Threat-Model-Delta: jeder API-Key gehört dem Nutzer, nicht Phylax. Die Wahl des Anbieters verlagert das Vertrauensziel; der Nutzer muss pro Anbieter selbst entscheiden, welche Inhalte er in den Chat überträgt.

## Datenmodell

Das Datenmodell orientiert sich an der Profilstruktur:

- **profiles**: Basisdaten (Name, Alter, Diagnosen, Medikamente, Einschränkungen), profileId, Typ (eigen/stellvertretend)
- **observations**: Beobachtungen mit Fakt/Muster/Selbstregulation, gruppiert nach Thema, verknüpft mit profileId
- **lab_values**: Blutwerte mit Datum, Parameter, Ergebnis, Referenzbereich, Bewertung, verknüpft mit profileId
- **supplements**: Ergänzungsplan mit Tageszeit, Präparat, Zweck, verknüpft mit profileId
- **open_points**: Offene Punkte als Checkliste, verknüpft mit profileId
- **profile_versions**: Versionshistorie mit Datum, Änderung, Quelle
- **documents**: Name, MIME-Type, verschlüsselter Blob, verknüpft mit profileId und optional mit Beobachtungen
- **meta**: Salt, Settings, Schema-Version, verschlüsselter API-Key

Alle Datensätze (ausser meta) tragen ein `profileId`-Feld. Im MVP existiert genau ein Profil.

## Phasenplan

| Phase       | Scope                | Deliverable                                                                                                                                                                                                   |
| ----------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1           | Foundation           | Vite-Setup, PWA-Config, Dexie-Schema, Crypto-Layer, Master-Passwort-Flow, Auto-Lock                                                                                                                           |
| 2           | Profil               | Profilstruktur, Beobachtungs-CRUD nach Themen, Profil-Versionierung, Markdown-Rendering                                                                                                                       |
| 3           | KI-gestützte Eingabe | API-Key-Verwaltung (verschlüsselt), Prompt-Vertrag, geführte Sitzung, Paste-in-Modus                                                                                                                          |
| 4           | Dokumente            | Upload (PDF/Bild), verschlüsselte Blob-Speicherung, Viewer, Verknüpfung mit Profilbereichen                                                                                                                   |
| 4b          | ePA-Import           | Manueller Import von Krankenkassen-App-Exports, Bildern, PDFs; AI-gestützte Klassifikation und Extraktion in das lebende Profil                                                                               |
| 5           | Export               | PDF-/Markdown-Export des Profils, CSV-Export der Laborwerte, Datumsbereich-Filter                                                                                                                             |
| 6           | Backup               | Verschlüsselte Backup-Datei, Restore-Import                                                                                                                                                                   |
| 7           | Polish               | Manual-Edit Polish, Search (P-22), Error Boundary (P-09), Change Master Password (P-06), Mobile-First Sweep, Dark Mode, Accessibility (Onboarding ist als Phase ONB ausgegliedert; i18n DE/EN als I18N-Serie) |
| 8 (Zukunft) | Multi-Profil         | Stellvertreterprofil-Unterstützung, Profil-Wechsel                                                                                                                                                            |

## Nicht-Ziele (explizit)

- Keine Synchronisation zwischen Geräten im MVP
- Keine Benutzer-Accounts
- Keine Cloud
- Kein eigener Backend-Service (KI-Calls gehen direkt zum Anbieter)
- Keine Diagnosefunktion
- Keine Telemedizin-Integration
- Keine Wearable-Integration im MVP
- Keine direkte ePA-API-Integration (Datenfluss via Phase 4b: manueller Export aus der Kassen-App, AI-gestützte Klassifikation)
- Multi-Profil nicht im MVP (aber Datenmodell vorbereitet)

## Lizenz und Distribution

- MIT-Lizenz, Open Source auf GitHub
- Hosted als statische Seite (GitHub Pages oder Cloudflare Pages)
- Installation als PWA via Browser
