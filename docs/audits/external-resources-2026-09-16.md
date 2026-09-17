# External-Resource Audit

**Audit date:** 2026-09-16

## Auftrag

Bestandsaufnahme aller externen Hosts, die das gebaute Pages-Artefakt
(`dist/`, GitHub Pages, `base: /phylax/`) referenziert. Ziel: jede
ungewollte Ressource, die die IP des Besuchers ungefragt an Dritte
weitergibt, finden und entweder lokal ausliefern oder mit schriftlicher
Begruendung auf eine Allowlist setzen. Hintergrund und laufende
Absicherung dieser Recherche: [I-11](../ROADMAP.md), Guard-Skript
[`scripts/audit-external-resources.mjs`](../../scripts/audit-external-resources.mjs),
`make test-external-resources`.

**Nachtrag (gleicher Tag, P-16):** Die neue `DatenschutzView` verlinkt
auf das GitHub Privacy Statement (`docs.github.com`, `target="_blank"`,
reiner Klick-Link). Der Guard hat diesen neuen Host korrekt als
ungewollt markiert, bis er mit Begruendung in die Allowlist
aufgenommen wurde, siehe Tabelle unten. Das ist der Guard bei der
Arbeit, kein nachtraeglich unbemerkter Fund.

## Methodik

1. `make build` (production mode, `base: /phylax/`).
2. `grep -oE 'https?://[a-zA-Z0-9.-]+' dist/assets/*.js dist/index.html dist/sw.js`
   auf alle Host-Vorkommen im kompilierten Artefakt (inklusive Service
   Worker und Precache-Manifest).
3. Jeden gefundenen Host im Quellcode zurueckverfolgt: wo steht der
   String, wann wird er tatsaechlich als Netzwerk-Request ausgeloest
   (nicht nur als Text/Namespace-URI/Fehlermeldung gebuendelt).
4. `dist/sw.js`-Precache-Manifest (`precacheAndRoute([...])`) separat
   geprueft: alle 73 Eintraege sind relative Pfade, kein externer Host.
   `registerRoute` erscheint genau einmal (die SPA-`navigateFallback`-
   Route, keine externe Runtime-Caching-Route). Bestaetigt die
   Projekt-Invariante aus `vite.config.ts` ("No runtime caching: Befaro
   has no external resources").

## Ergebnis: Host-Tabelle

| Host                                   | Zweck                                                                                               | Ausgeloest bei                                                                     | Vermeidbar                                               |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `astrapi69.github.io`                  | Eigene Domain (canonical/OG/JSON-LD)                                                                | Immer (Metadaten, kein Request)                                                    | n/a (eigen)                                              |
| `api.anthropic.com`                    | AI-Provider-Preset (Anthropic)                                                                      | Nutzer konfiguriert Provider + sendet Chat mit eigenem Key                         | Nein (ADR-0019, nutzerinitiiert)                         |
| `api.openai.com`                       | AI-Provider-Preset (OpenAI)                                                                         | Nur Config; echter Call scheitert an Browser-CORS (`corsHint: 'blocked'`)          | Nein, faktisch nie erreicht                              |
| `api.mistral.ai`                       | AI-Provider-Preset (Mistral)                                                                        | Wie OpenAI, CORS-blockiert                                                         | Nein, faktisch nie erreicht                              |
| `generativelanguage.googleapis.com`    | AI-Provider-Preset (Google Gemini)                                                                  | Nutzer konfiguriert Provider + sendet Chat mit eigenem Key                         | Nein (nutzerinitiiert)                                   |
| `localhost` (Port 1234/11434)          | LM Studio / Ollama (lokaler Server)                                                                 | Nutzer konfiguriert lokalen Provider                                               | n/a (verlaesst Geraet nie)                               |
| `privacy.claude.com`                   | Link auf Anthropics Datenschutzerklaerung                                                           | Klick auf Link in `AIDisclaimer.tsx` / `PrivacyInfoContent.tsx`, `target="_blank"` | Nein (reiner Outbound-Link, kein Ressourcen-Ladevorgang) |
| `github.com`                           | Spendenlink (`DONATE.md`) + Text in gebuendelten Fehlermeldungen (react-router, Dexie-Dependencies) | Klick auf Spendenlink; sonst nur Text, kein Request                                | Nein (Link)                                              |
| `docs.github.com`                      | Link auf das GitHub Privacy Statement (Datenschutz-Seite, P-16)                                     | Klick auf Link in `DatenschutzView.tsx`, `target="_blank"`                         | Nein (reiner Outbound-Link, kein Ressourcen-Ladevorgang) |
| `openai.com`                           | Link auf OpenAIs eigene Datenschutzerklaerung (Datenschutz-Seite, P-16)                             | Klick auf Link in `DatenschutzView.tsx`, `target="_blank"`                         | Nein (reiner Outbound-Link, kein Ressourcen-Ladevorgang) |
| `policies.google.com`                  | Link auf Googles eigene Datenschutzerklaerung (Datenschutz-Seite, P-16)                             | Klick auf Link in `DatenschutzView.tsx`, `target="_blank"`                         | Nein (reiner Outbound-Link, kein Ressourcen-Ladevorgang) |
| `mistral.ai`                           | Link auf Mistrals eigene Datenschutzerklaerung (Datenschutz-Seite, P-16)                            | Klick auf Link in `DatenschutzView.tsx`, `target="_blank"`                         | Nein (reiner Outbound-Link, kein Ressourcen-Ladevorgang) |
| `react.dev`, `reactrouter.com`         | Warnhinweistexte in React/React-Router-Dev-Ausgaben                                                 | Nie als Request, nur String im Bundle                                              | n/a (inert)                                              |
| `bit.ly`, `tinyurl.com`                | Troubleshooting-Links in Dexie-Fehlermeldungen                                                      | Nie als Request, nur String im Bundle                                              | n/a (inert)                                              |
| `cdnjs.cloudflare.com`                 | jsPDF-interner PDFObject-Fallback fuer `doc.output('...newwindow')`                                 | Nie: Befaro ruft ausschliesslich `doc.output('blob')` (`pdfExport.ts:243`)         | n/a (toter Codepfad in Befaro)                           |
| `ns.adobe.com`, `www.xfa.org`          | XML-Namespace-URI im XFA-Parser von pdf.js                                                          | Nie als Request, String-Vergleich (`===`/`startsWith`)                             | n/a (inert)                                              |
| `jspdf.default.namespaceuri`           | jsPDF-interner Platzhalter-String                                                                   | Nie aufloesbar, kein echter Host                                                   | n/a (inert)                                              |
| `example.com`, `foo.bar`               | Platzhalter-Strings in gebuendelten Libraries                                                       | Nie als Request                                                                    | n/a (inert)                                              |
| `schema.org`, `www.w3.org`, `spdx.org` | URI-Identifier in JSON-LD/XML-Namespaces                                                            | Nie als Request (Identifier, kein Fetch)                                           | n/a (inert)                                              |

Vollstaendige, maschinenlesbare Fassung inklusive Begruendung je Host:
[`scripts/audit-external-resources.mjs`](../../scripts/audit-external-resources.mjs)
(`ALLOWLIST`-Konstante).

## Keine Google Fonts, kein CDN, kein Tracking

- `index.html` laedt keine externen Fonts (kein `fonts.googleapis.com`,
  kein `fonts.gstatic.com`), keine externen Scripts, keine
  Analytics-Snippets.
- Alle Icons, Fonts (Tailwind-Systemfont-Stack, keine Web-Fonts) und
  Assets sind lokal gebuendelt.
- `pdfjs-dist`-Worker wird ueber einen gebuendelten Vite-Worker-Import
  (`?worker`) geladen (`preparePdf.ts:160f`), nicht ueber eine
  CDN-URL.

## Guard-Test

`scripts/audit-external-resources.mjs` scannt `dist/**/*.{js,html,json}`
nach `https?://`-Hosts und schlaegt fehl (Exit 1), sobald ein Host
auftaucht, der nicht in der `ALLOWLIST`-Konstante steht (mit
Begruendung). `make test-external-resources` baut und prueft in einem
Schritt; der CI-Workflow (`.github/workflows/ci.yml`, Job `build`)
fuehrt denselben Check nach jedem Build aus. Unit-Tests fuer die reine
Matching-Logik: `scripts/audit-external-resources.test.mjs`.

## Fazit

Keine unerwuenschte Drittanbieter-Ressource im aktuellen Build. Alle
externen Hosts sind entweder inerte Strings in gebuendeltem
Drittanbieter-Code, die eigene Domain, oder nutzerinitiierte
KI-Provider-Calls mit dem eigenen API-Key des Nutzers (ADR-0019),
gedeckt durch die bestehende Non-Goals-Regel in
`.claude/rules/architecture.md`. Punkt 1 des Auftrags ergibt **keinen**
Befund, der einen Cookie-Banner oder eine Einwilligung erfordern
wuerde.
