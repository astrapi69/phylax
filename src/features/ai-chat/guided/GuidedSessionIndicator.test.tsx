import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GuidedSessionIndicator } from './GuidedSessionIndicator';
import type { GuidedSessionState } from './GuidedSessionState';

describe('GuidedSessionIndicator', () => {
  it('renders three pills when the guided session is active', () => {
    const state: GuidedSessionState = {
      active: true,
      sectionsCompleted: [],
      startedAt: 1,
    };
    render(<GuidedSessionIndicator state={state} />);
    expect(screen.getByTestId('guided-session-pill-observations')).toBeInTheDocument();
    expect(screen.getByTestId('guided-session-pill-supplements')).toBeInTheDocument();
    expect(screen.getByTestId('guided-session-pill-open-points')).toBeInTheDocument();
  });

  it('renders nothing when the guided session is inactive', () => {
    const state: GuidedSessionState = {
      active: false,
      sectionsCompleted: [],
      startedAt: null,
    };
    const { container } = render(<GuidedSessionIndicator state={state} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks completed sections with state=completed and the erfasst aria-label', () => {
    const state: GuidedSessionState = {
      active: true,
      sectionsCompleted: ['observations'],
      startedAt: 1,
    };
    render(<GuidedSessionIndicator state={state} />);
    const obs = screen.getByTestId('guided-session-pill-observations');
    expect(obs).toHaveAttribute('data-state', 'completed');
    expect(obs).toHaveAttribute('aria-label', 'Beobachtungen: erfasst');
  });

  it('marks uncompleted sections with state=pending and the ausstehend aria-label', () => {
    const state: GuidedSessionState = {
      active: true,
      sectionsCompleted: ['observations'],
      startedAt: 1,
    };
    render(<GuidedSessionIndicator state={state} />);
    const supp = screen.getByTestId('guided-session-pill-supplements');
    expect(supp).toHaveAttribute('data-state', 'pending');
    expect(supp).toHaveAttribute('aria-label', 'Supplemente: ausstehend');
  });
});
