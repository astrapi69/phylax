import { useTranslation } from 'react-i18next';
import type { Supplement } from '../../domain';
import { ProvenanceBadge } from '../document-import/ui/ProvenanceBadge';

interface SupplementCardProps {
  supplement: Supplement;
  muted?: boolean;
}

/**
 * Single supplement card. When `muted` is true (paused supplements),
 * the card is visually de-emphasized but remains fully readable by
 * screen readers.
 */
export function SupplementCard({ supplement, muted = false }: SupplementCardProps) {
  const { t } = useTranslation('supplements');
  const { name, brand, recommendation, rationale } = supplement;
  // Muted variant uses a subtle gray background tint and shows a
  // "Pausiert" badge. We deliberately do NOT reduce opacity, because
  // that blends small text below WCAG AA contrast on the tinted
  // background. The badge and background tint are enough signal.
  const containerClass = muted
    ? 'rounded-sm border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50'
    : 'rounded-sm border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800';

  return (
    <div className={containerClass}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{name}</h3>
        {brand && <span className="text-xs text-gray-500 dark:text-gray-400">{brand}</span>}
        {muted && (
          <span className="rounded-sm bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            {t('card.paused-badge')}
          </span>
        )}
        <ProvenanceBadge sourceDocumentId={supplement.sourceDocumentId} />
      </div>
      {recommendation && (
        <FieldLine label={t('card.field.recommendation')} value={recommendation} />
      )}
      {rationale && <FieldLine label={t('card.field.rationale')} value={rationale} />}
    </div>
  );
}

function FieldLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
      <span className="font-medium text-gray-600 dark:text-gray-400">{label}:</span> {value}
    </p>
  );
}
