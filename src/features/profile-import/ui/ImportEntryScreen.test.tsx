import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportEntryScreen } from './ImportEntryScreen';

describe('ImportEntryScreen', () => {
  it('renders both file and paste inputs', () => {
    render(<ImportEntryScreen onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Datei auswählen')).toBeInTheDocument();
    expect(screen.getByText('Oder Text einfügen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeDisabled();
  });

  it('enables Weiter once paste reaches minimum length', async () => {
    const user = userEvent.setup();
    render(<ImportEntryScreen onSubmit={vi.fn()} onCancel={vi.fn()} />);
    const textarea = screen.getByLabelText(/markdown-text einfügen/i);
    await user.type(textarea, 'x'.repeat(100));
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeEnabled();
  });

  it('submits paste content with source label "Eingefügter Text"', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ImportEntryScreen onSubmit={onSubmit} onCancel={vi.fn()} />);
    const paste = 'y'.repeat(120);
    const textarea = screen.getByLabelText(/markdown-text einfügen/i);
    await user.click(textarea);
    await user.paste(paste);
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(onSubmit).toHaveBeenCalledWith(paste, 'Eingefügter Text');
  });

  it('submits file content with the file name as source label', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ImportEntryScreen onSubmit={onSubmit} onCancel={vi.fn()} />);
    const fileInput = document.getElementById('import-file') as HTMLInputElement;
    const file = new File(['# Hallo'], 'profil.md', { type: 'text/markdown' });
    await user.upload(fileInput, file);

    await screen.findByText(/Geladen: profil.md/);
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(onSubmit).toHaveBeenCalledWith('# Hallo', 'profil.md');
  });

  it('shows an error when the selected file is too large', async () => {
    const user = userEvent.setup();
    render(<ImportEntryScreen onSubmit={vi.fn()} onCancel={vi.fn()} />);
    const fileInput = document.getElementById('import-file') as HTMLInputElement;
    // 2 MB file: bigger than the 1 MB limit
    const big = new File([new Uint8Array(2 * 1024 * 1024)], 'big.md', { type: 'text/markdown' });
    await user.upload(fileInput, big);
    expect(await screen.findByText(/zu gross/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeDisabled();
  });

  it('cancel button calls onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ImportEntryScreen onSubmit={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not submit paste that is too short', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ImportEntryScreen onSubmit={onSubmit} onCancel={vi.fn()} />);
    const textarea = screen.getByLabelText(/markdown-text einfügen/i);
    await user.type(textarea, 'kurz');
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
