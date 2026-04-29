import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { UpdateIndicator } from './UpdateIndicator';

vi.mock('./UpdateContext', async () => {
  const actual = await vi.importActual<typeof import('./UpdateContext')>('./UpdateContext');
  return {
    ...actual,
    useUpdate: () => mockState,
  };
});

let mockState: { needRefresh: boolean; apply: () => void } = {
  needRefresh: false,
  apply: () => undefined,
};

function setState(next: { needRefresh: boolean; apply: () => void }) {
  mockState = next;
}

function Wrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

describe('UpdateIndicator', () => {
  it('renders nothing when no update is available', () => {
    setState({ needRefresh: false, apply: vi.fn() });
    const { container } = render(
      <Wrapper>
        <UpdateIndicator />
      </Wrapper>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the pill with the localized label when an update is available', () => {
    setState({ needRefresh: true, apply: vi.fn() });
    render(
      <Wrapper>
        <UpdateIndicator />
      </Wrapper>,
    );
    const button = screen.getByTestId('update-indicator');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Update verfügbar — klicken zum Aktualisieren');
    expect(button).toHaveTextContent('Update');
  });

  it('wraps the pill in role=status with aria-live=polite for SR announcement', () => {
    setState({ needRefresh: true, apply: vi.fn() });
    render(
      <Wrapper>
        <UpdateIndicator />
      </Wrapper>,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toContainElement(screen.getByTestId('update-indicator'));
  });

  it('calls apply() when the pill is clicked', async () => {
    const apply = vi.fn();
    setState({ needRefresh: true, apply });
    const user = userEvent.setup();
    render(
      <Wrapper>
        <UpdateIndicator />
      </Wrapper>,
    );
    await user.click(screen.getByTestId('update-indicator'));
    expect(apply).toHaveBeenCalledOnce();
  });
});
