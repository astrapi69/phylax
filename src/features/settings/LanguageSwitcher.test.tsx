import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '../../i18n/config';
import { LanguageSwitcher } from './LanguageSwitcher';

describe('LanguageSwitcher', () => {
  it('renders nothing while only one language is supported (I18N-01)', () => {
    // SUPPORTED_LANGUAGES currently contains only "de". The switcher
    // returns null in that state so no UI clutter appears in Settings.
    // When a second language lands (I18N-02 English), this assertion
    // flips and the test is updated.
    const { container } = render(<LanguageSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });
});
