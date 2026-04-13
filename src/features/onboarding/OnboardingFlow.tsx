import { useOnboarding, type OnboardingState } from './useOnboarding';
import type { PasswordStrength } from './passwordValidation';

interface OnboardingFlowProps {
  onComplete: () => void;
}

const STRENGTH_LABELS: Record<PasswordStrength, string> = {
  weak: 'Schwach',
  fair: 'Mittel',
  strong: 'Stark',
};

const STRENGTH_COLORS: Record<PasswordStrength, string> = {
  weak: 'bg-red-500',
  fair: 'bg-yellow-500',
  strong: 'bg-green-500',
};

const STRENGTH_TEXT_COLORS: Record<PasswordStrength, string> = {
  weak: 'text-red-600',
  fair: 'text-yellow-600',
  strong: 'text-green-600',
};

const STRENGTH_WIDTHS: Record<PasswordStrength, string> = {
  weak: 'w-1/3',
  fair: 'w-2/3',
  strong: 'w-full',
};

function StrengthIndicator({ strength }: { strength: PasswordStrength }) {
  return (
    <div className="mt-1">
      <div className="h-1.5 w-full rounded-full bg-gray-200">
        <div
          className={`h-1.5 rounded-full transition-all ${STRENGTH_COLORS[strength]} ${STRENGTH_WIDTHS[strength]}`}
          role="progressbar"
          aria-valuenow={strength === 'weak' ? 33 : strength === 'fair' ? 66 : 100}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Passwortstaerke: ${STRENGTH_LABELS[strength]}`}
        />
      </div>
      <p className={`mt-1 text-sm ${STRENGTH_TEXT_COLORS[strength]}`}>
        {STRENGTH_LABELS[strength]}
      </p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center gap-2" role="status">
      <svg className="h-5 w-5 animate-spin text-gray-600" viewBox="0 0 24 24" fill="none">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <span>Schluessel wird abgeleitet...</span>
    </div>
  );
}

function renderState(state: OnboardingState): string {
  switch (state) {
    case 'setup':
      return 'Waehle ein Master-Passwort';
    case 'confirm':
      return 'Passwort bestaetigen';
    case 'deriving':
      return 'Einrichtung laeuft...';
    case 'done':
      return 'Einrichtung abgeschlossen';
  }
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const hook = useOnboarding(onComplete);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Phylax einrichten</h1>
        <p className="mb-6 text-sm text-gray-600">{renderState(hook.state)}</p>

        {hook.state === 'deriving' && <LoadingSpinner />}

        {hook.state === 'done' && (
          <p className="text-center text-green-700" role="alert">
            Einrichtung abgeschlossen.
          </p>
        )}

        {(hook.state === 'setup' || hook.state === 'confirm') && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void hook.submit();
            }}
            noValidate
          >
            <div className="mb-4">
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                Master-Passwort
              </label>
              <input
                id="password"
                type="password"
                value={hook.password}
                onChange={(e) => hook.setPassword(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoComplete="new-password"
                aria-describedby={hook.passwordError ? 'password-error' : undefined}
              />
              {hook.password.length > 0 && <StrengthIndicator strength={hook.strength} />}
              {hook.passwordError && (
                <p id="password-error" className="mt-1 text-sm text-red-600" role="alert">
                  {hook.passwordError}
                </p>
              )}
            </div>

            {hook.state === 'confirm' && (
              <>
                <div className="mb-4">
                  <label
                    htmlFor="confirm-password"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Passwort wiederholen
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={hook.confirmPassword}
                    onChange={(e) => hook.setConfirmPassword(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoComplete="new-password"
                    aria-describedby={hook.confirmError ? 'confirm-error' : undefined}
                  />
                  {hook.confirmError && (
                    <p id="confirm-error" className="mt-1 text-sm text-red-600" role="alert">
                      {hook.confirmError}
                    </p>
                  )}
                </div>

                <div className="mb-4 rounded border border-yellow-300 bg-yellow-50 p-3">
                  <p className="mb-2 text-sm text-yellow-800">
                    Wenn du dein Passwort vergisst, sind deine Daten verloren. Es gibt keinen
                    Wiederherstellungsweg. Schreibe es an einen sicheren Ort, bevor du fortfaehrst.
                  </p>
                  <label className="flex items-start gap-2 text-sm text-yellow-800">
                    <input
                      type="checkbox"
                      checked={hook.acknowledged}
                      onChange={(e) => hook.setAcknowledged(e.target.checked)}
                      className="mt-0.5"
                    />
                    Ich habe verstanden
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!hook.submitEnabled}
                  className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                >
                  Phylax einrichten
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
