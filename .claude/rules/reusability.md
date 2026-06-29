# Reusability and Duplication

Diese Regel ergänzt `code-hygiene.md` (Dead-Code, Bundle-Hygiene, keine
lodash/moment) und `coding-standards.md` ("pragmatic, maintainable,
shippable. No over-engineering") um die _Reihenfolge der Entscheidung_
zwischen Wiederverwenden, Duplizieren und Abstrahieren. Sie ist eine
**partielle** Adoption: nur die Teile, die zum Single-Repo-Frontend ohne
Backend und ohne Plugin-System passen (siehe `architecture.md` "Single
repository").

## Vor dem Schreiben: zuerst suchen

- Bevor eine Funktion, ein Hook oder eine Komponente neu entsteht: das
  Repo nach einer bestehenden Lösung durchsuchen (Name, Signatur,
  Domänenbegriff). Ein vorhandenes `ui/`-Element, ein `lib/`-Utility oder
  eine Repository-Methode geht immer vor einer zweiten Variante.
- Geteilte, dumme UI-Bausteine leben in `src/ui/`, kleine domänenfreie
  Helfer in `src/lib/`, Domänenlogik in `src/domain/`. Neue
  Wiederverwendbarkeit wird dort platziert, nicht in einem Feature-Ordner,
  aus dem ein zweites Feature quer importieren müsste.

## Rule of three (Abstraktion erst beim dritten Mal)

- Einmal: schreiben.
- Zweimal: Duplizieren ist erlaubt, wenn die zwei Stellen sich noch
  unterschiedlich entwickeln könnten. Eine verfrühte Abstraktion ist
  teurer als eine kurze Duplikation (vgl. `architecture.md`: "premature
  abstraction ... build it inline, refactor later if a second consumer
  appears").
- Dreimal oder ein bewiesener zweiter Konsument mit identischer Semantik:
  extrahieren. Die Extraktion ist ein mechanischer Refactor unter
  bestehender Testabdeckung und fällt unter die Refactor-Ausnahme in
  `tdd.md` (die Suite muss grün bleiben, das beweist, dass nichts brach;
  es werden aber keine neuen Verhaltenstests erzwungen, solange sich das
  Verhalten nicht ändert).

## Keine neue Dependency für Wiederverwendbares

- Vor dem Ziehen einer Bibliothek für eine kleine Wiederholung gilt
  `code-hygiene.md`: kein lodash, kein moment; native Methoden oder ein
  Fünf-Zeilen-Utility in `src/lib/`. Jede neue Dependency erhöht die
  Angriffsfläche (CLAUDE.md) und braucht eine ADR.

## Geteilter Code bleibt schichtenrein

- Wiederverwendung darf die Schichtengrenzen aus `architecture.md` nicht
  verletzen: ein geteiltes Utility im UI-Layer ruft niemals
  `crypto.subtle` oder Dexie direkt; geteilte Domänenlogik importiert
  weder React noch Dexie. Ein Helfer, der quer durch die Schichten greifen
  müsste, ist ein Zeichen für eine falsch geschnittene Abstraktion, nicht
  für Wiederverwendung.

## Test-Helfer zählen auch

- Geteilte Test-Helfer folgen derselben Regel: eine zum dritten Mal
  kopierte Setup-Sequenz wird ein benannter Helfer (z. B.
  `tests/e2e/helpers.ts`). Wo zwei Test-Suiten bewusst getrennte
  Helfer-Module führen (dev vs. production E2E), ist eine kleine, im
  Kommentar als "in sync halten" markierte Kopie der Kopplung über die
  Suite-Grenze vorzuziehen.

## Nicht adoptiert

- Cross-Package- oder Monorepo-Sharing: entfällt, Phylax ist ein einzelnes
  Paket (`architecture.md` "Single repository").
- Plugin-/Extension-Wiederverwendung: entfällt, kein Plugin-System.
