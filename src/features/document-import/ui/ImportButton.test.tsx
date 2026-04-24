import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../../i18n/config';
import { ImportButton } from './ImportButton';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
});

describe('ImportButton', () => {
  it('renders the Importieren label and a hidden file input', () => {
    render(<ImportButton />);
    expect(screen.getByTestId('import-button')).toHaveTextContent('Importieren');
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass('sr-only');
  });

  it('does not mount ImportFlow before a file is picked', () => {
    render(<ImportButton />);
    expect(screen.queryByTestId('import-flow')).toBeNull();
  });

  it('opens ImportFlow when a file is selected', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ImportButton />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'note.txt', { type: 'text/plain' });
    await user.upload(input, file);
    await waitFor(() => expect(screen.getByTestId('import-flow')).toBeInTheDocument());
  });
});
