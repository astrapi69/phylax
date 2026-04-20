import { useTranslation } from 'react-i18next';

interface WarningSignsSectionProps {
  signs: string[];
}

/**
 * Visually distinct section for warning signs. Uses an amber accent
 * and includes a warning glyph in the heading so the section is
 * immediately scannable.
 *
 * The emoji-in-heading treatment is reserved for this section (medical
 * red-flag markers). It is not a general pattern for every H2.
 */
export function WarningSignsSection({ signs }: WarningSignsSectionProps) {
  const { t } = useTranslation('profile-view');
  if (signs.length === 0) return null;
  return (
    <section
      aria-labelledby="warning-signs-heading"
      className="rounded border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40"
    >
      <h2
        id="warning-signs-heading"
        className="mb-2 flex items-center gap-2 text-lg font-semibold text-amber-900 dark:text-amber-200"
      >
        <span aria-hidden>⚠</span> {t('warning-signs.heading')}
      </h2>
      <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-200">
        {signs.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </section>
  );
}
