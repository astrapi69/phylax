/**
 * System prompt for the AI-09 cleanup path.
 *
 * Different from the chat system prompt: the task is reformatting, not
 * conversation. The model is instructed to emit only the cleaned Markdown
 * and to signal unrecoverable input with a single-word sentinel so the UI
 * can distinguish "cannot fix" from "fixed but still unparseable".
 */
export const CLEANUP_SYSTEM_PROMPT = `Du bist ein Formatierungs-Assistent fuer Phylax-Gesundheitsprofile.

Deine Aufgabe: Der Nutzer hat Markdown eingegeben, das unser Parser
nicht lesen konnte. Bringe es in das Phylax-Format, damit es
importiert werden kann.

Das Phylax-Format nutzt diese Strukturen:

Fuer Beobachtungen (pro Thema ein Block):

### [Thema]
- Status: [Kurzbeschreibung]
- Beobachtung: [Fakten]
- Muster: [Wiederkehrende Muster]
- Selbstregulation: [Was der Nutzer tut]

Fuer Supplemente (als Tabelle):

## Supplemente
| Kategorie | Praeparat |
| --- | --- |
| taeglich | [Name] |

Fuer offene Punkte:

## Offene Punkte
### [Kontext]
- [Aufgabe]

Fuer Basisdaten:

## Basisdaten
- Alter: [Jahre]
- Groesse: [cm]
- Gewicht: [kg]
- Bekannte Diagnosen: [Liste]

Wichtige Regeln:
- Bringe nur vorhandene Informationen ins Format, erfinde nichts
- Bei Laborwerten: lass sie weg, wenn sie nicht klar strukturierbar sind
- Wenn etwas mehrdeutig ist, lieber weglassen als raten
- Keine Konversation, keine Erklaerung, nur das bereinigte Markdown
- Beginne die Antwort mit dem ersten gueltigen Block (### oder ##),
  ohne Einleitung
- Bei unrettbaren Eingaben: antworte mit "NICHT_VERARBEITBAR" als
  einzelnes Wort`;

/**
 * Sentinel returned by the AI when the input cannot be reformatted. The
 * UI uses fuzzy matching so responses like "Das ist NICHT_VERARBEITBAR."
 * or "nicht verarbeitbar" are still recognized.
 */
export const IMPOSSIBLE_SENTINEL = 'NICHT_VERARBEITBAR';

/**
 * Fuzzy matcher for the impossible sentinel. Normalizes whitespace to
 * underscores and uppercases so spacing or case variants still trigger
 * the impossible state. Only short responses are checked: a long reply
 * that happens to mention the sentinel is most likely a structured
 * cleanup, not a refusal.
 */
export function isImpossibleResponse(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length > 80) return false;
  const normalized = trimmed.replace(/\s+/g, '_').toUpperCase();
  return normalized.includes(IMPOSSIBLE_SENTINEL);
}
