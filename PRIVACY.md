# Ausgehende Verbindungen und lokale Speicherung

Dieses Dokument listet vollstaendig, was Befaro unter welchen
Umstaenden an Dritte sendet oder lokal auf dem Geraet speichert. Es ist
die technische Grundlage fuer die in-App-Datenschutzerklaerung unter
`/datenschutz` und ersetzt keine Rechtsberatung. Stand: 2026-09-16
(siehe auch [`docs/audits/external-resources-2026-09-16.md`](docs/audits/external-resources-2026-09-16.md)
fuer die zugrunde liegende technische Bestandsaufnahme).

Kurzfassung: Befaro hat keinen eigenen Server. Es gibt genau zwei
Kategorien ausgehender Verbindungen, beide unten dokumentiert, und
beide entweder unvermeidbarer Teil des Hostings oder ausschliesslich
durch eine bewusste Nutzeraktion ausgeloest. Es gibt keine Cookies,
kein Tracking, keine Analytics.

## 1. KI-Provider (nur bei aktiver Nutzung)

**Ausloeser:** Der Nutzer richtet in den Einstellungen einen
KI-Provider mit eigenem API-Key ein und startet danach explizit einen
Chat oder eine Import-Analyse. Ohne diese zwei Schritte findet **kein**
Request statt.

**Inhalt:** Die Chat-Nachrichten, die der Nutzer im Moment der Anfrage
eingibt, plus ein System-Prompt. Kein automatischer Zugriff auf
gespeicherte Gesundheitsdaten (Beobachtungen, Laborwerte, Ergaenzungen,
offene Punkte) ausser der Nutzer fuegt sie manuell in den Chat ein oder
laedt explizit ein Dokument zur Analyse hoch.

**Empfaenger:** abhaengig vom in den Einstellungen gewaehlten Provider
(`src/features/ai/providers.ts`):

| Provider           | Endpoint                                                      |
| ------------------ | ------------------------------------------------------------- |
| Anthropic (Claude) | `api.anthropic.com`                                           |
| OpenAI (GPT)       | `api.openai.com` (Browser-CORS blockiert echte Calls aktuell) |
| Google (Gemini)    | `generativelanguage.googleapis.com`                           |
| Mistral            | `api.mistral.ai` (Browser-CORS blockiert echte Calls aktuell) |
| LM Studio / Ollama | `localhost` (lokaler Server, verlaesst das Geraet nie)        |
| Benutzerdefiniert  | vom Nutzer selbst eingetragene URL                            |

**Abschaltbar:** Ja, vollstaendig. Ohne konfigurierten API-Key
funktioniert die App ohne jede KI-Funktion, alle anderen Features
bleiben nutzbar.

**Persistenz:** Chat-Nachrichten werden **nicht** gespeichert (siehe
`.claude/rules/architecture.md`, "Chat messages from AI sessions are
ephemeral"). Nur vom Nutzer explizit bestaetigte Profil-Fragmente
landen verschluesselt in der lokalen Datenbank.

## 2. GitHub Pages Hosting (bei jedem Seitenaufruf)

**Ausloeser:** Automatisch bei jedem Aufruf von
`astrapi69.github.io/phylax/`, unabhaengig von einer App-Interaktion.
Dies ist der unvermeidbare technische Grundmechanismus jedes
Webseitenaufrufs.

**Inhalt:** IP-Adresse, User-Agent, angefragte URL, ueblicher
HTTP-Server-Log-Umfang. Befaro selbst sendet hierbei keine
zusaetzlichen Daten, das uebernimmt der Hoster auf HTTP-Ebene.

**Empfaenger:** GitHub (Microsoft), Drittland USA. Siehe
[GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

**Abschaltbar:** Nein, das ist der Preis des Hostings selbst. Es gibt
keine Alternative ohne einen Seitenaufruf.

## 3. Service Worker (Precache, kein externer Request)

Der Service Worker cached beim ersten Besuch alle Anwendungsdateien
(JS, CSS, HTML, Icons) fuer Offline-Betrieb. Das Precache-Manifest
enthaelt ausschliesslich relative, selbst gehostete Pfade, keine
externen URLs (verifiziert in
[`docs/audits/external-resources-2026-09-16.md`](docs/audits/external-resources-2026-09-16.md)
und automatisch abgesichert durch `make test-external-resources`).

## 4. Update-Checks

Es gibt keinen eigenen Versions-Check-Server. Der Browser prueft
periodisch, ob sich die Service-Worker-Datei auf derselben Origin
geaendert hat (Standard-PWA-Mechanismus des Browsers selbst, kein
Drittanbieter beteiligt). `registerType: 'prompt'` sorgt dafuer, dass
eine neue Version erst beim naechsten eigenstaendigen Reload aktiv
wird, kein automatischer Reload mitten in der Sitzung
(`vite.config.ts`, BUG-01).

## 5. Lokale Speicherung auf dem Geraet

| Speicherort                                | Inhalt                                                                                                                                                                                                                        | Loeschen                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| IndexedDB (`befaro`-DB)                    | Verschluesselte Gesundheitsdaten (Beobachtungen, Laborwerte, Ergaenzungen, offene Punkte, Dokumente, Profile), verschluesselt mit AES-256-GCM, Schluessel existiert nur im Arbeitsspeicher waehrend einer entsperrten Sitzung | Vollstaendiger Reset in den Einstellungen (Danger Zone), oder Browser-Daten fuer diese Seite loeschen     |
| localStorage (`phylax-`/`phylax.`-Praefix) | Einstellungen (Theme, Sprache, Auto-Lock-Dauer), Verification-Token, Backup-Format-Marker, Spenden-Erinnerungsstatus. Kein Klartext von Gesundheitsdaten.                                                                     | Reset-Funktion in den Einstellungen (iteriert alle `phylax-`/`phylax.`-Keys), oder Browser-Daten loeschen |
| Service Worker Cache                       | Anwendungsdateien fuer Offline-Betrieb (keine Nutzerdaten)                                                                                                                                                                    | Browser-Daten fuer diese Seite loeschen                                                                   |

Nichts davon verlaesst das Geraet automatisch. Es gibt keine
Server-Synchronisation.

## Zusammenfassung: automatisch vs. Nutzeraktion

| Verbindung                |                 Automatisch                 | Nur auf Aktion | Abschaltbar               |
| ------------------------- | :-----------------------------------------: | :------------: | ------------------------- |
| KI-Provider               |                    Nein                     |       Ja       | Ja (kein Key eintragen)   |
| GitHub Pages Seitenaufruf |                     Ja                      |       -        | Nein (Preis des Hostings) |
| Service Worker Precache   | Ja (selbst gehostet, kein externer Request) |       -        | n/a                       |
| Update-Check              |     Ja (Browser-intern, gleiche Origin)     |       -        | n/a                       |

## Fragen

Fragen zu diesem Dokument an aster.raptis@gmail.com (gleicher Kontakt
wie in [`SECURITY.md`](SECURITY.md)).
