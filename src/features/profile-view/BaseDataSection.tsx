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
      <dt className="text-sm font-medium text-gray-600 sm:w-32">{label}</dt>
      <dd className="text-sm text-gray-900">{children}</dd>
    </div>
  );
}

export function BaseDataSection({ baseData }: BaseDataSectionProps) {
  const rows: React.ReactNode[] = [];
  if (baseData.birthDate) {
    rows.push(
      <Row key="birth" label="Geburtsdatum">
        {formatBirthDate(baseData.birthDate)}
      </Row>,
    );
  }
  if (baseData.age !== undefined) {
    rows.push(
      <Row key="age" label="Alter">
        {baseData.age} Jahre
      </Row>,
    );
  }
  if (baseData.heightCm !== undefined) {
    rows.push(
      <Row key="height" label="Grösse">
        {baseData.heightCm} cm
      </Row>,
    );
  }
  if (baseData.weightKg !== undefined) {
    const target = baseData.targetWeightKg;
    rows.push(
      <Row key="weight" label="Gewicht">
        {baseData.weightKg} kg
        {target !== undefined && <span className="text-gray-500"> (Ziel: {target} kg)</span>}
      </Row>,
    );
  }

  const hasNotes = typeof baseData.contextNotes === 'string' && baseData.contextNotes.trim() !== '';

  if (rows.length === 0 && !hasNotes) return null;

  return (
    <section aria-labelledby="basisdaten-heading">
      <h2 id="basisdaten-heading" className="mb-3 text-lg font-semibold text-gray-900">
        Basisdaten
      </h2>
      {rows.length > 0 && <dl className="space-y-2">{rows}</dl>}
      {hasNotes && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-gray-700">Kontextnotizen</h3>
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
  if (profileType === 'proxy') {
    const mb = managedBy?.trim();
    return (
      <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
        {mb ? `Stellvertretend für ${mb}` : 'Stellvertreterprofil'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
      Eigenes Profil
    </span>
  );
}
