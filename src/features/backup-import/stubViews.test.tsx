import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BackupImportSelectView } from './BackupImportSelectView';
import { BackupImportUnlockView } from './BackupImportUnlockView';

/**
 * Placeholder render tests for the ONB-01a backup-import stubs. ONB-01e
 * replaces both with real implementations + the backup-import i18n
 * namespace. Tests go away once real views land.
 */
describe('ONB-01a backup-import stubs', () => {
  it('BackupImportSelectView renders its placeholder', () => {
    render(<BackupImportSelectView />);
    expect(screen.getByTestId('backup-import-select-stub')).toBeInTheDocument();
  });

  it('BackupImportUnlockView renders its placeholder', () => {
    render(<BackupImportUnlockView />);
    expect(screen.getByTestId('backup-import-unlock-stub')).toBeInTheDocument();
  });
});
