# PR CI Shepherding

Diese Regel legt fest, wie der Agent eine selbst geoeffnete Pull-Request
bis zum Ende begleitet: CI beobachten, bei Rot die Ursache beheben, bei
Gruen mergen oder uebergeben, und in jedem Fall den Ausgang melden. Sie
sitzt auf `ADR-0024` (Gitflow, CI-Green-Gate, Squash-Default,
Docs-only-Auto-Merge in Decision-Punkt 7), `tdd.md` (Bug-Repro zuerst)
und `lessons-learned.md` (bekannte Flakes) auf.

## Geltungsbereich

Gilt, sobald der Agent eine PR geoeffnet hat und der Maintainer den
weiteren Verlauf nicht selbst uebernimmt. Der Maintainer kann jederzeit
eingreifen; diese Regel beschreibt das Default-Verhalten in Abwesenheit
einer gegenteiligen Anweisung.

## Ablauf

1. **CI beobachten.** Nach dem Push die Checks der PR verfolgen, bis alle
   einen Endzustand erreicht haben (kein `pending` / `in_progress` /
   `queued` mehr). Ein Hintergrund-Watcher, der bis zum Settle pollt, ist
   der Default, damit die Session nicht blockiert.

2. **Bei Gruen.** Wenn alle Checks gruen sind:
   - Docs-only-PR (siehe `ADR-0024` Decision-Punkt 7): selbst per Squash
     mergen und den Branch loeschen.
   - Jede andere PR: am gruenen Stand anhalten und dem Maintainer den
     Merge ueberlassen, sofern nicht ausdruecklich ein Auto-Merge
     freigegeben wurde.

3. **Bei Rot.** Den roten Check nicht ignorieren und nicht uebergehen.
   Ursache feststellen und automatisch beheben:
   - **Flake** (bekanntes instabiles Muster aus `lessons-learned.md`,
     Infra-/Netzwerk-Timeout, nicht-deterministischer E2E-Schritt ohne
     Bezug zum Diff): den betroffenen Job erneut anstossen. Bei
     wiederholtem Flake das Muster in `lessons-learned.md` festhalten,
     statt blind weiter zu re-runnen.
   - **Echter Defekt** (der Diff oder ein realer Bug bricht den Check):
     Root-Cause verstehen, dann auf demselben Branch fixen. Bei
     Verhaltensaenderungen gilt `tdd.md` (Repro-Test zuerst, dann Fix).
     Kein Fix ohne verstandene Ursache, kein Absenken eines Gates, um
     Gruen zu erzwingen.
   - Nach jedem Fix den Zyklus wiederholen (Schritt 1), bis die CI gruen
     ist.

4. **Melden.** Den Ausgang in jedem Fall berichten: bei Gruen die
   Merge-Bestaetigung, bei Rot das relevante Log und den vorgenommenen
   Fix, bei wiederholtem Flake den Re-Run plus den Eintrag in
   `lessons-learned.md`.

## Grenzen

- Das CI-Green-Gate aus `ADR-0024` wird nie umgangen, auch nicht durch
  `--no-verify`, das Lockern eines Coverage- oder Size-Gates oder das
  Ueberspringen einer Suite. Gruen heisst echt gruen.
- Ein Fix, der den Scope der urspruenglichen Aufgabe verlaesst (z. B. ein
  unabhaengiger, vorbestehender Bug taucht auf), wird gemeldet und nicht
  stillschweigend in dieselbe PR gezogen; bei Unklarheit nachfragen
  (`ai-workflow.md`, "How to handle ambiguity").
- Hotfix-Ausnahme und Branch-Namen folgen unveraendert `ADR-0024`.
