import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';
import { __resetForTest } from './useBodyScrollLock';

beforeEach(() => {
  __resetForTest();
});

afterEach(() => {
  __resetForTest();
});

const baseProps = {
  open: true,
  title: 'Delete file?',
  body: 'This cannot be undone.',
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
};

describe('ConfirmDialog', () => {
  it('renders title + body + cancel + confirm', () => {
    render(<ConfirmDialog {...baseProps} onClose={vi.fn()} onConfirm={vi.fn()} testId="cd" />);
    expect(screen.getByText('Delete file?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('focuses cancel by default per Phylax convention', () => {
    render(<ConfirmDialog {...baseProps} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('default variant uses role=dialog', () => {
    render(<ConfirmDialog {...baseProps} onClose={vi.fn()} onConfirm={vi.fn()} testId="cd" />);
    expect(screen.getByTestId('cd').getAttribute('role')).toBe('dialog');
  });

  it('destructive variant uses role=alertdialog', () => {
    render(
      <ConfirmDialog
        {...baseProps}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        variant="destructive"
        testId="cd"
      />,
    );
    expect(screen.getByTestId('cd').getAttribute('role')).toBe('alertdialog');
  });

  it('cancel button calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ConfirmDialog {...baseProps} onClose={onClose} onConfirm={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('confirm button calls onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...baseProps} onClose={vi.fn()} onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('confirmDisabled gates the confirm button', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog {...baseProps} onClose={vi.fn()} onConfirm={onConfirm} confirmDisabled />,
    );
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('busy disables both buttons + shows busyLabel on confirm', () => {
    render(
      <ConfirmDialog
        {...baseProps}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        busy
        busyLabel="Deleting..."
      />,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
  });

  it('busy suppresses Escape close', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ConfirmDialog {...baseProps} onClose={onClose} onConfirm={vi.fn()} busy />);
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape closes when not busy', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ConfirmDialog {...baseProps} onClose={onClose} onConfirm={vi.fn()} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('renders extraBody when supplied', () => {
    render(
      <ConfirmDialog
        {...baseProps}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        extraBody={<input data-testid="challenge" />}
      />,
    );
    expect(screen.getByTestId('challenge')).toBeInTheDocument();
  });

  it('open=false renders nothing', () => {
    render(
      <ConfirmDialog
        {...baseProps}
        open={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        testId="cd"
      />,
    );
    expect(screen.queryByTestId('cd')).toBeNull();
  });
});
