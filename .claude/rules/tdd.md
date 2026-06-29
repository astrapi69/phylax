# Test-Driven Development (TDD)

Dies ist die WORKFLOW-Regel für das Schreiben von Code. Sie sitzt auf
der Test-STRATEGIE in `quality-checks.md` (Test-Layer, Coverage-
Schwellen, Mutation-Testing) und der pro-Feature-Vorgabe in
`test-strategy.md` ("Required per Feature Task"). Wo jene festlegen _was_
und _wieviel_ getestet wird, legt diese Regel die _Reihenfolge_ fest:
Test zuerst, dann der minimale Code, dann das Aufräumen.

## Pflicht für Code-Änderungen mit Logik

Code-Änderungen mit Verhalten/Logik folgen dem Red-Green-Refactor-
Zyklus. "Mit Logik" heißt: ein neues Verhalten, ein geänderter Code-
Pfad, eine Bedingung, eine Berechnung, eine Validierung, ein Mapping.
Reine Mechanik ohne Verhaltensänderung fällt unter die Ausnahmen
unten.

### Phase 1: RED (Test zuerst)

- Test schreiben, der die gewünschte Änderung beschreibt.
- Der Test MUSS fehlschlagen (beweist, dass das Feature/der Fix noch
  nicht existiert).
- Kein Produktionscode vor dem fehlschlagenden Test.
- Im Crypto-Layer ist zusätzlich ein Negativtest Pflicht (falscher
  Key/manipuliertes Ciphertext schlägt fehl), siehe die Crypto-
  Reihenfolge in `ai-workflow.md` und die Round-Trip-Pflicht in
  `coding-standards.md`.

### Phase 2: GREEN (minimale Implementierung)

- Nur den Code schreiben, der den Test grün macht.
- YAGNI: keine vorzeitige Optimierung, kein Code "für später" (deckt
  sich mit `coding-standards.md` "pragmatic, maintainable, shippable.
  No over-engineering").
- `make typecheck` (`tsc --noEmit`) und `make test` (Vitest) grün.

### Phase 3: REFACTOR (aufräumen)

- Code-Smells, Duplikation, Benennung verbessern (Boy-Scout-Rule;
  Naming und Dead-Code-Regeln in `code-hygiene.md`).
- Tests bleiben grün.

## Test-Menge pro Feature/Fix

Der Boden ist die pro-Feature-Vorgabe aus `test-strategy.md`: Unit-Tests
plus Component-Integration-Tests für jeden Feature-Task, Bundle-Size-
und Smoke/a11y-Check laufen automatisch im CI-Gate. Für ein echtes
Feature oder einen Fix ist das ZIEL die folgende Aufteilung, mindestens
vier Tests, die zusammen das Verhalten absichern:

1. **Reproduktionstest** - der Red-Test vor dem Fix/Feature.
2. **Happy-Path** - der erwartete Normalfall.
3. **Edge-Cases** - leere/fehlende/unerwartete Eingaben.
4. **Grenzwerte / Boundary** - die Ränder des gültigen Bereichs.

Boden und Ziel sind KEIN Widerspruch: der Boden gilt für triviale neue
Funktionen, das Ziel für Features und Fixes. Mehr Tests sind erlaubt,
weniger als der Boden nicht. Keine künstlichen Tests nur zum Zählen -
jeder Test prüft eine echte Verhaltenseigenschaft. Coverage ohne
Mutation-Score ist optimistisch (siehe `test-strategy.md`
"Test Philosophy" und die Mutation-Schwellen in `quality-checks.md`):
killed mutants verfolgen, nicht Zeilennummern.

## Bug-Fixes

- IMMER zuerst einen Test, der den Bug reproduziert (RED, beweist den
  Bug).
- Dann fixen bis GREEN.
- Der Reproduktionstest bleibt als Regressions-Guard im Repo.
- Root-Cause-Disziplin: erst den Fehler reproduzierbar machen, dann
  fixen - kein Fix ohne verstandene Ursache. Wiederkehrende Fallen
  werden in `lessons-learned.md` festgehalten.

## Ausnahmen (etablierte Projektpraxis)

TDD wird NICHT erzwungen für:

- Reine Doku-Änderungen (kein Code).
- Reine Konfiguration (CI, Makefile, YAML) ohne Logik.
- Mechanische Refactors mit bestehender Testabdeckung: Datei-Splits,
  Barrel-/Re-Export-Umzüge (`index.ts`), verhaltensneutrale I18N-
  String-Extraktionen (vgl. den `refactor`-Commit-Typ für I18N-xx in
  `task-series.md`), Cross-Component-Renames. Hier MUSS die bestehende
  Suite grün bleiben (beweist, dass nichts brach), aber es werden keine
  neuen Verhaltenstests erzwungen.
- Visuelle / Geräte-only-Aspekte, die im Container nicht testbar sind,
  bleiben manueller Rest. TDD ersetzt weder den manuellen Smoke-Test aus
  `quality-checks.md` (insb. den Backup-Round-Trip und den ad-hoc-Smoke
  nach Crypto-/Storage-/Lock-Änderungen) noch die Smoke-Artefakte unter
  `docs/manual-smoke/`, sondern ergänzt sie.

Die Ausnahmen entbinden nicht von der harten Regel: `make test` muss
nach jeder Änderung grün bleiben (ein einzelner roter Test blockiert
den Commit, siehe `quality-checks.md`). Beim Berühren von `src/crypto/`
oder `src/db/` gilt zusätzlich `make test` UND `make test-e2e` vor dem
Commit (`ai-workflow.md`).
