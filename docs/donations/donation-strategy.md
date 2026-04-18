# Phylax Spenden-Strategie

## Grundprinzip

Phylax ist ein privates Gesundheits-Werkzeug. Spenden-Hinweise duerfen den Nutzer nicht stoeren, nicht manipulieren, nicht zwischen ihn und seine Daten stehen. Drei Sichtbarkeitsebenen, alle mit hartem Opt-Out-Weg und ohne Dark Patterns.

## Ebene 1: Permanenter Link in den Einstellungen

Neuer Abschnitt in Settings: **"Phylax unterstuetzen"**.

Inhalt:

- Zwei bis drei Saetze Projekt-Kontext (ein Entwickler, kein Tracking, kein Backend, keine Werbung)
- Link zu einer externen Spenden-Seite (siehe Kanal-Strategie unten)
- Keine Betraege vorgeschlagen, keine Ziele

Immer verfuegbar, nie aufdringlich. Benutzer finden es wenn sie danach suchen.

## Ebene 2: Einmaliger Onboarding-Hinweis

Nach Abschluss des ersten Profile-Creates oder nach dem ersten erfolgreichen Markdown-Import wird eine Info-Karte angezeigt:

```
Phylax wird als Open-Source-Projekt ohne Tracking, ohne Cloud,
ohne Werbung entwickelt. Wenn dir die App hilft und du das
Projekt unterstuetzen moechtest:

[Projekt unterstuetzen]   [Verstanden]

Du findest diesen Hinweis jederzeit in den Einstellungen.
```

Beim Klick auf "Verstanden": Flag `phylax-donation-onboarding-seen = true` in localStorage. Nie wieder angezeigt ausser explizit via Settings aufgerufen.

Beim Klick auf "Projekt unterstuetzen": oeffnet externen Link in neuem Tab UND setzt das Flag. Der Nutzer kommt nach einer Spende zurueck und wird nicht erneut gefragt.

## Ebene 3: Periodische Erinnerung (90-Tage-Zyklus)

Nach 90 Tagen aktiver Nutzung (gemessen ab erstem ProfileVersion-Eintrag) erscheint ein dezenter Banner oben im Profile-View:

```
+--------------------------------------------------------------+
| Du nutzt Phylax jetzt seit 3 Monaten. Wenn dir das Projekt   |
| gefaellt: [Unterstuetzen]           [Nicht jetzt]   [x]      |
+--------------------------------------------------------------+
```

Regeln:

- Nur auf der Profile-Startseite, nicht in anderen Views
- Nie waehrend eines Imports, Chats oder Onboarding-Flows
- "Nicht jetzt" oder "Schliessen" setzen den Counter um weitere 90 Tage zurueck
- "Unterstuetzen" oeffnet den Spenden-Link und setzt den Counter um 180 Tage zurueck (laenger, weil Nutzer schon engagiert ist)
- Kein Countdown, keine Dringlichkeit, keine Farb-Eskalation

## Anti-Patterns (explizit NICHT machen)

- Kein Modal-Popup beim App-Start
- Keine Nag-Screens mit Zaehlern ("Sie haben Phylax 47 Mal geoeffnet...")
- Keine Spenden-Prompts waehrend aktiver Workflows (Import, Chat, Commit)
- Keine animierten Banner oder auffaellige Farben
- Keine Countdown-Timer oder "limited time" Framing
- Kein Guilt-Tripping ("Ohne deine Spende muessen wir..." etc.)
- Keine Feature-Gates ("Spenden fuer dieses Feature")
- Keine Bewerbung im Chat, im Document-Viewer oder in Views mit Daten

## Technische Architektur

Alle Spenden-State-Flags lokal (localStorage oder IndexedDB):

```ts
interface DonationState {
  onboardingSeen: boolean; // Ebene 2, einmalig
  lastReminderDate: string | null; // Ebene 3, ISO-Datum
  lastReminderAction: 'donated' | 'dismissed' | null;
}
```

Kein Backend, kein Tracking, kein Analytics-Event beim Klick. Der Spenden-Link selbst fuehrt auf eine externe Seite (GitHub, Liberapay, eigene Landingpage).

## Spenden-Kanaele

Empfehlung: Eigene Landingpage als zentraler Einstiegspunkt, damit Kanaele ohne App-Update aenderbar sind.

Kandidaten fuer die Landingpage:

- GitHub Sponsors (entwickler-native Plattform, wiederkehrend moeglich)
- Liberapay (privacy-freundlich, FOSS-Community, wiederkehrend)
- Ko-fi (niedrige Huerde, einmalige Spenden)
- PayPal (hoechste Reichweite, einmalig + wiederkehrend)
- Direkte Bankverbindung (fuer deutsche Nutzer oft bevorzugt)

Mehrere Kanaele parallel anbieten. Nutzer entscheiden selbst. Keine Bevorzugung im App-Text.

## Implementation-Reihenfolge

Drei unabhaengige Tasks, klein genug fuer jeweils 20-45 Minuten:

**S-01**: Settings-Section "Phylax unterstuetzen" (Ebene 1)

- Neuer Abschnitt in SettingsScreen
- Kurzer Text + externer Link
- Kein State-Management noetig

**S-02**: Onboarding-Info-Karte (Ebene 2)

- Karte erscheint nach erstem erfolgreichen Profil-Create oder Import
- localStorage-Flag fuer "gesehen"
- Zwei Buttons: "Projekt unterstuetzen" (extern) + "Verstanden"

**S-03**: 90-Tage-Reminder-Banner (Ebene 3)

- Banner auf Profile-View
- Check auf Ablauf beim Mount des Profile-Views
- Drei Dismiss-Pfade (Spenden, Nicht-jetzt, Close)

Reihenfolge: S-01 zuerst (kleinster, keine State-Logik), dann S-02, dann S-03.

## Timing im Gesamt-Release

Spenden-Tasks kommen NACH Phase 3 Kern (AI-08 abgeschlossen) und VOR oeffentlichem Release. Die Reihenfolge:

1. AI-08b fertig (done)
2. Browser-Test AI-08b
3. Optional: AI-06 (Guided Session) oder AI-09 (Parser Fallback)
4. S-01, S-02, S-03 (Spenden-Integration)
5. Release-Vorbereitung (PWA-Icons, Manifest, README-Politur)
6. Public Release

## Erfolgsmetriken

Keine In-App-Analytics. Erfolg misst sich extern:

- Click-Through von App zu Landingpage (falls Hoster Zugriffe loggt)
- Spenden-Volumen ueber die Kanaele
- Issue-Tracker-Feedback, ob der Hinweis als stoerend empfunden wird

Wenn Nutzer sich ueber die Reminder beschweren: Ebene 3 entschaerfen (laengerer Zyklus, weniger sichtbarer Banner).

## Entscheidungen pending

Vor Implementierung der S-Serie zu klaeren:

1. **Landingpage-URL**: Eigene Domain (phylax.app/unterstuetzen) oder GitHub README Section oder beides?
2. **Erstes Set an Kanaelen**: Welche zwei bis drei starten als erste? (Vorschlag: GitHub Sponsors + Liberapay + Bank-Link)
3. **Sprache der Landingpage**: Nur Deutsch oder auch Englisch?
4. **Datum-Format fuer Reminder-Logik**: ISO-String oder Unix-Timestamp? (ISO lesbarer, Timestamp rechnerfreundlicher)
