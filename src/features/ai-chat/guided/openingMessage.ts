/**
 * Hardcoded assistant-role opening message inserted when a guided session
 * starts. Deterministic: no API call, shows instantly. The system prompt
 * (with GUIDED_SESSION_FRAMING) still governs the following turns, so the
 * model continues the session in the same pacing.
 */
export const GUIDED_SESSION_OPENING_MESSAGE = `Willkommen zur gefuehrten Sitzung. Ich fuehre dich durch drei Bereiche deines Profils:

1. Beobachtungen
2. Supplemente
3. Offene Punkte

Basisdaten erfasst du ueber das Profil-Formular, Laborwerte importierst du separat, Verlaufsnotizen ebenfalls.

Du kannst die Sitzung jederzeit beenden. Lass uns mit den Beobachtungen anfangen: gibt es etwas, das dir gesundheitlich gerade auffaellt oder dich beschaeftigt?`;

export const GUIDED_SESSION_END_MESSAGE = 'Gefuehrte Sitzung beendet.';
