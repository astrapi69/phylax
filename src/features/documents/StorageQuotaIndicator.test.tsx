import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import i18n from '../../i18n/config';
import { StorageQuotaIndicator } from './StorageQuotaIndicator';
import { __resetStorageQuotaWarn } from './useStorageQuota';

type StorageWithEstimate = {
  estimate: () => Promise<{ usage?: number; quota?: number }>;
};

let originalStorage: StorageWithEstimate | undefined;
let warnSpy: ReturnType<typeof vi.spyOn>;

function setStorage(stub: StorageWithEstimate | undefined): void {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: stub,
  });
}

beforeEach(() => {
  __resetStorageQuotaWarn();
  originalStorage = (navigator as unknown as { storage?: StorageWithEstimate }).storage;
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  if (i18n.language !== 'de') {
    void i18n.changeLanguage('de');
  }
});

afterEach(() => {
  setStorage(originalStorage);
  warnSpy.mockRestore();
});

describe('StorageQuotaIndicator', () => {
  it('renders a progressbar with aria attributes at normal usage', async () => {
    setStorage({
      estimate: async () => ({ usage: 25 * 1024 * 1024, quota: 100 * 1024 * 1024 }),
    });

    render(<StorageQuotaIndicator />);

    const bar = await waitFor(() => screen.getByTestId('quota-progressbar'));
    expect(bar).toHaveAttribute('role', 'progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '25');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    const text = bar.getAttribute('aria-valuetext') ?? '';
    expect(text).toMatch(/25 MB/);
    expect(text).toMatch(/100 MB/);
    expect(text).toMatch(/25/);
  });

  it('renders the inner filled div with aria-hidden to prevent double-announcement', async () => {
    setStorage({
      estimate: async () => ({ usage: 10 * 1024 * 1024, quota: 100 * 1024 * 1024 }),
    });

    render(<StorageQuotaIndicator />);

    const fill = await waitFor(() => screen.getByTestId('quota-bar-fill'));
    expect(fill).toHaveAttribute('aria-hidden');
  });

  it('uses green color tier below 70%', async () => {
    setStorage({
      estimate: async () => ({ usage: 50 * 1024 * 1024, quota: 100 * 1024 * 1024 }),
    });

    render(<StorageQuotaIndicator />);

    const bar = await waitFor(() => screen.getByTestId('quota-progressbar'));
    expect(bar).toHaveAttribute('data-tier', 'low');
    expect(screen.queryByTestId('quota-warning-medium')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quota-warning-high')).not.toBeInTheDocument();
  });

  it('shows the medium warning at 70-89%', async () => {
    setStorage({
      estimate: async () => ({ usage: 75 * 1024 * 1024, quota: 100 * 1024 * 1024 }),
    });

    render(<StorageQuotaIndicator />);

    const bar = await waitFor(() => screen.getByTestId('quota-progressbar'));
    expect(bar).toHaveAttribute('data-tier', 'medium');
    const warning = screen.getByTestId('quota-warning-medium');
    expect(warning).toHaveAttribute('role', 'status');
    expect(warning.textContent).toMatch(/Speicher wird voll/);
    expect(screen.queryByTestId('quota-warning-high')).not.toBeInTheDocument();
  });

  it('shows the high warning at 90% and above', async () => {
    setStorage({
      estimate: async () => ({ usage: 95 * 1024 * 1024, quota: 100 * 1024 * 1024 }),
    });

    render(<StorageQuotaIndicator />);

    const bar = await waitFor(() => screen.getByTestId('quota-progressbar'));
    expect(bar).toHaveAttribute('data-tier', 'high');
    const warning = screen.getByTestId('quota-warning-high');
    expect(warning.textContent).toMatch(/Speicher fast voll/);
    expect(screen.queryByTestId('quota-warning-medium')).not.toBeInTheDocument();
  });

  it('renders nothing when storage API is unavailable', async () => {
    setStorage(undefined);

    const { container } = render(<StorageQuotaIndicator />);

    await new Promise((r) => setTimeout(r, 20));
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when storage.estimate throws', async () => {
    setStorage({
      estimate: async () => {
        throw new Error('security-block');
      },
    });

    const { container } = render(<StorageQuotaIndicator />);

    await new Promise((r) => setTimeout(r, 20));
    expect(container.firstChild).toBeNull();
  });

  it('formats bytes into binary GB when large', async () => {
    setStorage({
      estimate: async () => ({ usage: 2 * 1024 * 1024 * 1024, quota: 5 * 1024 * 1024 * 1024 }),
    });

    render(<StorageQuotaIndicator />);

    const text = await waitFor(() => screen.getByTestId('quota-usage-text'));
    expect(text.textContent).toMatch(/2\.0 GB/);
    expect(text.textContent).toMatch(/5\.0 GB/);
  });
});
