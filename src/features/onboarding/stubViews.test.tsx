import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SetupView } from './SetupView';

/**
 * Placeholder render test for the remaining ONB-01a onboarding stub.
 * WelcomeView + PrivacyView stub tests were removed in ONB-01b once the
 * real views landed. SetupView's stub test stays until ONB-01c replaces
 * the stub with the real implementation.
 */
describe('ONB-01a onboarding stubs', () => {
  it('SetupView renders its placeholder', () => {
    render(<SetupView />);
    expect(screen.getByTestId('setup-stub')).toBeInTheDocument();
  });
});
