import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  useModalTitleId,
} from '../../ui';
import { PrivacyInfoContent } from './PrivacyInfoContent';

interface PrivacyInfoPopoverProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal dialog that renders PrivacyInfoContent. Despite the legacy
 * filename ("Popover"), this is a full modal: backdrop, focus trap,
 * Escape close, and a single close button. The Q6 lock from the
 * TD-12 plan ("investigate popover-vs-modal first; may stay popover")
 * resolved to "migrate" because the component already exposed
 * role="dialog" + aria-modal=true and used the modal interaction
 * pattern; only the file name was misleading.
 *
 * Controlled: the consumer owns the trigger button and the open state
 * so the same modal can be invoked from the chat header icon, the
 * settings link, or the AI-fallback CleanupButton.
 *
 * Closes on Escape, backdrop click (explicit
 * `closeOnBackdropClick={true}` - this surface is purely informational
 * so accidental dismissal is safe), and the explicit Schließen button.
 * Focus lands on the close button on open; Tab is trapped inside.
 *
 * TD-12 migration: composes the shared `<Modal>` primitive instead of
 * carrying its own focus-trap + Escape boilerplate.
 */
export function PrivacyInfoPopover({ open, onClose }: PrivacyInfoPopoverProps) {
  const { t } = useTranslation('ai-config');
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useModalTitleId();

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId={titleId}
      role="dialog"
      closeOnBackdropClick
      initialFocusRef={closeRef}
      size="lg"
      testId="privacy-info-popover"
    >
      <ModalHeader titleId={titleId}>{t('privacy-info.title')}</ModalHeader>

      <ModalBody>
        <PrivacyInfoContent />
      </ModalBody>

      <ModalFooter>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {t('common:action.close')}
        </button>
      </ModalFooter>
    </Modal>
  );
}
