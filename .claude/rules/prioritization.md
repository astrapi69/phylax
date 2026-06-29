# Prioritization Workflow

Diese Regel legt fest, _wie_ offene Aufgaben konsolidiert und
priorisiert werden, wenn der Stand der Arbeit abgefragt wird. Sie sitzt
auf der Quellenkonvention von [`docs/BACKLOG.md`](../../docs/BACKLOG.md)
(Tier-Buckets, leverage-durch-effort) und
[`docs/ROADMAP.md`](../../docs/ROADMAP.md) (offene Items pro Phase /
Serie) auf und ergaenzt `ai-workflow.md` ("Interpreting continue / next
task") um das Bewertungsraster fuer ein vollstaendiges Audit.

## Wann anwenden

Bei Fragen, die nach dem Gesamtbild des Offenen verlangen, zum Beispiel:

- "Was steht offen?" / "Was ist noch zu tun?"
- "Was kommt als naechstes?" / "weiter" / "next task"
- "Priorisiere die Aufgaben" / "Konsolidierte Liste"

Fuer ein simples "continue" mit klarer Tier-1-Spitze reicht der
Kurzpfad aus `ai-workflow.md` (oberstes offenes Item nennen, auf
Bestaetigung warten). Die volle Konsolidierung unten gilt, sobald
explizit eine priorisierte Gesamtsicht oder eine Top-N-Empfehlung
verlangt wird.

## Quellen (alle lesen)

1. `docs/BACKLOG.md` - Tier 1, 2, 3 (und Tier 4 / Carry-overs) vollstaendig.
2. `docs/ROADMAP.md` - alle offenen (nicht abgehakten) Items pro Phase
   und Serie.
3. `CHANGELOG.md` `[Unreleased]` - was bereits geshippt, aber noch nicht
   released ist. Kontext, kein TODO; zeigt, welche Smokes / Validierungen
   ein Release blockieren.
4. Code-TODOs / FIXMEs:
   `grep -rn 'TODO\|FIXME\|XXX' src/ --include='*.ts' --include='*.tsx'`.
   Nur substanzielle Eintraege, keine Naming-Trivialitaeten.
5. GitHub-Issues, falls der Tracker aktiv genutzt wird (sonst auslassen).
6. Bekannte, aber undokumentierte Items (z. B. Gate-Diskrepanzen,
   Manual-Smoke-Backlog), sofern objektiv beobachtbar.

## Priorisierungs-Kriterien (in dieser Gewichtung)

1. **Tier-Status** (BACKLOG-Konvention): Tier 1 > Tier 2 > Tier 3.
2. **Trigger-Status** fuer Tier 3: FIRED > NOT_FIRED > USER_BOUND.
3. **Kategorie-Risk**: Security / Data-Loss > Functional-Bug >
   Discipline-Erosion > Tech-Debt > Polish.
4. **User-Impact** (sichtbar fuer Endnutzer): Hoch > Mittel > Niedrig >
   Maintainer-only.
5. **Effort vs Leverage**: bei gleicher Prioritaet Quick-Wins vor
   Large-Tracks.
6. **Dependencies / Blockers**: Items, die andere entblocken, rutschen
   nach oben.

## Output-Format

Markdown-Report im Chat, kein File-Output noetig.

1. **Konsolidierte Tabelle**: eine Zeile pro Item, sortiert nach finaler
   Prioritaet. Spalten:
   `Rank | ID | Kategorie | Beschreibung (1 Zeile) | Tier | Trigger | Effort | Begruendung`.
   Kategorien: Bug, Feature, Tech-Debt, Rule, Doc, Smoke.
2. **Top-3-Empfehlung**: pro Eintrag ID + Ein-Saetzer, warum dieser
   Platz (welche Kriterien dominieren), erwarteter Aufwand, und was es
   entblockt. Wenn die Top-Plaetze maintainer-gebunden sind, das
   explizit sagen und die einzige agent-ausfuehrbare Sofortaktion
   separat benennen.
3. **User-Bound-Liste** (separat): Items, die nur der Maintainer
   erledigen kann (Manual Smokes nach Risiko geordnet, Domain-Wahl,
   Store-Packaging, andere User-Decisions).
4. **Inkonsistenzen / offene Hygiene**: was beim Audit auffiel, aber in
   keiner formellen Liste steht (ein Punkt pro Zeile, mit Empfehlung wie
   zu dokumentieren).

## Constraints

- **Read-only beim Audit**: keine Edits, Branches oder Commits, solange
  nur priorisiert wird. Umsetzung ist ein eigener, danach beauftragter
  Schritt.
- **Keine spekulativen Items**: nur dokumentierte oder objektiv
  beobachtbare Aufgaben, nichts Erfundenes, das niemand registriert hat.
- Bei unklarer Tier-Zuordnung lieber den Item-Status zitieren als
  spekulieren.
- Bereits persistierte Memory-Items, die schon im BACKLOG stehen, nicht
  doppelt fuehren.
- Echte UTF-8-Umlaute, keine Em-Dashes (siehe `code-hygiene.md`).
