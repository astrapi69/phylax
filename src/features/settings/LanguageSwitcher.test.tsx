import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '../../i18n/config';
import { LanguageSwitcher } from './LanguageSwitcher';

describe('LanguageSwitcher', () => {
  it('renders nothing while LANGUAGE_SWITCHER_ENABLED is false (I18N-02-a..02-d)', () => {
    // EN resources are loading namespace-by-namespace through 02-a..02-d.
    // The switcher stays gated on LANGUAGE_SWITCHER_ENABLED and returns
    // null so users see a stable DE-only UI until 02-e flips the flag
    // and introduces LanguageSection.
    const { container } = render(<LanguageSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });
});
