import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

type TrustKey = 'local' | 'encrypted' | 'open';

const TRUST_ORDER: readonly TrustKey[] = ['local', 'encrypted', 'open'] as const;

const ICON_FOR: Record<TrustKey, () => JSX.Element> = {
  local: LaptopIcon,
  encrypted: LockIcon,
  open: ShieldCheckIcon,
};

/**
 * First-run entry screen. Three trust signals summarize Phylax's
 * local-first principles before the user commits to setup. Primary CTA
 * advances to /privacy; secondary link routes to /backup/import/select
 * for users arriving with an existing backup file.
 */
export function WelcomeView() {
  const { t } = useTranslation('onboarding');
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-gray-950">
      <div className="w-full max-w-2xl">
        <header className="mb-8 text-center">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mb-2 text-4xl font-bold text-gray-900 focus:outline-none dark:text-gray-100"
          >
            Phylax
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">{t('welcome.tagline')}</p>
        </header>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {TRUST_ORDER.map((key) => (
            <TrustSignal key={key} id={key} t={t} />
          ))}
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/privacy')}
            className="w-full rounded bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 md:w-auto"
          >
            {t('welcome.cta.primary')}
          </button>
          <Link
            to="/backup/import/select"
            className="text-sm text-gray-600 underline hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            {t('welcome.cta.import')}
          </Link>
        </div>
      </div>
    </main>
  );
}

function TrustSignal({ id, t }: { id: TrustKey; t: TFunction<'onboarding'> }) {
  const titleId = `trust-${id}-title`;
  const Icon = ICON_FOR[id];
  return (
    <section
      aria-labelledby={titleId}
      className="rounded border border-gray-200 bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center text-blue-600 dark:text-blue-400">
        <Icon />
      </div>
      <h2 id={titleId} className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {t(`welcome.trust.${id}.title`)}
      </h2>
      <p className="text-xs text-gray-600 dark:text-gray-400">{t(`welcome.trust.${id}.body`)}</p>
    </section>
  );
}

const ICON_PROPS = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  width: 24,
  height: 24,
  'aria-hidden': true,
};

function LaptopIcon() {
  return (
    <svg {...ICON_PROPS} data-testid="trust-icon-local">
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M2 20h20" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg {...ICON_PROPS} data-testid="trust-icon-encrypted">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg {...ICON_PROPS} data-testid="trust-icon-open">
      <path d="M12 3 5 6v6c0 4.5 3 8.5 7 9 4-0.5 7-4.5 7-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
