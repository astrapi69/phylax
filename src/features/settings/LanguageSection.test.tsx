import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageSection } from './LanguageSection';
import i18n from '../../i18n/config';
import { STORAGE_KEY } from '../../i18n/detector';

function stubNavigator(languages: string[], language?: string) {
  vi.stubGlobal('navigator', { languages, language: language ?? languages[0] });
}

beforeEach(async () => {
  localStorage.removeItem(STORAGE_KEY);
  if (i18n.language !== 'de') {
    await i18n.changeLanguage('de');
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.removeItem(STORAGE_KEY);
});

describe('LanguageSection', () => {
  it('renders heading and three radio options', () => {
    render(<LanguageSection />);
    expect(screen.getByRole('heading', { level: 2, name: 'Sprache' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Systemsprache folgen' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Deutsch' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'English' })).toBeInTheDocument();
  });

  it('pre-selects "Auto" when no stored preference', () => {
    render(<LanguageSection />);
    expect(screen.getByRole('radio', { name: 'Systemsprache folgen' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Deutsch' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'English' })).not.toBeChecked();
  });

  it('pre-selects "Deutsch" when stored preference is de', async () => {
    localStorage.setItem(STORAGE_KEY, 'de');
    await i18n.changeLanguage('de');
    render(<LanguageSection />);
    expect(screen.getByRole('radio', { name: 'Deutsch' })).toBeChecked();
  });

  it('pre-selects "English" when stored preference is en', async () => {
    localStorage.setItem(STORAGE_KEY, 'en');
    await i18n.changeLanguage('en');
    render(<LanguageSection />);
    // When EN is active, heading renders as "Language"
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();
    await i18n.changeLanguage('de');
  });

  it('clicking English sets localStorage and switches i18n language', async () => {
    const user = userEvent.setup();
    render(<LanguageSection />);
    await user.click(screen.getByRole('radio', { name: 'English' }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('en');
    expect(i18n.language).toBe('en');
    await i18n.changeLanguage('de');
  });

  it('clicking Deutsch sets localStorage and switches i18n language', async () => {
    const user = userEvent.setup();
    await i18n.changeLanguage('en');
    render(<LanguageSection />);
    await user.click(screen.getByRole('radio', { name: 'Deutsch' }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('de');
    expect(i18n.language).toBe('de');
  });

  it('clicking Auto clears localStorage and re-detects from navigator (en)', async () => {
    localStorage.setItem(STORAGE_KEY, 'de');
    await i18n.changeLanguage('de');
    stubNavigator(['en-US']);
    const user = userEvent.setup();
    render(<LanguageSection />);
    await user.click(screen.getByRole('radio', { name: 'Systemsprache folgen' }));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(i18n.language).toBe('en');
    await i18n.changeLanguage('de');
  });
});
