import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WelcomeView } from './WelcomeView';
import { PrivacyView } from './PrivacyView';
import { SetupView } from './SetupView';

/**
 * Placeholder render tests for the ONB-01a stubs. Each stub renders a
 * data-testid so ONB-01b/c can replace them without touching route
 * wiring. Tests go away once real views land.
 */
describe('ONB-01a onboarding stubs', () => {
  it('WelcomeView renders its placeholder', () => {
    render(<WelcomeView />);
    expect(screen.getByTestId('welcome-stub')).toBeInTheDocument();
  });

  it('PrivacyView renders its placeholder', () => {
    render(<PrivacyView />);
    expect(screen.getByTestId('privacy-stub')).toBeInTheDocument();
  });

  it('SetupView renders its placeholder', () => {
    render(<SetupView />);
    expect(screen.getByTestId('setup-stub')).toBeInTheDocument();
  });
});
