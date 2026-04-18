/**
 * Three-section privacy summary rendered inside the PrivacyInfoPopover and
 * potentially in other disclosure surfaces. Pure presentational: no props,
 * no state, no dependencies on chat or settings context.
 *
 * Source of truth for retention claim:
 * https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data
 * (verified 2026-04-18)
 */
export function PrivacyInfoContent() {
  return (
    <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
      <section>
        <h4 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Was Phylax macht
        </h4>
        <ul className="list-disc space-y-1 pl-5">
          <li>Speichert keine Chat-Nachrichten lokal</li>
          <li>Nachrichten existieren nur waehrend der Sitzung</li>
          <li>Seitenneuladen loescht den Chat</li>
        </ul>
      </section>

      <section>
        <h4 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Was Anthropic macht
        </h4>
        <ul className="list-disc space-y-1 pl-5">
          <li>Speichert Anfragen und Antworten fuer 30 Tage zur Sicherheitspruefung</li>
          <li>Loescht sie danach automatisch</li>
          <li>Verwendet sie nicht fuer KI-Training</li>
        </ul>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          Details zur Datenverarbeitung:{' '}
          <a
            href="https://privacy.claude.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            privacy.claude.com
          </a>
        </p>
      </section>

      <section>
        <h4 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Was du kontrollierst
        </h4>
        <ul className="list-disc space-y-1 pl-5">
          <li>Der Anthropic-Account und API-Schluessel gehoeren dir, nicht Phylax</li>
          <li>Du siehst deine Nutzung direkt in deinem Anthropic-Konto</li>
          <li>
            KI-Funktion jederzeit in Einstellungen deaktivieren (loescht den Schluessel aus Phylax)
          </li>
          <li>&quot;Profil teilen&quot; ist optional</li>
          <li>Chat jederzeit mit &quot;Leeren&quot; entfernen</li>
          <li>API-Schluessel direkt bei Anthropic widerrufen (sofortige Wirkung)</li>
        </ul>
      </section>
    </div>
  );
}
