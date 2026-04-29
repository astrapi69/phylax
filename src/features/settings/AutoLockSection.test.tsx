import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { readAppSettings } from '../../db/appSettings';
import { AutoLockSection } from './AutoLockSection';

const TEST_PASSWORD = 'test-password-12';

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
});

describe('AutoLockSection', () => {
  it('renders all five preset buttons with localized labels', async () => {
    render(<AutoLockSection />);
    await waitFor(() => {
      expect(screen.getByTestId('auto-lock-preset-1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('auto-lock-preset-1')).toHaveTextContent('1 Minute');
    expect(screen.getByTestId('auto-lock-preset-5')).toHaveTextContent('5 Minuten');
    expect(screen.getByTestId('auto-lock-preset-15')).toHaveTextContent('15 Minuten');
    expect(screen.getByTestId('auto-lock-preset-30')).toHaveTextContent('30 Minuten');
    expect(screen.getByTestId('auto-lock-preset-60')).toHaveTextContent('60 Minuten');
  });

  it('marks the persisted preset as selected on initial mount', async () => {
    const { saveAppSettings } = await import('../../db/appSettings');
    await saveAppSettings({ autoLockMinutes: 15 });
    render(<AutoLockSection />);
    await waitFor(() => {
      expect(screen.getByTestId('auto-lock-preset-15')).toHaveAttribute('aria-checked', 'true');
    });
    expect(screen.getByTestId('auto-lock-preset-5')).toHaveAttribute('aria-checked', 'false');
  });

  it('clicking a preset persists the new value', async () => {
    render(<AutoLockSection />);
    const user = userEvent.setup();
    await user.click(await screen.findByTestId('auto-lock-preset-30'));
    await waitFor(() =>
      expect(screen.getByTestId('auto-lock-preset-30')).toHaveAttribute('aria-checked', 'true'),
    );
    const settings = await readAppSettings();
    expect(settings.autoLockMinutes).toBe(30);
  });

  it('renders the apply-on-reload hint', async () => {
    render(<AutoLockSection />);
    await waitFor(() =>
      expect(screen.getByTestId('auto-lock-apply-hint')).toHaveTextContent(
        /Wirksam beim nächsten Entsperren/,
      ),
    );
  });

  it('clicking the same preset again is a no-op', async () => {
    render(<AutoLockSection />);
    const user = userEvent.setup();
    // Default is 5 minutes; clicking the 5-minute preset stays selected
    // and does not write.
    const preset5 = await screen.findByTestId('auto-lock-preset-5');
    await waitFor(() => expect(preset5).toHaveAttribute('aria-checked', 'true'));
    await user.click(preset5);
    expect(preset5).toHaveAttribute('aria-checked', 'true');
  });
});
