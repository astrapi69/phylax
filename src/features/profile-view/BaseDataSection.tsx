import { useTranslation } from 'react-i18next';
import type { BaseData } from '../../domain';
import { MarkdownContent } from './MarkdownContent';

interface BaseDataSectionProps {
  baseData: BaseData;
}

const DATE_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function formatBirthDate(iso: string): string {
  // ISO "YYYY-MM-DD". Parse manually to avoid timezone shifts.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, y, m, d] = match;
  return DATE_FORMATTER.format(new Date(Number(y), Number(m) - 1, Number(d)));
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="text-sm font-medium text-gray-600 dark:text-gray-400 sm:w-32">{label}</dt>
      <dd className="text-sm text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  );
}

export function BaseDataSection({ baseData }: BaseDataSectionProps) {
  const { t } = useTranslation('profile-view');
  const rows: React.ReactNode[] = [];
  if (baseData.birthDate) {
    rows.push(
      <Row key="birth" label={t('basedata.field-birth-date')}>
        {formatBirthDate(baseData.birthDate)}
      </Row>,
    );
  }
  if (baseData.age !== undefined) {
    rows.push(
      <Row key="age" label={t('basedata.field-age')}>
        {t('basedata.age-value', { age: baseData.age })}
      </Row>,
    );
  }
  if (baseData.heightCm !== undefined) {
    rows.push(
      <Row key="height" label={t('basedata.field-height')}>
        {t('basedata.height-value', { height: baseData.heightCm })}
      </Row>,
    );
  }
  if (baseData.weightKg !== undefined) {
    const target = baseData.targetWeightKg;
    rows.push(
      <Row key="weight" label={t('basedata.field-weight')}>
        {t('basedata.weight-value', { weight: baseData.weightKg })}
        {target !== undefined && (
          <span className="text-gray-500 dark:text-gray-400">
            {t('basedata.weight-target', { target })}
          </span>
        )}
      </Row>,
    );
  }

  const hasNotes = typeof baseData.contextNotes === 'string' && baseData.contextNotes.trim() !== '';

  if (rows.length === 0 && !hasNotes) return null;

  return (
    <section aria-labelledby="basisdaten-heading">
      <h2
        id="basisdaten-heading"
        className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        {t('basedata.heading')}
      </h2>
      {rows.length > 0 && <dl className="space-y-2">{rows}</dl>}
      {hasNotes && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('basedata.context-notes-heading')}
          </h3>
          <MarkdownContent>{baseData.contextNotes}</MarkdownContent>
        </div>
      )}
    </section>
  );
}

interface ProfileTypeBadgeProps {
  profileType: 'self' | 'proxy';
  managedBy?: string;
}

export function ProfileTypeBadge({ profileType, managedBy }: ProfileTypeBadgeProps) {
  const { t } = useTranslation('profile-view');
  if (profileType === 'proxy') {
    const mb = managedBy?.trim();
    return (
      <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900/40 dark:text-purple-200">
        {mb ? t('profile-type.proxy-for', { name: mb }) : t('profile-type.proxy')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
      {t('profile-type.own')}
    </span>
  );
}
