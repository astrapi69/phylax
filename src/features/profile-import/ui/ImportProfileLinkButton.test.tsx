import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import i18n from '../../../i18n/config';
import { ImportProfileLinkButton } from './ImportProfileLinkButton';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
});

function renderInRouter() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path="/profile" element={<ImportProfileLinkButton />} />
        <Route path="/import" element={<div data-testid="import-route-marker">imported</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ImportProfileLinkButton', () => {
  it('renders with the localized DE label', () => {
    renderInRouter();
    expect(screen.getByTestId('import-profile-link-button')).toHaveTextContent(
      'Profil importieren',
    );
  });

  it('renders the EN label when i18n language is en', async () => {
    await i18n.changeLanguage('en');
    renderInRouter();
    expect(screen.getByTestId('import-profile-link-button')).toHaveTextContent('Import profile');
    await i18n.changeLanguage('de');
  });

  it('renders as an anchor with href pointing to /import', () => {
    renderInRouter();
    const link = screen.getByTestId('import-profile-link-button');
    expect(link.tagName.toLowerCase()).toBe('a');
    expect(link).toHaveAttribute('href', '/import');
  });

  it('clicking the link navigates to /import', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    renderInRouter();
    await user.click(screen.getByTestId('import-profile-link-button'));
    expect(screen.getByTestId('import-route-marker')).toBeInTheDocument();
  });

  it('default styling satisfies 44px touch height (WCAG 2.5.5)', () => {
    renderInRouter();
    expect(screen.getByTestId('import-profile-link-button').className).toMatch(/min-h-\[44px\]/);
  });

  it('accepts a className override', () => {
    render(
      <MemoryRouter>
        <ImportProfileLinkButton className="custom-class" />
      </MemoryRouter>,
    );
    const link = screen.getByTestId('import-profile-link-button');
    expect(link.className).toBe('custom-class');
  });
});
