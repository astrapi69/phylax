import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportButton } from './ExportButton';

beforeEach(() => {
  // Dialog mounts ExportDialog which uses download stubs; silence them here.
  URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ExportButton', () => {
  it('renders the default label "Profil exportieren"', () => {
    render(<ExportButton />);
    expect(screen.getByRole('button', { name: 'Profil exportieren' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('accepts a custom label via children', () => {
    render(<ExportButton>Exportieren</ExportButton>);
    expect(screen.getByRole('button', { name: 'Exportieren' })).toBeInTheDocument();
  });

  it('clicking opens the ExportDialog', async () => {
    const user = userEvent.setup();
    render(<ExportButton />);
    await user.click(screen.getByTestId('export-profile-button'));
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'export-dialog-title');
  });
});
