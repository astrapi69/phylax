# Phylax - Konzept

## Vision

Phylax (griechisch φύλαξ, "Wächter") ist eine persönliche, datensouveräne Gesundheitsakte als Progressive Web App. Alle Daten bleiben lokal auf dem Gerät des Nutzers, verschlüsselt mit einem Master-Passwort. Kein Backend, keine Cloud, keine Telemetrie, keine Datensammlung.

Die App dient dem Nutzer als strukturiertes Krankentagebuch, Medikationsmanager und Dokumentenarchiv für Arztbesuche - vergleichbar mit einem Passwort-Manager, aber für Gesundheitsdaten.

## Kernprinzipien

1. **Local-first**: Alle Daten liegen ausschliesslich im Browser des Nutzers (IndexedDB).
2. **Zero-Knowledge**: Daten werden vor dem Schreiben verschlüsselt. Ohne Master-Passwort sind sie unlesbar.
3. **Kein Backend**: Keine Server, keine APIs, keine Accounts. Nur HTML, JS, CSS.
4. **Offline-fähig**: Funktioniert vollständig ohne Internetverbindung (PWA mit Service Worker).
5. **Keine medizinische Beratung**: Phylax ist ein Dokumentationstool, kein Medizinprodukt. Keine Diagnosen, keine Empfehlungen.
6. **Keine Abhängigkeiten zu Drittanbietern**: Im MVP kein externer API-Call, kein Analytics, keine Fonts von CDN.

## Zielgruppe

- Menschen mit chronischen Erkrankungen, die ein strukturiertes Tagebuch führen wollen
- Patienten, die ihre Unterlagen für Arztbesuche aufbereiten möchten
- Datenschutzbewusste Nutzer, die keiner Cloud-Lösung vertrauen

## Abgrenzung zu bestehenden Lösungen

| Lösung | Unterschied zu Phylax |
|--------|----------------------|
| ePA (Deutschland) | Zentral gespeichert bei Krankenkasse, kein KI-Assistent, kein freies Krankentagebuch |
| Apple Health | iOS-only, kein Export für Ärzte, Fokus Fitness |
| Ada Health | Symptom-Checker, keine persönliche Akte |
| MediVault | Cloud-basiert, kein Zero-Knowledge |

## Tech-Stack

- **Frontend**: React 18, TypeScript, Vite
- **Storage**: IndexedDB via Dexie.js
- **Verschlüsselung**: Web Crypto API (AES-256-GCM), PBKDF2 für Key-Derivation (mindestens 600.000 Iterationen)
- **Styling**: Tailwind CSS
- **PDF-Export**: jsPDF
- **PWA**: vite-plugin-pwa (Workbox)
- **Testing**: Vitest, Playwright (E2E)
- **i18n**: i18next (DE/EN im MVP, später ES/FR/EL)

## Sicherheitsmodell

### Key-Derivation
1. Nutzer setzt Master-Passwort beim ersten Start
2. Zufälliges Salt (32 Bytes) wird in IndexedDB gespeichert
3. PBKDF2 mit 600.000 Iterationen leitet 256-Bit-Key ab
4. Key lebt nur im Session-Memory, nie auf Disk
5. Auto-Lock nach konfigurierbarer Inaktivität (Default 5 Minuten)

### Verschlüsselung
- AES-256-GCM pro Datensatz
- Eindeutige IV (12 Bytes) pro Record
- Authentication Tag schützt vor Manipulation
- Dokumente (PDF/Bilder) werden als verschlüsselte Blobs gespeichert

### Threat Model
- **Schützt vor**: Diebstahl des Geräts (bei gesperrter App), neugierige Dritte, Cloud-Breaches (weil keine Cloud)
- **Schützt nicht vor**: Keylogger auf dem Gerät, kompromittiertes Betriebssystem, schwaches Master-Passwort, physischer Zwang

## Datenmodell

Fünf Entry-Typen in generischer `entries`-Tabelle:

- **symptom**: Beschreibung, Intensität 1-10, Körperregion, Start-/Enddatum
- **medication**: Name, Dosis, Frequenz, Start-/Enddatum, Notizen
- **vital**: Typ (Blutdruck, Puls, Temperatur, Gewicht, Blutzucker, SpO2), Wert, Einheit, Zeitpunkt
- **appointment**: Arzt/Praxis, Fachrichtung, Datum, Anlass, Ergebnis, Notizen
- **note**: Freitext mit Tags für alles andere

Separate `documents`-Tabelle: Name, MIME-Type, verschlüsselter Blob, verknüpfte Entry-IDs.

## Phasenplan

| Phase | Scope | Deliverable |
|-------|-------|-------------|
| 1 | Foundation | Vite-Setup, PWA-Config, Dexie-Schema, Crypto-Layer, Master-Passwort-Flow, Auto-Lock |
| 2 | Kernfunktion | CRUD für alle 5 Entry-Typen, Listenansicht, Suche, Filter, Detail-View |
| 3 | Dokumente | Upload (PDF/Bild), verschlüsselte Blob-Speicherung, Viewer, Verknüpfung mit Entries |
| 4 | Export | PDF-Report für Arztbesuch, CSV-Export, Datumsbereich-Filter |
| 5 | Backup | Verschlüsselte Backup-Datei, Restore-Import, optionale Seed-Phrase |
| 6 | Polish | Mobile-First Responsive, Onboarding, i18n DE/EN, Dark Mode |
| 7 (optional) | KI-Assistent | Strukturierter Symptom-Erfassungs-Chat, eigener API-Key des Nutzers, klare Nicht-Diagnose-Disclaimer |

## Nicht-Ziele (explizit)

- Keine Synchronisation zwischen Geräten im MVP
- Keine Benutzer-Accounts
- Keine Cloud
- Kein Multi-User auf einem Gerät
- Keine Diagnosefunktion
- Keine Telemedizin-Integration
- Keine Wearable-Integration im MVP
- Keine ePA-Anbindung im MVP

## Lizenz und Distribution

- MIT-Lizenz, Open Source auf GitHub
- Hosted als statische Seite (GitHub Pages oder Cloudflare Pages)
- Installation als PWA via Browser
