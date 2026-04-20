import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useProfileCreate } from './useProfileCreate';

interface ProfileCreateFormProps {
  onComplete: (profileId: string) => void;
}

/**
 * Form for creating a new profile.
 * Reusable for both the first profile after onboarding and future
 * "add another profile" flows in settings.
 */
export function ProfileCreateForm({ onComplete }: ProfileCreateFormProps) {
  const { t } = useTranslation('profile-create');
  const hook = useProfileCreate(onComplete);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const isSubmitting = hook.state.kind === 'submitting';
  if (hook.state.kind === 'error' && hook.state.detail) {
    console.error('[ProfileCreateForm]', hook.state.detail);
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">{t('heading')}</h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">{t('intro')}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void hook.submit();
        }}
        noValidate
      >
        <div className="mb-4">
          <label
            htmlFor="profileName"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            {t('form.name-label')}
          </label>
          <input
            ref={nameRef}
            id="profileName"
            name="profileName"
            type="text"
            value={hook.name}
            onChange={(e) => hook.setName(e.target.value)}
            placeholder={t('form.name-placeholder')}
            maxLength={60}
            disabled={isSubmitting}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-700"
          />
        </div>

        <fieldset className="mb-4">
          <legend className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('form.type-label')}
          </legend>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input
                type="radio"
                name="profileType"
                value="self"
                checked={hook.profileType === 'self'}
                onChange={() => hook.setProfileType('self')}
                disabled={isSubmitting}
              />
              {t('form.type-self')}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input
                type="radio"
                name="profileType"
                value="proxy"
                checked={hook.profileType === 'proxy'}
                onChange={() => hook.setProfileType('proxy')}
                disabled={isSubmitting}
              />
              {t('form.type-proxy')}
            </label>
          </div>
        </fieldset>

        {hook.profileType === 'proxy' && (
          <div className="mb-4">
            <label
              htmlFor="managedBy"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              {t('form.managed-by-label')}
            </label>
            <input
              id="managedBy"
              name="managedBy"
              type="text"
              value={hook.managedBy}
              onChange={(e) => hook.setManagedBy(e.target.value)}
              placeholder={t('form.managed-by-placeholder')}
              disabled={isSubmitting}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-700"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('form.managed-by-hint')}
            </p>
          </div>
        )}

        <div className="mb-6">
          <label
            htmlFor="version"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            {t('form.version-label')}
          </label>
          <input
            id="version"
            name="version"
            type="text"
            value={hook.version}
            onChange={(e) => hook.setVersion(e.target.value)}
            placeholder={t('form.version-placeholder')}
            disabled={isSubmitting}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-700"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('form.version-hint')}</p>
        </div>

        {hook.state.kind === 'error' && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400" role="alert">
            {t('error.create-failed')}
          </p>
        )}

        <button
          type="submit"
          disabled={!hook.isValid || isSubmitting}
          className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-500"
        >
          {isSubmitting ? t('submit.pending') : t('submit.label')}
        </button>
      </form>
    </div>
  );
}
