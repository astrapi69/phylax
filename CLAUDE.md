# CLAUDE.md - Phylax

Dieses Dokument gibt Claude Code den Kontext für die Entwicklung von Phylax.

## Was ist Phylax

Phylax ist eine persönliche, datensouveräne Gesundheitsplattform als Progressive Web App, basierend auf dem Prinzip der lebenden Gesundheit. Der Nutzer erstellt und pflegt ein lebendes medizinisches Profil mit Beobachtungen (Fakt/Muster/Selbstregulation), Laborwerten, Ergänzungsplänen und offenen Punkten. Local-first, Zero-Knowledge, kein eigener Backend-Service. KI-gestützte Profilerstellung über API-Key des Nutzers. Siehe `docs/CONCEPT.md` für die vollständige Vision.

## Nicht-verhandelbare Prinzipien

1. **Kein Backend**: Jeder Vorschlag für einen Server wird abgelehnt. Phylax ist reine Browser-App.
2. **Keine eigenen externen Services**: Keine Fonts von Google, keine Analytics, keine CDN-Abhängigkeiten zur Laufzeit. Alles wird gebundled. Ausnahme: nutzerinitiierte KI-Requests mit eigenem API-Key des Nutzers an OpenAI/Anthropic.
3. **Verschlüsselung vor Persistierung**: Kein Klartext darf jemals in IndexedDB landen. Tests müssen das absichern.
4. **KI strukturiert, KI diagnostiziert nicht**: Die KI in Phylax ist ein Strukturierungspartner. Sie stellt keine Diagnosen, gibt keine Therapieempfehlungen und übernimmt keine klinische Verantwortung.
5. **Keine medizinische Beratung**: Kein Code, der Diagnosen stellt oder Empfehlungen gibt. UI-Disclaimer an relevanten Stellen.
6. **TypeScript strict mode**: `strict: true` in `tsconfig.json`, keine `any`-Types ohne explizite Begründung im Kommentar.
7. **Keine Formatierung mit Em-Dashes**: In UI-Texten, Dokumentation und Kommentaren nur Bindestriche oder Kommata, keine Em-Dashes.

## Tech-Stack (fix)

- React 18 + TypeScript + Vite
- Dexie.js für IndexedDB
- Web Crypto API (nativ, keine Crypto-Library)
- Tailwind CSS
- jsPDF für PDF-Export
- vite-plugin-pwa
- Vitest für Unit-Tests
- Playwright für E2E
- i18next für i18n

Keine weiteren Dependencies ohne Rücksprache. Jede neue Dependency erhöht die Angriffsfläche.

## Projektstruktur

```
phylax/
├── docs/
│   ├── CONCEPT.md
│   └── ROADMAP.md
├── public/
│   └── icons/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── crypto/           # Web Crypto Wrapper, Key-Derivation
│   ├── db/               # Dexie-Schema, Repositories
│   ├── domain/           # Reine Geschäftslogik (Typen, Validierung)
│   ├── features/         # React Features (profile, ai-input, documents, export, backup, settings)
│   ├── ui/               # Shared UI-Komponenten
│   ├── i18n/             # Übersetzungen (de, en)
│   └── lib/              # Utilities
├── tests/
│   ├── unit/
│   └── e2e/
├── .claude/
│   └── rules/
├── CLAUDE.md
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

## Entwicklungsregeln

### Crypto-Layer

- Ein einziges Modul `src/crypto/` ist für alle Verschlüsselung zuständig
- Kein Aufruf von `crypto.subtle` ausserhalb dieses Moduls
- Tests prüfen Round-Trip (encrypt dann decrypt ergibt Original) und dass falsche Keys fehlschlagen
- PBKDF2-Iterationen als Konstante definiert, Default 600.000

### Datenbank-Layer

- Alle DB-Zugriffe via Repository-Pattern in `src/db/`
- Kein direkter Dexie-Aufruf aus UI-Komponenten
- Repositories nehmen Klartext-Objekte entgegen und verschlüsseln intern vor `put`
- Bei `get` wird intern entschlüsselt und Klartext zurückgegeben
- Schema-Migrationen sind dokumentiert und getestet

### UI-Komponenten

- Funktionale Komponenten mit Hooks
- Kein Redux, React-Context reicht für globalen State (Auth, Theme, i18n)
- Tailwind-Utility-Classes, keine eigenen CSS-Dateien ausser `index.css`
- Mobile-First: jede Komponente muss auf 360px Breite funktionieren
- Dark Mode via Tailwind `dark:`-Variante

### Testing

- Jedes Crypto-Modul hat Unit-Tests
- Jedes Repository hat Unit-Tests mit Fake-IndexedDB
- E2E-Tests decken kritische Flows ab: Onboarding, Beobachtung erstellen, Auto-Lock, Backup/Restore
- Mindestens 80 Prozent Coverage im `crypto/`- und `db/`-Modul

### Commits und Tasks

- Jede Phase hat eigene Tasks mit Prefix-ID: F (Foundation), O (Observations/Profile), AI (KI-gestützte Eingabe), D (Document), X (Export), B (Backup), P (Polish), M (Multi-Profile)
- Beispiel: F-01 Vite-Setup, F-02 PWA-Config, O-01 Domain-Types
- Ein Commit pro Task, Commit-Message enthält Task-ID

## Was Claude Code nicht tun soll

- Keine neuen Dependencies ohne explizite Zustimmung hinzufügen
- Keine Cloud-Services integrieren
- Kein Code, der Klartext-Daten ausserhalb des Crypto-Moduls in die DB schreibt
- Keine medizinischen Empfehlungen in UI-Texten oder Kommentaren
- Keine Telemetrie, keine Error-Reporting-Dienste wie Sentry
- Keine Em-Dashes in Code-Kommentaren oder UI-Strings
- Keine Zusammenfassungen oder Interpretationen von Gesundheitsdaten durch Heuristiken

## Was Claude Code aktiv tun soll

- Bei Unklarheiten zur Architektur nachfragen, bevor geraten wird
- Security-relevante Entscheidungen explizit begründen
- Edge Cases auflisten, bevor implementiert wird
- Tests vor oder parallel zur Implementierung schreiben
- Bei jedem neuen Profilbereich prüfen: wird Klartext jemals ohne Verschlüsselung persistiert
- Bei KI-Features prüfen: Chat-Nachrichten dürfen nicht persistiert werden, nur bestätigte Profil-Fragmente

## Referenzprojekte des Entwicklers

- Bibliogon: github.com/astrapi69/bibliogon (Architektur-Patterns, Phasenstruktur)
- PluginForge: github.com/astrapi69/pluginforge (nicht genutzt in Phylax, aber bekannt)

## Sprache

- Code, Kommentare, Commit-Messages: Englisch
- Dokumentation in `docs/`: Deutsch
- UI-Strings: via i18next, initial DE und EN
